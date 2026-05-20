import { Request, Response, NextFunction } from 'express';
import { InvitationService } from '../../shared/services/invitation.service';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { AppError } from '../../shared/utils/app-error';
import { Organization } from '../organizations/organizations.model';
import { Submission } from '../submissions/submissions.model';

export class InvitationsController {
  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.query.token || '');
      if (!token) return next(new AppError('Invitation token is required', 400));
      const data = await InvitationService.validateToken(token);
      res.json(responseFormatter.success(data));
    } catch (error) {
      next(error);
    }
  }

  static async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const { inviteToken, organizationId, email } = req.body;
      if (!inviteToken || !organizationId || !email) {
        return next(new AppError('inviteToken, organizationId, and email are required', 400));
      }
      const invitation = await InvitationService.acceptInvitation({
        token: inviteToken,
        signupEmail: email,
        organizationId,
      });
      res.json(responseFormatter.success(invitation, 'Invitation accepted'));
    } catch (error) {
      next(error);
    }
  }

  static async resend(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { submissionId, email, intendedRole, inviteeName } = req.body;
      const orgId = (authReq.user as any)?.organizationId;
      const userId = authReq.user?.id;
      if (!submissionId || !email || !intendedRole || !inviteeName?.trim()) {
        return next(new AppError('submissionId, email, inviteeName, and intendedRole are required', 400));
      }

      const sub = await Submission.findByPk(submissionId);
      if (!sub) return next(new AppError('Submission not found', 404));
      if (sub.organizationId !== orgId) {
        return next(new AppError('You do not have access to this submission', 403));
      }

      const org = await Organization.findByPk(orgId);
      if (!org) return next(new AppError('Organization not found', 404));

      const name = String(inviteeName).trim();
      const invitation = await InvitationService.createAndSendInvite({
        email,
        inviteeName: name,
        intendedRole,
        invitedByUserId: userId!,
        invitedByOrganizationId: orgId,
        submissionId,
        inviterOrgName: org.name,
        technologyLabel: sub.technology,
      });

      sub.counterpartyStatus = 'invite_sent';
      if (intendedRole === 'acquirer') {
        sub.invitedAcquirerEmail = email.trim().toLowerCase();
        sub.invitedAcquirerName = name;
      } else {
        sub.invitedPartnerEmail = email.trim().toLowerCase();
        sub.invitedPartnerName = name;
      }
      await sub.save();

      res.json(responseFormatter.success(invitation, 'Invitation resent'));
    } catch (error) {
      next(error);
    }
  }
}
