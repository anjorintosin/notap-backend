import fs from 'fs';
import path from 'path';

/** Hosts that require SSL for managed PostgreSQL */
const SSL_HOST_PATTERNS = [
  'neon.tech',
  'supabase.co',
  'supabase.com',
  'vercel-storage.com',
  'render.com',
  'railway.app',
  'amazonaws.com',
  'rds.amazonaws.com',
  'elephantsql.com',
  'aiven.io',
  'aivencloud.com',
  'cockroachlabs.cloud',
];

export type PgSslMode = 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';

function parseSslModeFromUrl(databaseUrl: string): PgSslMode | undefined {
  try {
    const mode = new URL(databaseUrl).searchParams.get('sslmode');
    if (mode && ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(mode)) {
      return mode as PgSslMode;
    }
  } catch {
    // ignore malformed URL
  }
  return undefined;
}

function hostFromDatabaseUrl(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
}

function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local');
}

function isCloudPostgresHost(host: string): boolean {
  if (!host || isLocalHost(host)) return false;
  const h = host.toLowerCase();
  return SSL_HOST_PATTERNS.some((pattern) => h === pattern || h.endsWith(`.${pattern}`) || h.includes(pattern));
}

function parseExplicitSslFlag(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (['false', '0', 'no', 'off', 'disable'].includes(v)) return false;
  if (['true', '1', 'yes', 'on', 'require', 'required'].includes(v)) return true;
  return undefined;
}

/** Resolve Aiven / managed Postgres CA (ca.pem in repo root or DB_SSL_CA env). */
export function resolveCaCertificate(): string | undefined {
  const candidates = [
    process.env.DB_SSL_CA?.trim(),
    path.join(process.cwd(), 'ca.pem'),
    path.resolve(__dirname, '../../ca.pem'),
    path.resolve(__dirname, '../../../ca.pem'),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch {
      // try next path
    }
  }
  return undefined;
}

export function shouldUseDatabaseSsl(options: {
  databaseUrl?: string;
  host?: string;
}): boolean {
  const explicit = parseExplicitSslFlag(process.env.DB_SSL);
  if (explicit === false) return false;
  if (explicit === true) return true;

  const host = options.host || (options.databaseUrl ? hostFromDatabaseUrl(options.databaseUrl) : '');

  if (options.databaseUrl) {
    const urlMode = parseSslModeFromUrl(options.databaseUrl);
    if (urlMode === 'disable') return false;
    if (urlMode === 'require' || urlMode === 'verify-ca' || urlMode === 'verify-full') return true;
    if (/[?&]sslmode=require/i.test(options.databaseUrl) || /[?&]ssl=true/i.test(options.databaseUrl)) {
      return true;
    }
  }

  return isCloudPostgresHost(host);
}

export function getDatabaseSslDialectOptions(): { ssl: Record<string, unknown> } | undefined {
  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.DB_HOST || (databaseUrl ? hostFromDatabaseUrl(databaseUrl) : '');

  if (!shouldUseDatabaseSsl({ databaseUrl, host })) {
    return undefined;
  }

  const ca = resolveCaCertificate();

  if (ca) {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: true,
        ca,
      },
    };
  }

  const strictVerify = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  return {
    ssl: {
      require: true,
      rejectUnauthorized: strictVerify,
    },
  };
}
