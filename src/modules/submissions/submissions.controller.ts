import { Request, Response, NextFunction } from 'express';
import { Submission, SubmissionCreationAttributes } from './submissions.model';
import { OEM } from '../oems/oems.model';
import { User } from '../users/users.model';
import { Organization } from '../organizations/organizations.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { AppError } from '../../shared/utils/app-error';
import { enqueueSubmissionProcessing } from '../../config/queue';
import { NotificationService } from '../../shared/services/notification.service';
import { InvitationService, CounterpartyInput } from '../../shared/services/invitation.service';
import {
  ComplianceFeeService,
  validateComplianceFeeAmount,
} from '../../shared/services/compliance-fee.service';
import { computeCertificateDatesFromAgreement } from '../../shared/utils/certificate-validity';

import { Op, Sequelize } from 'sequelize';

function pickSubmissionFields(body: Record<string, unknown>) {
  const fields = [
    'technology', 'technologyName', 'category', 'version',
    'oemName', 'oemCountry', 'acquirerName',
    'agreementFee', 'currency', 'expiryDate', 'signingDate', 'effectiveDate', 'notes',
  ] as const;
  const data: Record<string, unknown> = {};
  for (const key of fields) {
    if (body[key] !== undefined && body[key] !== '') data[key] = body[key];
  }
  return data;
}

function filePath(files: Express.Multer.File[] | undefined) {
  return files?.[0]?.path;
}

function generateRenewalReference() {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `RNW-${year}-${suffix}`;
}

function isRenewalAwaitingReview(sub: Submission) {
  return Boolean(sub.isRenewal && sub.renewalStatus === 'pending_review');
}

