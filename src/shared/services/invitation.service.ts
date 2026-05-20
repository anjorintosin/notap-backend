import crypto from 'crypto';
import { Op } from 'sequelize';
import { Organization } from '../../modules/organizations/organizations.model';
import { Submission } from '../../modules/submissions/submissions.model';
import { OrganizationInvitation } from '../../modules/invitations/organization-invitations.model';
import { EmailService } from './email.service';
import { AppError } from '../utils/app-error';

const INVITE_DAYS = 14;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export type CounterpartyInput = {
  partnerOrganizationId?: string;
  acquirerOrganizationId?: string;
  invitedPartnerEmail?: string;
  invitedAcquirerEmail?: string;
  invitedPartnerName?: string;
  invitedAcquirerName?: string;
};

export type CounterpartyResult = {
  partnerOrganizationId?: string | null;
  acquirerOrganizationId?: string | null;
  invitedPartnerEmail?: string | null;
  invitedAcquirerEmail?: string | null;
  invitedPartnerName?: string | null;
  invitedAcquirerName?: string | null;
  counterpartyStatus: 'linked' | 'invite_sent' | 'registered';
  acquirerName?: string;
};

export class InvitationService {
  static async findActiveOrgByEmail(
    email: string,
    type: 'local_partner' | 'acquirer',
  ): Promise<Organization | null> {
    const normalized = normalizeEmail(email);
    return Organization.findOne({
      where: {
        contactEmail: { [Op.iLike]: normalized },
        type,
        status: 'active',
      },
    });
  }

  static async createAndSendInvite(opts: {
    email: string;
    inviteeName: string;
    intendedRole: 'local_partner' | 'acquirer';
    invitedByUserId: string;
    invitedByOrganizationId: string;
    submissionId: string;
    inviterOrgName: string;
    technologyLabel?: string;
  }): Promise<OrganizationInvitation> {
    const email = normalizeEmail(opts.email);

    await OrganizationInvitation.update(
      { status: 'cancelled' },
      {
        where: {
          submissionId: opts.submissionId,
          email,
          status: 'pending',
        },
      },
    );

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_DAYS);

    const invitation = await OrganizationInvitation.create({
      email,
      inviteeName: opts.inviteeName.trim(),
      intendedRole: opts.intendedRole,
      invitedByUserId: opts.invitedByUserId,
      invitedByOrganizationId: opts.invitedByOrganizationId,
      submissionId: opts.submissionId,
      token,
      expiresAt,
      status: 'pending',
    });

    await EmailService.sendOrganizationInvite({
      email,
      inviteeName: opts.inviteeName.trim(),
      intendedRole: opts.intendedRole,
      inviterOrgName: opts.inviterOrgName,
      technologyLabel: opts.technologyLabel,
      token,
    });

