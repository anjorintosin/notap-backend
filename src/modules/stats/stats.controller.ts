import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Submission } from '../submissions/submissions.model';
import { User } from '../users/users.model';
import { Organization } from '../organizations/organizations.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class StatsController {
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { role } = authReq.user as any;
      const orgId = (authReq.user as any).organizationId;

      let stats: any = {};

      const pendingReviewWhere = {
        [Op.or]: [
          { status: 'pending_review' },
          { renewalStatus: 'pending_review' },
        ],
      };

      if (role === 'admin') {
        stats = {
          totalSubmissions: await Submission.count(),
          pendingReview: await Submission.count({ where: pendingReviewWhere }),
          approved: await Submission.count({ where: { status: 'approved' } }),
          totalOrganizations: await Organization.count(),
          totalUsers: await User.count()
        };
      } else if (role === 'acquirer') {
        const org = await Organization.findByPk(orgId);
        const acquirerWhere = org ? { acquirerName: org.get('name') as string } : { id: '00000000-0000-0000-0000-000000000000' };
        stats = {
          totalSubmissions: await Submission.count({ where: acquirerWhere }),
          pendingReview: await Submission.count({ where: { ...acquirerWhere, ...pendingReviewWhere } }),
          approved: await Submission.count({ where: { ...acquirerWhere, status: 'approved' } }),
          approvedUnpaid: await Submission.count({
            where: { ...acquirerWhere, status: 'approved', paymentStatus: { [Op.ne]: 'paid' } },
          }),
          paid: await Submission.count({ where: { ...acquirerWhere, paymentStatus: 'paid' } }),
        };
      } else {
        stats = {
          totalSubmissions: await Submission.count({ where: { organizationId: orgId } }),
          pendingReview: await Submission.count({ where: { organizationId: orgId, ...pendingReviewWhere } }),
          approved: await Submission.count({ where: { organizationId: orgId, status: 'approved' } }),
          paid: await Submission.count({ where: { organizationId: orgId, paymentStatus: 'paid' } }),
        };
      }

      res.json(responseFormatter.success(stats));
    } catch (error) { next(error); }
  }
}
