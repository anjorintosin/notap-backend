import sequelize from './config/database';
import { setupAssociations } from './config/associations';
import { startWorker } from './config/queue';
import { RenewalService } from './shared/services/renewal.service';
import { ComplianceFeeService } from './shared/services/compliance-fee.service';
import { CertificateVerificationService } from './shared/services/certificate-verification.service';
import { RbacService } from './modules/rbac/rbac.service';
import { UsersService } from './modules/users/users.service';
import { PaymentsController } from './modules/payments/payments.controller';
import { ensureDefaultAdmin, shouldSeedAdmin } from './shared/services/admin-seed.service';
import logger from './shared/utils/logger';

export type BootstrapMode = 'server' | 'serverless';

let bootstrapPromise: Promise<void> | null = null;

export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

export function shouldRunQueueWorker(): boolean {
  if (process.env.ENABLE_QUEUE_WORKER === 'false') return false;
  if (process.env.ENABLE_QUEUE_WORKER === 'true') return true;
  return !isServerlessRuntime();
}

export function shouldSyncAlter(): boolean {
  if (process.env.DB_SYNC_ALTER === 'true') return true;
  if (process.env.DB_SYNC_ALTER === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export async function runBootstrap(mode: BootstrapMode = 'server'): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    setupAssociations();
    await sequelize.authenticate();
    await RbacService.ensurePermissionSchema();

    if (shouldSyncAlter()) {
      await sequelize.sync({ alter: true });
      await RbacService.ensurePermissionSchema();
    }

    await ComplianceFeeService.ensureSettingsRow();
    await RbacService.seedPermissions();
    await RbacService.ensurePlatformRoles();

    if (shouldSeedAdmin()) {
      await ensureDefaultAdmin();
    }

    const rbacMigrated = await RbacService.migrateUsersWithoutOrgRole();
    if (rbacMigrated > 0) {
      logger.info(`Assigned default org roles to ${rbacMigrated} user(s)`);
    }

    const backfilled = await CertificateVerificationService.backfillMissingTokens();
    if (backfilled > 0) {
      logger.info(`Backfilled certificate verification tokens for ${backfilled} submission(s)`);
    }

    const passwordBackfill = await UsersService.backfillPasswordSetAt();
    if (passwordBackfill > 0) {
      logger.info(`Backfilled passwordSetAt for ${passwordBackfill} existing user(s)`);
    }

    const renewalRepaired = await PaymentsController.repairStuckRenewalPayments();
    if (renewalRepaired > 0) {
      logger.info(`Completed stuck renewal payment state for ${renewalRepaired} submission(s)`);
    }

    if (shouldRunQueueWorker()) {
      startWorker();
    } else if (mode === 'serverless') {
      logger.info('Queue worker disabled in serverless mode (set ENABLE_QUEUE_WORKER=true on a dedicated worker if needed)');
    }

    if (mode === 'server' && !isServerlessRuntime()) {
      RenewalService.init();
    }
  })();

  return bootstrapPromise;
}
