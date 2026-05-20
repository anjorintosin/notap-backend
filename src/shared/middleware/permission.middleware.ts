import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AppError } from '../utils/app-error';
import { RbacService } from '../../modules/rbac/rbac.service';

export const loadPermissions = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user?.id) return next();

  try {
    if (authReq.user.permissions) return next();

    const ctx = await RbacService.getUserAuthContext(authReq.user.id);
    authReq.user.orgRoleId = ctx.orgRoleId ?? undefined;
    authReq.user.orgRoleName = ctx.orgRoleName ?? undefined;
    authReq.user.isOwner = ctx.isOwner;
    authReq.user.permissions = ctx.permissions;
    next();
  } catch (error) {
    next(error);
  }
};

export const requirePermission =
  (...codes: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return next(new AppError('Unauthorized', 401));
    }

    if (!authReq.user.permissions) {
      await loadPermissions(req, res, () => {});
    }

    if (authReq.user.isOwner) return next();

    const granted = authReq.user.permissions || [];
    const ok = codes.some((c) => granted.includes(c));
    if (!ok) {
      return next(new AppError('Forbidden: You do not have permission to perform this action', 403));
    }
    next();
  };

export const requireAnyPermission = requirePermission;
