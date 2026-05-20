import crypto from 'crypto';
import { Op } from 'sequelize';
import { Submission } from '../../modules/submissions/submissions.model';
import { Organization } from '../../modules/organizations/organizations.model';

export type CertificateLifecycleStatus = 'active' | 'expiring_soon' | 'expired';

function parseExpiryDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const isoDay = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    const [y, m, d] = isoDay.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getCertificateLifecycleStatus(expiryDate?: Date | string | null): CertificateLifecycleStatus {
  const expiry = parseExpiryDate(expiryDate);
  if (!expiry) return 'active';
  const daysLeft = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return 'expired';
  if (daysLeft < 90) return 'expiring_soon';
  return 'active';
}

export class CertificateVerificationService {
  static issueVerificationCredentials(sub: Submission): void {
    sub.certificateVerificationToken = crypto.randomUUID();
    sub.certificateIssuedAt = new Date();
  }

  static async backfillMissingTokens(): Promise<number> {
    const rows = await Submission.findAll({
      where: {
        paymentStatus: 'paid',
        certificateVerificationToken: { [Op.is]: null },
      },
    });

    let count = 0;
    for (const sub of rows) {
      if (!sub.certificateId) continue;
      sub.certificateVerificationToken = crypto.randomUUID();
      if (!sub.certificateIssuedAt) {
        sub.certificateIssuedAt = sub.updatedAt || new Date();
      }
      await sub.save();
      count += 1;
    }
    return count;
  }

  static async verifyByToken(token: string) {
    const sub = await Submission.findOne({
      where: { certificateVerificationToken: token },
      include: [
        { model: Organization, as: 'organization', attributes: ['name'] },
        { model: Organization, as: 'partnerOrganization', attributes: ['name'] },
      ],
    });

    if (!sub || sub.paymentStatus !== 'paid' || !sub.certificateId) {
      return null;
    }

    const partnerOrg = (sub as any).partnerOrganization as Organization | undefined;
    const submitOrg = (sub as any).organization as Organization | undefined;
    const localPartnerName =
      partnerOrg?.name ??
      (sub.createdByRole === 'partner' ? submitOrg?.name : null) ??
      null;

    const status = getCertificateLifecycleStatus(sub.expiryDate);

    return {
      valid: true,
      status,
      certificateId: sub.certificateId,
      technology: sub.technology,
      acquirerName: sub.acquirerName,
      oemName: sub.oemName,
      localPartnerName,
      issuedAt: sub.certificateIssuedAt || sub.updatedAt,
      expiresAt: sub.expiryDate,
    };
  }
}
