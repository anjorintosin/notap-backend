import { Submission } from '../../modules/submissions/submissions.model';
import {
  PlatformSettings,
  PLATFORM_SETTINGS_ID,
} from '../../modules/settings/platform-settings.model';
import { AppError } from '../utils/app-error';

const FALLBACK_FEE_NGN = 150000;
const MAX_FEE_NGN = 50_000_000;

export function validateComplianceFeeAmount(amount: unknown): number {
  const num = Math.round(Number(amount));
  if (!Number.isFinite(num) || num <= 0) {
    throw new AppError('Compliance fee must be a positive amount in NGN', 400);
  }
  if (num > MAX_FEE_NGN) {
    throw new AppError(`Compliance fee cannot exceed ₦${MAX_FEE_NGN.toLocaleString()}`, 400);
  }
  return num;
}

export class ComplianceFeeService {
  static async ensureSettingsRow(): Promise<PlatformSettings> {
    let row = await PlatformSettings.findByPk(PLATFORM_SETTINGS_ID);
    if (!row) {
      row = await PlatformSettings.create({
        id: PLATFORM_SETTINGS_ID,
        defaultComplianceFeeNGN: FALLBACK_FEE_NGN,
      });
    }
    return row;
  }

  static async getDefaultFeeNGN(): Promise<number> {
    const row = await this.ensureSettingsRow();
    const fee = Number(row.defaultComplianceFeeNGN);
    return Number.isFinite(fee) && fee > 0 ? Math.round(fee) : FALLBACK_FEE_NGN;
  }

  static async getSettingsForAdmin() {
    const row = await this.ensureSettingsRow();
    return {
      defaultComplianceFeeNGN: Math.round(Number(row.defaultComplianceFeeNGN)),
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
  }

  static async updateDefaultFeeNGN(amount: number, updatedByUserId?: string) {
    const fee = validateComplianceFeeAmount(amount);
    const row = await this.ensureSettingsRow();
    row.defaultComplianceFeeNGN = fee;
    row.updatedByUserId = updatedByUserId ?? null;
    await row.save();
    return this.getSettingsForAdmin();
  }

  static async resolveFeeForSubmission(sub: Submission): Promise<number> {
    if (sub.complianceFeeIsManual && sub.complianceFeeNGN != null) {
      const manual = Math.round(Number(sub.complianceFeeNGN));
      if (Number.isFinite(manual) && manual > 0) return manual;
    }
    return this.getDefaultFeeNGN();
  }

  /** Set compliance fee from global default unless admin has set a manual override. */
  static async applyFeeOnApproval(sub: Submission): Promise<void> {
    if (sub.complianceFeeIsManual) return;
    sub.complianceFeeNGN = await this.getDefaultFeeNGN();
  }

  static async setManualFee(sub: Submission, amount: number): Promise<void> {
    sub.complianceFeeNGN = validateComplianceFeeAmount(amount);
    sub.complianceFeeIsManual = true;
    await sub.save();
  }

  static async clearManualOverride(sub: Submission): Promise<void> {
    sub.complianceFeeIsManual = false;
    sub.complianceFeeNGN = await this.getDefaultFeeNGN();
    await sub.save();
  }

  static async applyFeeOnRenewalRequest(sub: Submission): Promise<void> {
    if (sub.complianceFeeIsManual) return;
    sub.complianceFeeNGN = await this.getDefaultFeeNGN();
  }
}
