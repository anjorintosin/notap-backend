import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { RbacService } from './rbac.service';
import { AppError } from '../../shared/utils/app-error';
import { User } from '../users/users.model';

export class RbacController {
  static async listPermissions(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const scope = RbacService.scopeForTenant(authReq.user!.role as 'admin' | 'partner' | 'acquirer');
      const rows = await RbacService.listPermissions(scope);
      res.json(
        responseFormatter.success(
          rows.map((p) => ({
            id: p.id,
            code: p.code,
            label: p.label,
            description: p.description,
            module: p.module,
            scope: p.scope,
          })),
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  static async listRoles(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const tenantRole = authReq.user!.role as 'admin' | 'partner' | 'acquirer';
      const orgId = tenantRole === 'admin' ? null : authReq.user!.organizationId;
      const roles = await RbacService.listRolesForCaller(tenantRole, orgId);
      const withCounts = await Promise.all(
        roles.map(async (role) => {
          const full = await RbacService.getRoleById(role.id);
          const userCount = await User.count({
            where: { orgRoleId: role.id },
          });
          return { ...RbacService.serializeRole(full!), userCount };
        }),
      );
      res.json(responseFormatter.success(withCounts));
    } catch (error) {
      next(error);
    }
  }

  static async getRole(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const role = await RbacService.getRoleById(String(req.params.id));
      if (!role) throw new AppError('Role not found', 404);
      RbacService.assertRoleInScope(
        role,
        authReq.user!.role as 'admin' | 'partner' | 'acquirer',
        authReq.user!.organizationId,
      );
      res.json(responseFormatter.success(RbacService.serializeRole(role)));
    } catch (error) {
      next(error);
    }
  }

  static async createRole(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const tenantRole = authReq.user!.role as 'admin' | 'partner' | 'acquirer';
      const orgId = tenantRole === 'admin' ? null : authReq.user!.organizationId ?? null;
      const { name, description, permissionIds } = req.body;
      if (!name?.trim()) throw new AppError('Role name is required', 400);

      const role = await RbacService.createCustomRole(tenantRole, orgId, {
        name: name.trim(),
        description,
        permissionIds: permissionIds || [],
      });
      res.status(201).json(responseFormatter.success(RbacService.serializeRole(role), 'Role created', 201));
    } catch (error) {
      next(error);
    }
  }

  static async updateRole(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const role = await RbacService.getRoleById(String(req.params.id));
      if (!role) throw new AppError('Role not found', 404);
      RbacService.assertRoleInScope(
        role,
        authReq.user!.role as 'admin' | 'partner' | 'acquirer',
        authReq.user!.organizationId,
      );

      const updated = await RbacService.updateRole(
        role,
        authReq.user!.role as 'admin' | 'partner' | 'acquirer',
        {
          name: req.body.name,
          description: req.body.description,
          permissionIds: req.body.permissionIds,
        },
      );
      res.json(responseFormatter.success(RbacService.serializeRole(updated), 'Role updated'));
    } catch (error) {
      next(error);
    }
  }

  static async deleteRole(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const role = await RbacService.getRoleById(String(req.params.id));
      if (!role) throw new AppError('Role not found', 404);
      RbacService.assertRoleInScope(
        role,
        authReq.user!.role as 'admin' | 'partner' | 'acquirer',
        authReq.user!.organizationId,
      );
      await RbacService.deleteRole(role);
      res.json(responseFormatter.success(null, 'Role deleted'));
    } catch (error) {
      next(error);
    }
  }
}
