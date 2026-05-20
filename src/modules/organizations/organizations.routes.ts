import { Router } from 'express';
import { OrganizationsController } from './organizations.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';

const router = Router();

router.post('/', OrganizationsController.create);

router.get('/acquirers', authenticate, authorize('partner', 'admin', 'acquirer'), OrganizationsController.listActiveAcquirers);
router.get('/partners', authenticate, authorize('acquirer', 'admin', 'partner'), OrganizationsController.listActivePartners);
router.get('/me', authenticate, OrganizationsController.getMine);

router.use(authenticate, loadPermissions, authorize('admin'));

router.get('/', requirePermission('registrations.review'), OrganizationsController.list);
router.patch('/:id/approve', requirePermission('registrations.review'), OrganizationsController.approve);
router.patch('/:id/reject', requirePermission('registrations.review'), OrganizationsController.reject);

export default router;
