import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';
import { RbacController } from './rbac.controller';

const router = Router();

router.use(authenticate, loadPermissions);

router.get('/permissions', RbacController.listPermissions);
router.get(
  '/roles',
  requirePermission('users.view', 'users.manage_roles', 'users.invite'),
  RbacController.listRoles,
);
router.get(
  '/roles/:id',
  requirePermission('users.view', 'users.manage_roles'),
  RbacController.getRole,
);
router.post('/roles', requirePermission('users.manage_roles'), RbacController.createRole);
router.patch('/roles/:id', requirePermission('users.manage_roles'), RbacController.updateRole);
router.delete('/roles/:id', requirePermission('users.manage_roles'), RbacController.deleteRole);

export default router;