    return invitation;
  }

  static async resolveCounterparty(opts: {
    createdByRole: 'partner' | 'acquirer';
    initiatorOrg: Organization;
    initiatorUserId: string;
    submissionId: string;
    technologyLabel: string;
    input: CounterpartyInput;
    existing?: Submission | null;
  }): Promise<CounterpartyResult> {
    const { createdByRole, initiatorOrg, input } = opts;
    const result: CounterpartyResult = {
      partnerOrganizationId: opts.existing?.partnerOrganizationId ?? null,
      acquirerOrganizationId: opts.existing?.acquirerOrganizationId ?? null,
      invitedPartnerEmail: opts.existing?.invitedPartnerEmail ?? null,
      invitedAcquirerEmail: opts.existing?.invitedAcquirerEmail ?? null,
      invitedPartnerName: opts.existing?.invitedPartnerName ?? null,
      invitedAcquirerName: opts.existing?.invitedAcquirerName ?? null,
      counterpartyStatus: opts.existing?.counterpartyStatus ?? 'linked',
      acquirerName: opts.existing?.acquirerName,
    };

    if (createdByRole === 'partner') {
      if (input.acquirerOrganizationId) {
        const acq = await Organization.findByPk(input.acquirerOrganizationId);
        if (!acq || acq.type !== 'acquirer' || acq.status !== 'active') {
          throw new AppError('Selected acquirer is not active on the platform', 400);
        }
        result.acquirerOrganizationId = acq.id;
        result.acquirerName = acq.name;
        result.invitedAcquirerEmail = null;
        result.invitedAcquirerName = null;
        result.counterpartyStatus = 'linked';
      } else if (input.invitedAcquirerEmail) {
        const email = normalizeEmail(input.invitedAcquirerEmail);
        const inviteeName = input.invitedAcquirerName?.trim();
        if (!inviteeName) {
          throw new AppError('Acquirer company name is required when inviting by email', 400);
        }
        const existingOrg = await this.findActiveOrgByEmail(email, 'acquirer');
        if (existingOrg) {
          result.acquirerOrganizationId = existingOrg.id;
          result.acquirerName = existingOrg.name;
          result.invitedAcquirerEmail = null;
          result.invitedAcquirerName = null;
          result.counterpartyStatus = 'linked';
        } else {
          result.acquirerOrganizationId = null;
          result.acquirerName = inviteeName;
          result.invitedAcquirerEmail = email;
          result.invitedAcquirerName = inviteeName;
          result.counterpartyStatus = 'invite_sent';
          await this.createAndSendInvite({
            email,
            inviteeName,
            intendedRole: 'acquirer',
            invitedByUserId: opts.initiatorUserId,
            invitedByOrganizationId: initiatorOrg.id,
            submissionId: opts.submissionId,
            inviterOrgName: initiatorOrg.name,
            technologyLabel: opts.technologyLabel,
          });
        }
      }
    } else {
      // acquirer-initiated: link partner
      result.acquirerOrganizationId = initiatorOrg.id;
      result.acquirerName = initiatorOrg.name;

      if (input.partnerOrganizationId) {
        const partner = await Organization.findByPk(input.partnerOrganizationId);
        if (!partner || partner.type !== 'local_partner' || partner.status !== 'active') {
          throw new AppError('Selected local partner is not active on the platform', 400);
        }
        result.partnerOrganizationId = partner.id;
        result.invitedPartnerEmail = null;
        result.invitedPartnerName = null;
        result.counterpartyStatus = 'linked';
      } else if (input.invitedPartnerEmail) {
        const email = normalizeEmail(input.invitedPartnerEmail);
        const inviteeName = input.invitedPartnerName?.trim();
        if (!inviteeName) {
          throw new AppError('Local partner company name is required when inviting by email', 400);
        }
        const existingOrg = await this.findActiveOrgByEmail(email, 'local_partner');
        if (existingOrg) {
          result.partnerOrganizationId = existingOrg.id;
          result.invitedPartnerEmail = null;
          result.invitedPartnerName = null;
          result.counterpartyStatus = 'linked';
        } else {
          result.partnerOrganizationId = null;
          result.invitedPartnerEmail = email;
          result.invitedPartnerName = inviteeName;
          result.counterpartyStatus = 'invite_sent';
          await this.createAndSendInvite({
            email,
            inviteeName,
            intendedRole: 'local_partner',
            invitedByUserId: opts.initiatorUserId,
            invitedByOrganizationId: initiatorOrg.id,
            submissionId: opts.submissionId,
            inviterOrgName: initiatorOrg.name,
            technologyLabel: opts.technologyLabel,
          });
        }
      }
    }

    return result;
  }

  static async validateToken(token: string) {
    const invitation = await OrganizationInvitation.findOne({
      where: { token, status: 'pending' },
      include: [
        { model: Organization, as: 'invitedByOrganization', attributes: ['id', 'name'] },
        {
          model: Submission,
          as: 'submission',
          attributes: ['id', 'technology', 'invitedPartnerName', 'invitedAcquirerName'],
        },
      ],
    });

    if (!invitation) {
      throw new AppError('Invitation link is invalid or has already been used', 400);
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();
      throw new AppError('Invitation link has expired', 400);
    }

    const inviterOrg = (invitation as any).invitedByOrganization as Organization | undefined;
    const submission = (invitation as any).submission as Submission | undefined;

    const inviteeName =
      invitation.inviteeName ||
      submission?.invitedPartnerName ||
      submission?.invitedAcquirerName ||
      null;

    return {
      email: invitation.email,
      inviteeName,
      intendedRole: invitation.intendedRole,
      inviterName: inviterOrg?.name || 'NOTAP',
      submissionSummary: submission?.technology || null,
      submissionId: invitation.submissionId,
    };
  }

  static async acceptInvitation(opts: {
    token: string;
    signupEmail: string;
    organizationId: string;
  }) {
    const invitation = await OrganizationInvitation.findOne({
      where: { token: opts.token, status: 'pending' },
    });

    if (!invitation) {
      throw new AppError('Invitation is invalid or already used', 400);
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();
      throw new AppError('Invitation has expired', 400);
    }

    const signupEmail = normalizeEmail(opts.signupEmail);
    if (signupEmail !== invitation.email) {
      throw new AppError('Signup email must match the invited email address', 400);
    }

    invitation.status = 'accepted';
    invitation.acceptedOrganizationId = opts.organizationId;
    await invitation.save();

    if (invitation.submissionId) {
      const sub = await Submission.findByPk(invitation.submissionId);
      if (sub) {
        if (invitation.intendedRole === 'local_partner') {
          sub.partnerOrganizationId = opts.organizationId;
          sub.invitedPartnerEmail = undefined;
          sub.invitedPartnerName = undefined;
        } else {
          sub.acquirerOrganizationId = opts.organizationId;
          sub.invitedAcquirerEmail = undefined;
          sub.invitedAcquirerName = undefined;
          const org = await Organization.findByPk(opts.organizationId);
          if (org) sub.acquirerName = org.name;
        }
        sub.counterpartyStatus = 'registered';
        await sub.save();
      }
    }

    return invitation;
  }
}
