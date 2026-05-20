import { Request, Response, NextFunction } from 'express';
import { Submission } from '../submissions/submissions.model';
import { Organization } from '../organizations/organizations.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AppError } from '../../shared/utils/app-error';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { RemitaService } from '../../shared/services/remita.service';
import { ComplianceFeeService } from '../../shared/services/compliance-fee.service';
import { CertificateVerificationService } from '../../shared/services/certificate-verification.service';
import {
  applyRenewalCertificateDates,
  computeCertificateDatesFromAgreement,
} from '../../shared/utils/certificate-validity';
import logger from '../../shared/utils/logger';

function applyRenewalPaymentCompletion(sub: Submission): void {
  if (sub.certificateId && !sub.previousCertificateId) {
    sub.previousCertificateId = sub.certificateId;
  }
  sub.certificateId = `CERT-${new Date().getFullYear()}-${sub.id.slice(0, 8).toUpperCase()}`;
  const renewalDates = applyRenewalCertificateDates(sub);
  sub.effectiveDate = renewalDates.effectiveDate;
  sub.expiryDate = renewalDates.expiryDate;
  sub.renewalStatus = null;
  CertificateVerificationService.issueVerificationCredentials(sub);
}

export class PaymentsController {
  /** Fix rows where renewal fee was paid but renewalStatus was not cleared (e.g. Sequelize undefined). */
  static async repairStuckRenewalPayments(): Promise<number> {
    const stuck = await Submission.findAll({
      where: { paymentStatus: 'paid', renewalStatus: 'pending_payment' },
    });
    for (const sub of stuck) {
      applyRenewalPaymentCompletion(sub);
      await sub.save();
    }
    return stuck.length;
  }

  static async initiate(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { submissionId, method } = req.body;
      const sub = await Submission.findByPk(submissionId, {
        include: [{ model: Organization, as: 'organization', attributes: ['name'] }],
      });

      if (!sub) return next(new AppError('Submission not found', 404));
      if (sub.status !== 'approved') {
        return next(new AppError('Only approved submissions can be paid for', 400));
      }
      if (sub.renewalStatus && sub.renewalStatus !== 'pending_payment') {
        return next(new AppError('Compliance fee payment is not available for this submission yet', 400));
      }

      const user = authReq.user as { name?: string; email?: string };
      // Non-manual fees always use the current platform default (e.g. after admin changes global fee).
      let amount: number;
      if (sub.complianceFeeIsManual && Number(sub.complianceFeeNGN) > 0) {
        amount = Math.round(Number(sub.complianceFeeNGN));
      } else {
        amount = await ComplianceFeeService.getDefaultFeeNGN();
        sub.complianceFeeNGN = amount;
        sub.complianceFeeIsManual = false;
      }

      sub.paymentMethod = method === 'bank_transfer' ? 'bank_transfer' : 'remita';
      sub.paymentStatus = 'pending';

      let rrr = sub.remitaRrr || null;
      let paymentUrl: string | null = null;
      let simulated = false;

      if (sub.paymentMethod === 'remita') {
        const result = await RemitaService.generateRRR({
          orderId: sub.id,
          amount,
          payerName: user?.name || sub.acquirerName,
          payerEmail: user?.email || 'payments@notap.gov.ng',
          description: `NOTAP compliance fee — ${sub.technology}`,
        });
        rrr = result.rrr;
        paymentUrl = result.paymentUrl || null;
        simulated = result.simulated;
        sub.remitaRrr = rrr;
      }

      await sub.save();

      res.json(responseFormatter.success({
        submissionId: sub.id,
        rrr,
        paymentUrl,
        amount: sub.complianceFeeNGN,
        method: sub.paymentMethod,
        simulated,
        remitaConfigured: RemitaService.configured(),
      }, 'Payment initiated successfully'));
    } catch (error) { next(error); }
  }

  static async verify(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { submissionId } = req.body;
      const sub = await Submission.findByPk(submissionId, {
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
      });

      if (!sub) return next(new AppError('Submission not found', 404));

      if (sub.paymentStatus === 'paid') {
        if (sub.renewalStatus === 'pending_payment') {
          applyRenewalPaymentCompletion(sub);
          await sub.save();
          const plain = sub.get({ plain: true }) as unknown as Record<string, unknown>;
          plain.localPartnerName = (sub as any).organization?.name;
          return res.json(
            responseFormatter.success(plain, 'Renewal payment completed and certificate updated'),
          );
        }
        return res.json(responseFormatter.success({
          ...sub.get({ plain: true }),
          localPartnerName: (sub as any).organization?.name,
        }, 'Payment already verified'));
      }

      if (sub.paymentMethod === 'remita' && sub.remitaRrr) {
        const check = await RemitaService.verifyRRR(sub.remitaRrr);
        if (!check.paid && !check.simulated) {
          return next(new AppError('Payment not confirmed on Remita yet. Complete payment, then try again.', 402));
        }
      } else if (sub.paymentMethod === 'bank_transfer') {
        // Manual bank transfer — acquirer confirms; admin may verify later in production
        logger.info(`Bank transfer verification for submission ${submissionId} by ${authReq.user?.id}`);
      }

      const isRenewalPayment = sub.renewalStatus === 'pending_payment';

      sub.paymentStatus = 'paid';

      if (isRenewalPayment) {
        applyRenewalPaymentCompletion(sub);
      } else {
        const issuedNewCertId = !sub.certificateId;
        if (issuedNewCertId) {
          sub.certificateId = `CERT-${new Date().getFullYear()}-${sub.id.slice(0, 8).toUpperCase()}`;
        }
        if (!sub.expiryDate) {
          const initialDates = computeCertificateDatesFromAgreement(
            sub.effectiveDate,
            sub.expiryDate,
          );
          sub.effectiveDate = initialDates.effectiveDate;
          sub.expiryDate = initialDates.expiryDate;
        }
        if (issuedNewCertId || !sub.certificateVerificationToken) {
          CertificateVerificationService.issueVerificationCredentials(sub);
        }
      }

      await sub.save();

      const plain = sub.get({ plain: true }) as unknown as Record<string, unknown>;
      plain.localPartnerName = (sub as any).organization?.name;

      res.json(responseFormatter.success(plain, 'Payment verified and certificate activated'));
    } catch (error) { next(error); }
  }
}
