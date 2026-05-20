import { Request, Response, NextFunction } from 'express';
import { CertificateVerificationService } from '../../shared/services/certificate-verification.service';
import { responseFormatter } from '../../shared/utils/response-formatter';

export class VerificationController {
  static async verifyCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) {
        return res.status(404).json(
          responseFormatter.error('Certificate not found', 404, { valid: false, reason: 'not_found' }),
        );
      }

      const result = await CertificateVerificationService.verifyByToken(token);
      if (!result) {
        return res.status(404).json(
          responseFormatter.error('Certificate not found', 404, { valid: false, reason: 'not_found' }),
        );
      }

      res.json(responseFormatter.success(result));
    } catch (error) {
      next(error);
    }
  }
}
