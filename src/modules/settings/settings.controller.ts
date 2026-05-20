import { Request, Response, NextFunction } from 'express';
import { ComplianceFeeService } from '../../shared/services/compliance-fee.service';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class SettingsController {
  static async getComplianceFee(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceFeeService.getSettingsForAdmin();
      res.json(responseFormatter.success(data));
    } catch (error) {
      next(error);
    }
  }

  static async updateComplianceFee(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { defaultComplianceFeeNGN } = req.body;
      const data = await ComplianceFeeService.updateDefaultFeeNGN(
        defaultComplianceFeeNGN,
        authReq.user?.id,
      );
      res.json(responseFormatter.success(data, 'Default compliance fee updated'));
    } catch (error) {
      next(error);
    }
  }
}
