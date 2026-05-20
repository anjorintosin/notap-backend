import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AppError } from '../utils/app-error';

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return next(new AppError('Unauthorized: User not authenticated', 401));
    }

    if (!roles.includes(authReq.user.role)) {
      return next(new AppError('Forbidden: You do not have permission to perform this action', 403));
    }

    next();
  };
};
