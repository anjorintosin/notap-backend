import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class UsersController {
  static async listTeam(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const orgId = authReq.user?.organizationId;
      if (!orgId) {
        return res.json(responseFormatter.success([]));
      }
      const users = await UsersService.getOrgUsers(orgId);
      return res.json(
        responseFormatter.success(users.map((u) => UsersService.serializeUser(u))),
      );
    } catch (error) {
      next(error);
    }
  }

  static async inviteTeam(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const orgId = authReq.user?.organizationId;
      const tenantRole = authReq.user?.role as 'partner' | 'acquirer';
      if (!orgId || (tenantRole !== 'partner' && tenantRole !== 'acquirer')) {
        return res.status(403).json(responseFormatter.error('Forbidden', 403));
      }

      const { name, email, orgRoleId, department } = req.body;
      const user = await UsersService.inviteTeamMember({
        name,
        email,
        orgRoleId,
        organizationId: orgId,
        tenantRole,
        department,
      });
      return res
        .status(201)
        .json(
          responseFormatter.success(
            UsersService.serializeUser(user!),
            'Invitation sent. They will receive an email to set their password.',
            201,
          ),
        );
    } catch (error) {
      next(error);
    }
  }

  static async updateTeamMember(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const orgId = authReq.user?.organizationId;
      const tenantRole = authReq.user?.role as 'partner' | 'acquirer';
      if (!orgId) return res.status(403).json(responseFormatter.error('Forbidden', 403));

      const user = await UsersService.updateTeamMember(
        String(req.params.id),
        orgId,
        tenantRole,
        req.body,
      );
      return res.json(responseFormatter.success(UsersService.serializeUser(user!), 'User updated'));
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const role = (req.query.role as string) || 'admin';
      if (role !== 'admin') {
        return res.status(400).json(responseFormatter.error('Staff management only lists NOTAP admin users', 400));
      }
      const users = await UsersService.getAllUsers('admin');
      return res.json(
        responseFormatter.success(users.map((u) => UsersService.serializeUser(u))),
      );
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, orgRoleId, department } = req.body;
      const user = await UsersService.inviteAdminStaff({
        name,
        email,
        orgRoleId,
        department,
      });
      return res
        .status(201)
        .json(
          responseFormatter.success(
            UsersService.serializeUser(user!),
            'Invitation sent. The user will receive an email to set their password.',
            201,
          ),
        );
    } catch (error) {
      next(error);
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await UsersService.getUserById(String(req.params.id));
      if (existing.role !== 'admin') {
        return res.status(404).json(responseFormatter.error('User not found', 404));
      }
      const user = await UsersService.toggleUserStatus(req.params.id as string);
      return res.json(responseFormatter.success(UsersService.serializeUser(user!), 'User status updated'));
    } catch (error) {
      next(error);
    }
  }

  static async updateAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.getUserById(String(req.params.id));
      if (user.role !== 'admin') {
        return res.status(404).json(responseFormatter.error('User not found', 404));
      }

      if (req.body.orgRoleId) {
        await UsersService.assertOrgRoleAssignable(req.body.orgRoleId, 'admin', null);
      }

      const { UsersRepository } = await import('./users.repository');
      await UsersRepository.update(user.id, {
        ...(req.body.name && { name: req.body.name }),
        ...(req.body.orgRoleId && { orgRoleId: req.body.orgRoleId }),
        ...(req.body.department !== undefined && { department: req.body.department }),
        ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
      });

      const updated = await UsersService.getAllUsers('admin');
      const found = updated.find((u) => u.id === user.id);
      return res.json(responseFormatter.success(UsersService.serializeUser(found || user)));
    } catch (error) {
      next(error);
    }
  }
}