function parseIsDraft(body: Record<string, unknown> | undefined): boolean {
  const v = body?.isDraft;
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

function serializeSubmission(sub: Submission) {
  const plain = sub.get({ plain: true }) as unknown as Record<string, unknown>;
  const org = (sub as any).organization as Organization | undefined;
  const documents: { label: string; url?: string }[] = [];
  if (plain.agreementUrl) {
    documents.push({ label: 'Technology Agreement', url: plain.agreementUrl as string });
  }
  if (plain.taxClearanceUrl) {
    documents.push({ label: 'Tax Clearance Certificate', url: plain.taxClearanceUrl as string });
  }
  if (plain.isRenewal) {
    if (plain.renewalPrevFeeReceiptUrl) {
      documents.push({
        label: 'Previous NOTAP Fee Receipt',
        url: plain.renewalPrevFeeReceiptUrl as string,
      });
    }
    if (plain.renewalWhtCertificateUrl) {
      documents.push({
        label: 'WHT Certificate (FIRS)',
        url: plain.renewalWhtCertificateUrl as string,
      });
    }
    if (plain.renewalVatCertificateUrl) {
      documents.push({
        label: 'VAT Certificate (FIRS)',
        url: plain.renewalVatCertificateUrl as string,
      });
    }
    if (plain.renewalProjectFeeUrl) {
      documents.push({
        label: 'Updated Project Fee Document',
        url: plain.renewalProjectFeeUrl as string,
      });
    }
  }
  const partnerOrg = (sub as any).partnerOrganization as Organization | undefined;
  const localPartnerName =
    partnerOrg?.name ??
    (plain.invitedPartnerName as string | undefined) ??
    org?.get?.('name') ??
    org?.name ??
    plain.localPartnerName ??
    null;

  return {
    ...plain,
    localPartnerName,
    documents,
    documentLabels: documents.map((d) => d.label),
  };
}

function parseCounterpartyInput(body: Record<string, unknown>): CounterpartyInput {
  return {
    partnerOrganizationId: body.partnerOrganizationId as string | undefined,
    acquirerOrganizationId: body.acquirerOrganizationId as string | undefined,
    invitedPartnerEmail: body.invitedPartnerEmail as string | undefined,
    invitedAcquirerEmail: body.invitedAcquirerEmail as string | undefined,
    invitedPartnerName: body.invitedPartnerName as string | undefined,
    invitedAcquirerName: body.invitedAcquirerName as string | undefined,
  };
}

async function assertCanAccessSubmission(authReq: AuthRequest, sub: Submission) {
  const orgId = (authReq.user as any)?.organizationId;
  const role = authReq.user?.role;
  if (!orgId) throw new AppError('You do not have access to this submission', 403);

  if (role === 'partner') {
    if (sub.organizationId === orgId || sub.partnerOrganizationId === orgId) return;
  } else if (role === 'acquirer') {
    if (sub.acquirerOrganizationId === orgId) return;
    if (sub.organizationId === orgId && sub.createdByRole === 'acquirer') return;
    const org = await Organization.findByPk(orgId);
    if (org && sub.acquirerName === org.name) return;
  } else if (role === 'admin') {
    return;
  }
  throw new AppError('You do not have access to this submission', 403);
}

function assertCanEditSubmission(authReq: AuthRequest, sub: Submission) {
  const orgId = (authReq.user as any)?.organizationId;
  if (sub.organizationId !== orgId) {
    throw new AppError('You do not have access to this submission', 403);
  }
}

export class SubmissionsController {
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await Submission.findAll({
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      // Format for frontend
      const counts: any = { total: 0 };
      stats.forEach((s: any) => {
        const status = s.get('status');
        const count = parseInt(s.get('count'));
        counts[status] = count;
        counts.total += count;
      });

      const submissionCounts = await Submission.findAll({
        attributes: [
          'oemName',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        ],
        where: { oemName: { [Op.ne]: '' } },
        group: ['oemName'],
      });

      const countByOemName = new Map<string, number>();
      submissionCounts.forEach((row: any) => {
        const name = row.get('oemName') as string;
        countByOemName.set(name, parseInt(row.get('count') as string, 10) || 0);
      });

      const registry = await OEM.findAll({ order: [['name', 'ASC']] });
      const seen = new Set<string>();
      const topOems: { name: string; value: number }[] = registry.map((oem) => {
        const oemName = oem.get('name') as string;
        seen.add(oemName);
        return { name: oemName, value: countByOemName.get(oemName) || 0 };
      });

      countByOemName.forEach((value, name) => {
        if (!seen.has(name)) topOems.push({ name, value });
      });

      topOems.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

      res.json(responseFormatter.success({
        summary: counts,
        topOems,
        // Mocking some trend data for now until we have more real historical data
        monthly: [
          { month: 'Oct', submitted: counts.total > 0 ? Math.floor(counts.total * 0.1) : 0, approved: 0 },
          { month: 'Nov', submitted: counts.total > 0 ? Math.floor(counts.total * 0.15) : 0, approved: 0 },
          { month: 'Dec', submitted: counts.total > 0 ? Math.floor(counts.total * 0.2) : 0, approved: 0 },
          { month: 'Jan', submitted: counts.total > 0 ? Math.floor(counts.total * 0.2) : 0, approved: 0 },
          { month: 'Feb', submitted: counts.total > 0 ? Math.floor(counts.total * 0.15) : 0, approved: 0 },
          { month: 'Mar', submitted: counts.total > 0 ? counts.total : 0, approved: counts.approved || 0 },
        ]
      }));
    } catch (error) { next(error); }
  }

  static async updateComplianceFee(req: Request, res: Response, next: NextFunction) {
    try {
      const sub = await Submission.findByPk(req.params.id as string);
      if (!sub) return next(new AppError('Submission not found', 404));

      const body = req.body as { complianceFeeNGN?: number; clearOverride?: boolean };

      if (body.clearOverride) {
        if (sub.paymentStatus === 'paid') {
          return next(new AppError('Cannot change compliance fee after payment', 400));
        }
        await ComplianceFeeService.clearManualOverride(sub);
        return res.json(
          responseFormatter.success(serializeSubmission(sub), 'Compliance fee reset to default'),
        );
      }

      if (body.complianceFeeNGN === undefined || body.complianceFeeNGN === null) {
        return next(new AppError('complianceFeeNGN is required', 400));
      }

      if (sub.paymentStatus === 'paid') {
        return next(new AppError('Cannot change compliance fee after payment', 400));
      }

      await ComplianceFeeService.setManualFee(sub, body.complianceFeeNGN);
      res.json(responseFormatter.success(serializeSubmission(sub), 'Compliance fee updated'));
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const where: any = {};
      const role = authReq.user?.role;

      if (role === 'admin') {
        // all submissions
      } else if (role === 'acquirer') {
        const org = await Organization.findByPk((authReq.user as any).organizationId);
        if (org) {
          where[Op.or] = [
            { acquirerOrganizationId: org.id },
            { organizationId: org.id, createdByRole: 'acquirer' },
            { acquirerName: org.name },
          ];
        } else {
          where.id = '00000000-0000-0000-0000-000000000000';
        }
      } else {
        const orgId = (authReq.user as any).organizationId;
        where[Op.or] = [{ organizationId: orgId }, { partnerOrganizationId: orgId }];
      }

      const subs = await Submission.findAll({
        where,
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name'] },
          { model: Organization, as: 'partnerOrganization', attributes: ['id', 'name'] },
        ],
        order: [['submittedDate', 'DESC']],
      });
      res.json(responseFormatter.success(subs.map(serializeSubmission)));
    } catch (error) { next(error); }
  }

  static async getOne(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const sub = await Submission.findByPk(req.params.id as string, {
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name'] },
          { model: Organization, as: 'partnerOrganization', attributes: ['id', 'name'] },
        ],
      });
      if (!sub) return next(new AppError('Submission not found', 404));

      await assertCanAccessSubmission(authReq, sub);

      const serialized = serializeSubmission(sub) as Record<string, unknown>;
      const awaitingPayment =
        sub.status === 'approved' &&
        sub.paymentStatus !== 'paid' &&
        (!sub.renewalStatus || sub.renewalStatus === 'pending_payment');
      if (!sub.complianceFeeIsManual && awaitingPayment) {
        serialized.complianceFeeNGN = await ComplianceFeeService.getDefaultFeeNGN();
      }

      res.json(responseFormatter.success(serialized));
    } catch (error) { next(error); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const body = req.body as Record<string, unknown>;
      const isDraft = parseIsDraft(body);
      const role = authReq.user?.role as 'partner' | 'acquirer';
      const orgId = (authReq.user as any).organizationId;
      const initiatorOrg = await Organization.findByPk(orgId);
      if (!initiatorOrg) return next(new AppError('Organization not found', 404));

      const createdByRole = role === 'acquirer' ? 'acquirer' : 'partner';

      const submissionData: Record<string, unknown> = {
        ...pickSubmissionFields(body),
        organizationId: orgId,
        createdByRole,
        agreementUrl: files?.agreement?.[0]?.path,
        taxClearanceUrl: files?.taxClearance?.[0]?.path,
        status: isDraft ? 'draft' : 'pending_review',
        counterpartyStatus: 'linked',
      };

      if (createdByRole === 'acquirer') {
        submissionData.acquirerName = initiatorOrg.name;
        submissionData.acquirerOrganizationId = initiatorOrg.id;
      } else if (createdByRole === 'partner') {
        submissionData.partnerOrganizationId = initiatorOrg.id;
      }

      const submission = await Submission.create(
        submissionData as SubmissionCreationAttributes,
      );

      const techLabel = String(submission.technology || 'Technology submission');
      const counterparty = await InvitationService.resolveCounterparty({
        createdByRole,
        initiatorOrg,
        initiatorUserId: authReq.user!.id!,
        submissionId: submission.id,
        technologyLabel: techLabel,
        input: parseCounterpartyInput(body),
      });

      submission.partnerOrganizationId = counterparty.partnerOrganizationId ?? undefined;
      submission.acquirerOrganizationId = counterparty.acquirerOrganizationId ?? undefined;
      submission.invitedPartnerEmail = counterparty.invitedPartnerEmail ?? undefined;
      submission.invitedAcquirerEmail = counterparty.invitedAcquirerEmail ?? undefined;
      submission.invitedPartnerName = counterparty.invitedPartnerName ?? undefined;
      submission.invitedAcquirerName = counterparty.invitedAcquirerName ?? undefined;
      submission.counterpartyStatus = counterparty.counterpartyStatus;
      if (counterparty.acquirerName) submission.acquirerName = counterparty.acquirerName;
      if (createdByRole === 'partner') {
        submission.partnerOrganizationId = initiatorOrg.id;
      }

      await submission.save();

      if (submission.status !== 'draft') {
        await enqueueSubmissionProcessing(submission.id);
      }

      res.status(201).json(responseFormatter.success(serializeSubmission(submission), 'Submission created successfully', 201));
    } catch (error) { next(error); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const sub = await Submission.findByPk(req.params.id as string);
      if (!sub) return next(new AppError('Submission not found', 404));
      assertCanEditSubmission(authReq, sub);

      if (!['returned', 'draft'].includes(sub.status)) {
        return next(new AppError('Only returned or draft submissions can be edited', 400));
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const body = req.body as Record<string, unknown>;
      Object.assign(sub, pickSubmissionFields(body));

      if (files?.agreement?.[0]?.path) sub.agreementUrl = files.agreement[0].path;
      if (files?.taxClearance?.[0]?.path) sub.taxClearanceUrl = files.taxClearance[0].path;

      const isDraft = parseIsDraft(body);
      if (sub.status === 'returned' && !isDraft) {
        sub.status = 'pending_review';
        sub.reviewComment = undefined;
      } else if (isDraft) {
        sub.status = 'draft';
      } else if (sub.status === 'draft') {
        sub.status = 'pending_review';
        sub.reviewComment = undefined;
      }

      const orgId = (authReq.user as any).organizationId;
      const initiatorOrg = await Organization.findByPk(orgId);
      if (!initiatorOrg) return next(new AppError('Organization not found', 404));
      const createdByRole = (sub.createdByRole || (authReq.user?.role === 'acquirer' ? 'acquirer' : 'partner')) as 'partner' | 'acquirer';

      const counterparty = await InvitationService.resolveCounterparty({
        createdByRole,
        initiatorOrg,
        initiatorUserId: authReq.user!.id!,
        submissionId: sub.id,
        technologyLabel: sub.technology,
        input: parseCounterpartyInput(body),
        existing: sub,
      });

      sub.partnerOrganizationId = counterparty.partnerOrganizationId ?? undefined;
      sub.acquirerOrganizationId = counterparty.acquirerOrganizationId ?? undefined;
      sub.invitedPartnerEmail = counterparty.invitedPartnerEmail ?? undefined;
      sub.invitedAcquirerEmail = counterparty.invitedAcquirerEmail ?? undefined;
      sub.invitedPartnerName = counterparty.invitedPartnerName ?? undefined;
      sub.invitedAcquirerName = counterparty.invitedAcquirerName ?? undefined;
      sub.counterpartyStatus = counterparty.counterpartyStatus;
      if (counterparty.acquirerName) sub.acquirerName = counterparty.acquirerName;
      if (createdByRole === 'partner') sub.partnerOrganizationId = initiatorOrg.id;

      await sub.save();

      if (sub.status === 'pending_review') {
        await enqueueSubmissionProcessing(sub.id);
      }

      res.json(responseFormatter.success(serializeSubmission(sub), 'Submission updated successfully'));
    } catch (error) { next(error); }
  }

  static async review(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { action, comment, complianceFeeNGN } = req.body;
      const statusMap: Record<string, string> = {
        approve: 'approved',
        return: 'returned',
        reject: 'rejected'
      };

      if (!action || !statusMap[action]) {
        return next(new AppError('Invalid action', 400));
      }

      const sub = await Submission.findByPk(req.params.id as string);
      if (!sub) return next(new AppError('Submission not found', 404));

      const renewalReview = isRenewalAwaitingReview(sub);

      if (renewalReview) {
        sub.reviewComment = comment;
        if (action === 'approve') {
          sub.renewalStatus = 'pending_payment';
          sub.paymentStatus = 'unpaid';
          sub.remitaRrr = undefined;
          if (complianceFeeNGN !== undefined && complianceFeeNGN !== null && complianceFeeNGN !== '') {
            sub.complianceFeeNGN = validateComplianceFeeAmount(complianceFeeNGN);
            sub.complianceFeeIsManual = true;
          } else {
            await ComplianceFeeService.applyFeeOnApproval(sub);
          }
        } else if (action === 'return') {
          sub.renewalStatus = 'returned';
        } else {
          sub.renewalStatus = 'rejected';
        }
      } else {
        sub.status = statusMap[action] as any;
        sub.reviewComment = comment;

        if (action === 'approve') {
          if (complianceFeeNGN !== undefined && complianceFeeNGN !== null && complianceFeeNGN !== '') {
            sub.complianceFeeNGN = validateComplianceFeeAmount(complianceFeeNGN);
            sub.complianceFeeIsManual = true;
          } else {
            await ComplianceFeeService.applyFeeOnApproval(sub);
          }
          if (!sub.expiryDate) {
            const certDates = computeCertificateDatesFromAgreement(
              sub.effectiveDate,
              sub.expiryDate,
            );
            sub.effectiveDate = certDates.effectiveDate;
            sub.expiryDate = certDates.expiryDate;
          }
        }
      }

      await sub.save();

      // Notify users in the organization
      const users = await User.findAll({ where: { organizationId: sub.organizationId } });
      for (const user of users) {
        await NotificationService.send(
          user.id,
          `Submission ${action === 'approve' ? 'Approved' : action + 'ed'}`,
          `Your submission for ${sub.technology} has been ${statusMap[action]}. ${comment ? 'Comment: ' + comment : ''}`,
          'submission_update',
          `/partner/submissions`
        );
      }

      res.json(responseFormatter.success(serializeSubmission(sub), `Submission ${action}d successfully`));
    } catch (error) { next(error); }
  }

  /** Acquirer: request certificate renewal (re-enters NOTAP review) */
  static async requestRenewal(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const sub = await Submission.findByPk(req.params.id as string, {
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
      });
      if (!sub) return next(new AppError('Submission not found', 404));

      if (authReq.user?.role !== 'acquirer') {
        return next(new AppError('Only acquirers can request renewal', 403));
      }

      const org = await Organization.findByPk((authReq.user as any).organizationId);
      if (!org || sub.acquirerName !== org.name) {
        return next(new AppError('You do not have access to this submission', 403));
      }

      if (sub.status !== 'approved' || sub.paymentStatus !== 'paid' || !sub.certificateId) {
        return next(new AppError('Only active paid certificates can be renewed', 400));
      }

      if (sub.renewalStatus === 'pending_review' || sub.renewalStatus === 'pending_payment') {
        return next(new AppError('A renewal is already in progress for this certificate', 400));
      }

      const uploads = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const prevFee = filePath(uploads?.prevDoctorFee);
      const wht = filePath(uploads?.withholdingTax);
      const vat = filePath(uploads?.vatCertificate);

      if (!prevFee || !wht || !vat) {
        return next(
          new AppError(
            'All three renewal documents are required: previous NOTAP fee receipt, WHT certificate, and VAT certificate',
            400,
          ),
        );
      }

      const body = req.body as Record<string, unknown>;
      if (body.agreementFee !== undefined && body.agreementFee !== '') {
        sub.agreementFee = String(body.agreementFee);
      }
      if (body.currency) sub.currency = String(body.currency);

      const priorCertId = sub.certificateId;
      sub.isRenewal = true;
      sub.renewalStatus = 'pending_review';
      sub.renewalReference = generateRenewalReference();
      sub.previousCertificateId = priorCertId || undefined;
      sub.renewalPrevFeeReceiptUrl = prevFee;
      sub.renewalWhtCertificateUrl = wht;
      sub.renewalVatCertificateUrl = vat;
      const projectFeeDoc = filePath(uploads?.projectFee);
      if (projectFeeDoc) sub.renewalProjectFeeUrl = projectFeeDoc;

      sub.reviewComment = undefined;
      sub.submittedDate = new Date();
      await ComplianceFeeService.applyFeeOnRenewalRequest(sub);

      await sub.save();

      const users = await User.findAll({ where: { organizationId: sub.organizationId } });
      for (const user of users) {
        await NotificationService.send(
          user.id,
          'Certificate renewal requested',
          `${org.name} requested renewal (${sub.renewalReference}) for ${sub.technology}. Review the tax documents in NOTAP.`,
          'submission_update',
          '/partner/submissions',
        );
      }

      const serialized = serializeSubmission(sub);
      res.json(
        responseFormatter.success(
          serialized,
          'Renewal submitted for NOTAP review',
        ),
      );
    } catch (error) { next(error); }
  }
}
