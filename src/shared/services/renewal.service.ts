import cron from 'node-cron';
import { Submission } from '../../modules/submissions/submissions.model';
import { User } from '../../modules/users/users.model';
import { NotificationService } from './notification.service';
import { Op } from 'sequelize';

export class RenewalService {
  static init() {
    // Run daily at midnight
    cron.schedule('0 0 * * *', () => {
      console.log('Running daily expiry check...');
      this.checkExpiries();
    });
  }

  static async checkExpiries() {
    const intervals = [90, 60, 30, 7, 1]; // Days before expiry to notify
    
    for (const days of intervals) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      
      // Reset hours to start/end of day for matching
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const expiringSubmissions = await Submission.findAll({
        where: {
          paymentStatus: 'paid',
          expiryDate: {
            [Op.between]: [startOfDay, endOfDay]
          }
        }
      });

      for (const submission of expiringSubmissions) {
        // Notify organization users
        const users = await User.findAll({ where: { organizationId: submission.organizationId } });
        for (const user of users) {
          await NotificationService.send(
            user.id,
            'Certificate Expiring Soon',
            `The certificate for ${submission.technology} (${submission.id}) will expire in ${days} days. Please initiate a renewal.`,
            'payment_reminder',
            `/partner/submissions/${submission.id}`
          );
        }
      }
    }
  }
}
