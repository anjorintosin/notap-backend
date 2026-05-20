import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';

const router = Router();

router.use(authenticate, loadPermissions, authorize('admin'), requirePermission('analytics.view'));

router.get('/dashboard', AnalyticsController.getDashboardAnalytics);

export default router;
