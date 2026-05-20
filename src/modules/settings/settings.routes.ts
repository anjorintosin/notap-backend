import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';

const router = Router();

router.use(authenticate, loadPermissions, authorize('admin'));

router.get('/compliance-fee', requirePermission('settings.compliance_fee'), SettingsController.getComplianceFee);
router.put('/compliance-fee', requirePermission('settings.compliance_fee'), SettingsController.updateComplianceFee);

export default router;
