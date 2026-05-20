import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';

const router = Router();

router.get(
  '/team',
  authenticate,
  loadPermissions,
  authorize('partner', 'acquirer'),
  requirePermission('users.view'),
  UsersController.listTeam,
);

router.post(
  '/team/invite',
  authenticate,
  loadPermissions,
  authorize('partner', 'acquirer'),
  requirePermission('users.invite'),
  UsersController.inviteTeam,
);

router.patch(
  '/team/:id',
  authenticate,
  loadPermissions,
  authorize('partner', 'acquirer'),
  requirePermission('users.edit'),
  UsersController.updateTeamMember,
);

router.use(authenticate, loadPermissions, authorize('admin'));

router.get('/', requirePermission('users.view'), UsersController.list);
router.post('/', requirePermission('users.invite'), UsersController.create);
router.patch('/:id', requirePermission('users.edit'), UsersController.updateAdminUser);
router.patch('/:id/toggle-status', requirePermission('users.edit'), UsersController.toggleStatus);

export default router;
