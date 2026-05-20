import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../users/users.model';
import { AppError } from '../../shared/utils/app-error';
import { RbacService } from '../rbac/rbac.service';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
  }

  static async buildSessionPayload(user: User) {
    const ctx = await RbacService.getUserAuthContext(user.id);
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      organizationId: user.organizationId,
      orgRoleId: ctx.orgRoleId ?? undefined,
      orgRoleName: ctx.orgRoleName ?? undefined,
      isOwner: ctx.isOwner,
      permissions: ctx.permissions,
    };
  }

  static generateTokens(session: {
    id: string;
    role: string;
    email: string;
    organizationId?: string;
    orgRoleId?: string;
    orgRoleName?: string;
    isOwner?: boolean;
    permissions?: string[];
  }) {
    const accessToken = jwt.sign(
      {
        id: session.id,
        role: session.role,
        email: session.email,
        organizationId: session.organizationId,
        orgRoleId: session.orgRoleId,
        orgRoleName: session.orgRoleName,
        isOwner: session.isOwner ?? false,
        permissions: session.permissions ?? [],
      },
      JWT_SECRET as jwt.Secret,
      { expiresIn: JWT_EXPIRES_IN as any },
    );

    const refreshToken = jwt.sign(
      { id: session.id },
      REFRESH_TOKEN_SECRET as jwt.Secret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN as any },
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new AppError('Invalid or expired access token', 401);
    }
  }

  static verifyRefreshToken(token: string) {
    try {
      return jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }
}
