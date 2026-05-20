import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
import { AppError } from '../utils/app-error';

// Use a type instead of an interface to avoid direct conflict with Express.Request
export type AuthRequest = Request & {
  user?: {
    id: string;
    role: string;
    email: string;
    organizationId?: string;
    orgRoleId?: string;
    orgRoleName?: string;
    isOwner?: boolean;
    permissions?: string[];
  };
};

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: No token provided', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded: any = AuthService.verifyAccessToken(token);
    // Use an index signature or cast to bypass the Express.user conflict
    (req as any).user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};
