import bcrypt from 'bcrypt';
import User from '../../modules/users/users.model';
import { Permission } from '../../modules/rbac/permission.model';
import { RbacService } from '../../modules/rbac/rbac.service';
import logger from '../utils/logger';

export function shouldSeedAdmin(): boolean {
  return process.env.SEED_ADMIN === 'true';
}

export function getDefaultAdminEmail(): string {
  return process.env.SEED_ADMIN_EMAIL?.trim() || 'admin@notap.gov.ng';
}

export function getDefaultAdminPassword(): string {
  return process.env.SEED_ADMIN_PASSWORD || 'password123';
}

/** Creates default NOTAP admin if missing. Returns true when a new user was created. */
export async function ensureDefaultAdmin(): Promise<boolean> {
  const adminEmail = getDefaultAdminEmail();
  const existingAdmin = await User.findOne({ where: { email: adminEmail } });

  if (existingAdmin) {
    return false;
  }

  const passwordHash = await bcrypt.hash(getDefaultAdminPassword(), 10);

  const permCount = await Permission.count();
  if (permCount === 0) {
    await RbacService.seedPermissions();
    await RbacService.ensurePlatformRoles();
  }

  const user = await User.create({
    name: process.env.SEED_ADMIN_NAME || 'NOTAP Administrator',
    email: adminEmail,
    passwordHash,
    role: 'admin',
    isActive: true,
    passwordSetAt: new Date(),
    emailVerified: true,
  });

  await RbacService.assignOwnerRoleToUser(user);

  logger.info(`Default admin user created (${adminEmail}). Change the password after first login.`);
  return true;
}
