import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../utils/logger';

type Migration = { name: string; sql: string };

const MIGRATIONS: Migration[] = [
  {
    name: 'users.emailVerified',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;`,
  },
  {
    name: 'users.emailVerificationToken',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(255);`,
  },
  {
    name: 'users.emailVerificationExpires',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMPTZ;`,
  },
  {
    name: 'organizations.reviewComment',
    sql: `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "reviewComment" TEXT;`,
  },
  {
    name: 'organization_invitations.acceptedOrganizationId_fkey',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organization_invitations'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'organization_invitations_acceptedOrganizationId_fkey'
        ) THEN
          ALTER TABLE organization_invitations
            ADD CONSTRAINT "organization_invitations_acceptedOrganizationId_fkey"
            FOREIGN KEY ("acceptedOrganizationId") REFERENCES organizations(id)
            ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
      END $$;
    `,
  },
  {
    name: 'users.backfill_emailVerified',
    sql: `
      UPDATE users
      SET "emailVerified" = true
      WHERE "passwordSetAt" IS NOT NULL
        AND ("emailVerified" IS NULL OR "emailVerified" = false);
    `,
  },
];

/** Safe idempotent schema updates — avoids sequelize.sync({ alter: true }) FK drop errors on Postgres. */
export async function runSchemaMigrations(): Promise<void> {
  const [tableCheck] = await sequelize.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists`,
    { type: QueryTypes.SELECT },
  );

  if (!tableCheck?.exists) {
    logger.info('Empty database — creating tables (sync without alter)');
    await sequelize.sync();
    return;
  }

  for (const migration of MIGRATIONS) {
    try {
      await sequelize.query(migration.sql, { type: QueryTypes.RAW });
      logger.info(`Migration applied: ${migration.name}`);
    } catch (error) {
      logger.error(`Migration failed: ${migration.name}`, error);
      throw error;
    }
  }
}
