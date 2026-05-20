import { Request, Response, NextFunction } from 'express';
import { Submission } from '../submissions/submissions.model';
import { Organization } from '../organizations/organizations.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import sequelize from '../../config/database';
import { Op } from 'sequelize';

export class AnalyticsController {
  static async getDashboardAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Submissions over time (Last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const trends = await Submission.findAll({
        attributes: [
          [sequelize.fn('date_trunc', 'month', sequelize.col('createdAt')), 'month'],
          [sequelize.fn('count', sequelize.col('id')), 'count']
        ],
        where: {
          createdAt: { [Op.gte]: sixMonthsAgo }
        },
        group: [sequelize.fn('date_trunc', 'month', sequelize.col('createdAt'))],
        order: [[sequelize.fn('date_trunc', 'month', sequelize.col('createdAt')), 'ASC']]
      });

      // 2. Industry/Category Distribution
      const distribution = await Submission.findAll({
        attributes: [
          'technology', // Temporary until we have industry field
          [sequelize.fn('count', sequelize.col('id')), 'count']
        ],
        group: ['technology'],
        limit: 5
      });

      // 3. Organization Type Distribution
      const orgTypes = await Organization.findAll({
        attributes: [
          'type',
          [sequelize.fn('count', sequelize.col('id')), 'count']
        ],
        group: ['type']
      });

      res.json(responseFormatter.success({
        submissionTrends: trends,
        industryDistribution: distribution,
        organizationTypes: orgTypes
      }));
    } catch (error) { next(error); }
  }
}
