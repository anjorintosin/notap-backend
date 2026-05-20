import { Notification } from '../../modules/notifications/notifications.model';
import { User } from '../../modules/users/users.model';

export class NotificationService {
  static async send(userId: string, title: string, message: string, type: any, link?: string) {
    try {
      // 1. Save In-App Notification
      await Notification.create({
        userId,
        title,
        message,
        type,
        link,
        isRead: false
      });

      // 2. Mock Email Logic
      const user = await User.findByPk(userId);
      if (user) {
        console.log(`[EMAIL SENT to ${user.email}]: ${title} - ${message}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  static async broadcastToAdmins(title: string, message: string, link?: string) {
    const admins = await User.findAll({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.send(admin.id, title, message, 'system_alert', link);
    }
  }
}
