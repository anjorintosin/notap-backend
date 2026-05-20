import { Router, Response, NextFunction } from 'express';
import { Notification } from './notifications.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { authenticate, AuthRequest } from '../../shared/middleware/auth.middleware';

import { User } from '../users/users.model';

const router = Router();

router.use(authenticate);

// Admin only: Get all notifications (for announcements view)
router.get('/all', async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json(responseFormatter.error('Unauthorized', 403));
    const notifications = await Notification.findAll({ 
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json(responseFormatter.success(notifications));
  } catch (error) { next(error); }
});

// Admin only: Broadcast notification
router.post('/broadcast', async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json(responseFormatter.error('Unauthorized', 403));
    const { title, message, target, type = 'system_alert' } = req.body;
    
    let userWhere: any = { isActive: true };
    if (target === 'partners') userWhere.role = 'partner';
    if (target === 'acquirers') userWhere.role = 'acquirer';

    const users = await User.findAll({ where: userWhere });
    
    const notifications = users.map(user => ({
      userId: user.id,
      title,
      message,
      type: type as any
    }));

    await Notification.bulkCreate(notifications);
    
    res.json(responseFormatter.success(null, `Broadcast sent to ${users.length} users`));
  } catch (error) { next(error); }
});

router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const notifications = await Notification.findAll({ 
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(responseFormatter.success(notifications));
  } catch (error) { next(error); }
});

router.patch('/:id/read', async (req: any, res: Response, next: NextFunction) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return res.status(404).json(responseFormatter.error('Notification not found', 404));
    
    notification.isRead = true;
    await notification.save();
    
    res.json(responseFormatter.success(notification));
  } catch (error) { next(error); }
});

export default router;
