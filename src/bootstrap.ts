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
import { User } from './modules/users/users.model';
import { Op } from 'sequelize';
import logger from './shared/utils/logger';
import { isServerlessRuntime } from './config/runtime';
import { runSchemaMigrations } from './shared/db/schema-migrate';

export type BootstrapMode = 'server' | 'serverless';

let bootstrapPromise: Promise<void> | null = null;

export { isServerlessRuntime };

export function shouldRunQueueWorker(): boolean {
  if (process.env.ENABLE_QUEUE_WORKER === 'false') return false;
  if (process.env.ENABLE_QUEUE_WORKER === 'true') return true;
  return !isServerlessRuntime();
}

export function shouldSyncAlter(): boolean {
  if (isServerlessRuntime()) return false;
  if (process.env.DB_SYNC_ALTER === 'true') return true;
  if (process.env.DB_SYNC_ALTER === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function shouldRunHeavyBootstrap(): boolean {
  if (process.env.BOOTSTRAP_FULL === 'true') return true;
  if (process.env.BOOTSTRAP_FULL === 'false') return false;
  return !isServerlessRuntime();
}

async function runHeavyStartupTasks(): Promise<void> {
  await RbacService.ensurePermissionSchema();

  if (shouldSyncAlter()) {
    await runSchemaMigrations();
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

  const emailBackfill = await User.update(
    { emailVerified: true },
    { where: { emailVerified: false, passwordSetAt: { [Op.ne]: null } } },
  );
  if (emailBackfill[0] > 0) {
    logger.info(`Backfilled emailVerified for ${emailBackfill[0]} existing user(s)`);
  }
}

async function runLightStartupTasks(): Promise<void> {
  await ComplianceFeeService.ensureSettingsRow();

  if (shouldSeedAdmin()) {
    await ensureDefaultAdmin();
  }
}

export async function runBootstrap(mode: BootstrapMode = 'server'): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    setupAssociations();
    await sequelize.authenticate();

    const heavy = shouldRunHeavyBootstrap();
    if (heavy) {
      await runHeavyStartupTasks();
    } else {
      logger.info('Running light bootstrap (serverless / BOOTSTRAP_FULL=false)');
      await runLightStartupTasks();
    }

    if (shouldRunQueueWorker()) {
      startWorker();
    } else if (mode === 'serverless' || isServerlessRuntime()) {
      logger.info('Queue worker disabled in serverless mode');
    }

    if (mode === 'server' && !isServerlessRuntime()) {
      RenewalService.init();
    }

    logger.info('Bootstrap complete');
  })();

  return bootstrapPromise;
}
