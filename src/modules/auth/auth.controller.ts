import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { User } from '../users/users.model';
import { Organization } from '../organizations/organizations.model';
import sequelize from '../../config/database';
import { AppError } from '../../shared/utils/app-error';
import { responseFormatter } from '../../shared/utils/response-formatter';
import crypto from 'crypto';
import { EmailService } from '../../shared/services/email.service';
import { InvitationService } from '../../shared/services/invitation.service';
import { RbacService } from '../rbac/rbac.service';
import { Op } from 'sequelize';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ 
        where: { email },
        include: [{ model: Organization, as: 'organization' }]
      });

      if (!user || !(await AuthService.comparePassword(password, user.passwordHash))) {
        return next(new AppError('Invalid email or password', 401));
      }

      if (!user.isActive) {
        return next(new AppError('Account is inactive. Please contact administrator', 403));
      }

      if (!user.passwordSetAt) {
        return next(
          new AppError(
            'Please set your password using the invitation link sent to your email before signing in.',
            403,
          ),
        );
      }

      if (!user.emailVerified && user.role !== 'admin') {
        return next(
          new AppError(
            'Please verify your email address using the link sent to you at registration before signing in.',
            403,
          ),
        );
      }

      // Role-based organization check
      if (user.role !== 'admin' && user.organizationId) {
        const org = (user as any).organization;
        if (!org || org.status !== 'active') {
          return next(new AppError(`Access Denied: Your organization (${org?.name || 'Unknown'}) is currently ${org?.status || 'pending'} NOTAP approval.`, 403));
        }
      }

      const session = await AuthService.buildSessionPayload(user);
      const tokens = AuthService.generateTokens(session);

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      const org = (user as any).organization;

      return res.json(responseFormatter.success({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: org?.name,
          transfereeId: org?.transfereeId,
          orgRoleId: session.orgRoleId,
          orgRoleName: session.orgRoleName,
          isOwner: session.isOwner,
          permissions: session.permissions,
        },
        ...tokens
      }, 'Login successful'));
    } catch (error) {
      next(error);
    }
  }

  static async signup(req: Request, res: Response, next: NextFunction) {
    const t = await sequelize.transaction();
    try {
      let {
        email, password, name,
        companyName, companyType,
        registrationNumber, address,
        contactPhone, sector,
        inviteToken,
      } = req.body;

      if (companyType === 'partner') companyType = 'local_partner';

      if (inviteToken) {
        const invite = await InvitationService.validateToken(inviteToken);
        if (invite.intendedRole !== companyType) {
          await t.rollback();
          return next(new AppError('Registration type does not match your invitation', 400));
        }
        if (String(email).trim().toLowerCase() !== invite.email) {
          await t.rollback();
          return next(new AppError('You must register with the invited email address', 400));
        }
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        await t.rollback();
        return next(new AppError('Email already in use', 400));
      }

      // 1. Create Organization
      const organization = await Organization.create({
        name: companyName,
        type: companyType,
        registrationNumber,
        sector,
        address,
        contactEmail: email,
        contactPhone,
        status: 'pending'
      }, { transaction: t });

      // 2. Hash Password
      const passwordHash = await AuthService.hashPassword(password);

      const skipEmailVerify = Boolean(inviteToken);
      let verificationToken: string | null = null;

      if (!skipEmailVerify) {
        verificationToken = crypto.randomBytes(32).toString('hex');
      }

      // 3. Create User
      const user = await User.create({
        name,
        email,
        passwordHash,
        role: companyType === 'local_partner' ? 'partner' : (companyType as any),
        organizationId: organization.id,
        isActive: true,
        passwordSetAt: new Date(),
        emailVerified: skipEmailVerify,
        emailVerificationToken: verificationToken
          ? crypto.createHash('sha256').update(verificationToken).digest('hex')
          : null,
        emailVerificationExpires: verificationToken
          ? new Date(Date.now() + 48 * 3600000)
          : null,
      }, { transaction: t });

      if (inviteToken) {
        await InvitationService.acceptInvitation({
          token: inviteToken,
          signupEmail: email,
          organizationId: organization.id,
          transaction: t,
        });
      }

      await t.commit();

      if (verificationToken) {
        await EmailService.sendEmailVerification({
          email: user.email,
          name: user.name,
          token: verificationToken,
        });
      }

      await RbacService.ensureOrgRoles(
        organization.id,
        companyType === 'local_partner' ? 'partner' : 'acquirer',
      );
      await RbacService.assignOwnerRoleToUser(user);

      return res.status(201).json(responseFormatter.success({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId
        },
        organization: {
          id: organization.id,
          name: organization.name,
          status: organization.status
        }
      }, inviteToken
        ? 'Registration request submitted successfully. Please wait for NOTAP approval.'
        : 'Registration submitted. Please check your email to verify your address, then wait for NOTAP approval.',
        201));
    } catch (error) {
      await t.rollback();
      next(error);
    }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.body?.token || req.query?.token || '');
      if (!token) {
        return next(new AppError('Verification token is required', 400));
      }

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        where: {
          emailVerificationToken: hashedToken,
          emailVerificationExpires: { [Op.gt]: new Date() },
        },
      });

      if (!user) {
        return next(new AppError('Verification link is invalid or has expired', 400));
      }

      user.emailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();

      res.json(responseFormatter.success(null, 'Email verified successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmailGet(req: Request, res: Response, next: NextFunction) {
    req.body = { ...req.body, token: req.query.token };
    return AuthController.verifyEmail(req, res, next);
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const decoded: any = AuthService.verifyRefreshToken(refreshToken);

      const user = await User.findByPk(decoded.id);
      if (!user || !user.isActive) {
        return next(new AppError('User not found or inactive', 401));
      }

      const session = await AuthService.buildSessionPayload(user);
      const tokens = AuthService.generateTokens(session);
      return res.json(responseFormatter.success(tokens, 'Tokens refreshed successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.json(responseFormatter.success(null, 'If an account exists with that email, a reset link has been sent.'));
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
      await user.save();

      await EmailService.sendPasswordReset(user.email, resetToken);

      res.json(responseFormatter.success(null, 'Reset link sent to email'));
    } catch (error) { next(error); }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        where: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: { [Op.gt]: new Date() }
        }
      });

      if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
      }

      user.passwordHash = await AuthService.hashPassword(password);
      user.resetPasswordToken = (null as any);
      user.resetPasswordExpires = (null as any);
      user.emailVerified = true;
      if (!user.passwordSetAt) {
        user.passwordSetAt = new Date();
      }
      await user.save();

      res.json(responseFormatter.success(null, 'Password updated successfully'));
    } catch (error) { next(error); }
  }
}
