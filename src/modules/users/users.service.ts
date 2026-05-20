import { UsersRepository } from './users.repository';
import { User, UserCreationAttributes } from './users.model';
import { Organization } from '../organizations/organizations.model';
import { AuthService } from '../auth/auth.service';
import { AppError } from '../../shared/utils/app-error';
import { RbacService } from '../rbac/rbac.service';
import { OrgRole } from '../rbac/role.model';
import { EmailService } from '../../shared/services/email.service';
import crypto from 'crypto';
import { Op } from 'sequelize';

const PASSWORD_SETUP_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export class UsersService {
  private static async hashUnusablePassword(): Promise<string> {
    return AuthService.hashPassword(crypto.randomBytes(48).toString('hex'));
  }

  static async sendPasswordSetupInvite(
    user: User,
    context?: { invitedBy?: string },
  ): Promise<void> {
    const setupToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(setupToken).digest('hex');

    await UsersRepository.update(user.id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + PASSWORD_SETUP_EXPIRY_MS),
    });

    await EmailService.sendAccountSetupInvite({
      email: user.email,
      name: user.name,
      token: setupToken,
      invitedBy: context?.invitedBy,
      portalRole: user.role,
    });
  }

  static async createUser(data: UserCreationAttributes & { password?: string }) {
    const existing = await UsersRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError('Email already in use', 400);
    }

    const passwordHash = data.password
      ? await AuthService.hashPassword(data.password)
      : await this.hashUnusablePassword();
    const { password: _p, ...rest } = data as UserCreationAttributes & { password?: string };

    const user = await UsersRepository.create({
      ...rest,
      passwordHash,
      ...(data.password ? { passwordSetAt: new Date() } : {}),
    });

    if (!user.orgRoleId) {
      await RbacService.assignOwnerRoleToUser(user);
    }

    return user;
  }

  static async getAllUsers(role?: string) {
    const where = role ? { role } : {};
    return User.findAll({
      where,
      include: [{ model: OrgRole, as: 'orgRole' }],
      order: [['createdAt', 'DESC']],
    });
  }

  static async getOrgUsers(organizationId: string) {
    return User.findAll({
      where: { organizationId },
      include: [{ model: OrgRole, as: 'orgRole' }],
      order: [['createdAt', 'DESC']],
    });
  }

  static async getUserById(id: string) {
    const user = await UsersRepository.findById(id);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  static async toggleUserStatus(id: string) {
    const user = await this.getUserById(id);
    await UsersRepository.update(id, { isActive: !user.isActive });
    return User.findByPk(id, { include: [{ model: OrgRole, as: 'orgRole' }] });
  }

  static async assertOrgRoleAssignable(
    orgRoleId: string,
    tenantRole: 'admin' | 'partner' | 'acquirer',
    organizationId?: string | null,
  ) {
    const role = await OrgRole.findByPk(orgRoleId);
    if (!role) throw new AppError('Invalid role', 400);
    RbacService.assertRoleInScope(role, tenantRole, organizationId);
    return role;
  }

  static async inviteTeamMember(params: {
    name: string;
    email: string;
    orgRoleId: string;
    organizationId: string;
    tenantRole: 'partner' | 'acquirer';
    department?: string;
  }) {
    const existing = await UsersRepository.findByEmail(params.email);
    if (existing) throw new AppError('Email already in use', 400);

    await this.assertOrgRoleAssignable(
      params.orgRoleId,
      params.tenantRole,
      params.organizationId,
    );

    const passwordHash = await this.hashUnusablePassword();

    const user = await UsersRepository.create({
      name: params.name,
      email: params.email,
      passwordHash,
      role: params.tenantRole,
      organizationId: params.organizationId,
      orgRoleId: params.orgRoleId,
      department: params.department,
      isActive: true,
    });

    const org = await Organization.findByPk(params.organizationId, { attributes: ['name'] });
    await this.sendPasswordSetupInvite(user, { invitedBy: org?.name });

    return User.findByPk(user.id, { include: [{ model: OrgRole, as: 'orgRole' }] });
  }

  static async inviteAdminStaff(params: {
    name: string;
    email: string;
    orgRoleId: string;
    department?: string;
  }) {
    const existing = await UsersRepository.findByEmail(params.email);
    if (existing) throw new AppError('Email already in use', 400);

    await this.assertOrgRoleAssignable(params.orgRoleId, 'admin', null);

    const passwordHash = await this.hashUnusablePassword();

    const user = await UsersRepository.create({
      name: params.name,
      email: params.email,
      passwordHash,
      role: 'admin',
      organizationId: undefined,
      orgRoleId: params.orgRoleId,
      department: params.department,
      isActive: true,
    });

    await this.sendPasswordSetupInvite(user, { invitedBy: 'NOTAP' });

    return User.findByPk(user.id, { include: [{ model: OrgRole, as: 'orgRole' }] });
  }

  static async updateTeamMember(
    userId: string,
    organizationId: string,
    tenantRole: 'partner' | 'acquirer',
    data: { orgRoleId?: string; isActive?: boolean; department?: string; name?: string },
  ) {
    const user = await this.getUserById(userId);
    if (user.organizationId !== organizationId || user.role !== tenantRole) {
      throw new AppError('User not found', 404);
    }

    if (data.orgRoleId) {
      await this.assertOrgRoleAssignable(data.orgRoleId, tenantRole, organizationId);
    }

    await UsersRepository.update(userId, {
      ...(data.orgRoleId && { orgRoleId: data.orgRoleId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.name && { name: data.name }),
    });

    return User.findByPk(userId, { include: [{ model: OrgRole, as: 'orgRole' }] });
  }

  static resolveUserStatus(u: User): 'active' | 'inactive' | 'invite_pending' {
    if (!u.isActive) return 'inactive';
    if (!u.passwordSetAt) return 'invite_pending';
    return 'active';
  }

  static async backfillPasswordSetAt(): Promise<number> {
    const users = await User.findAll({
      where: {
        passwordSetAt: { [Op.is]: null },
        resetPasswordToken: { [Op.is]: null },
      } as any,
    });
    for (const u of users) {
      await u.update({ passwordSetAt: u.lastLoginAt || u.createdAt });
    }
    return users.length;
  }

  static serializeUser(u: User) {
    const orgRole = (u as any).orgRole as OrgRole | undefined;
    const status = this.resolveUserStatus(u);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      orgRoleId: u.orgRoleId,
      orgRoleName: orgRole?.name,
      department: u.department,
      isActive: u.isActive,
      passwordSetAt: u.passwordSetAt,
      status,
    };
  }
}
