export interface ParsedPostgresUrl {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/** Strip whitespace, quotes, and line breaks often pasted into Netlify/Vercel env UIs. */
export function sanitizeDatabaseUrl(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return undefined;
  let value = databaseUrl.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value || undefined;
}

/** Parse postgres(ql):// URL without letting pg-connection-string apply sslmode on its own */
export function parsePostgresUrl(databaseUrl: string): ParsedPostgresUrl {
  const cleaned = sanitizeDatabaseUrl(databaseUrl);
  if (!cleaned) {
    throw new Error('DATABASE_URL is empty');
  }

  const normalized = cleaned.replace(/^postgres(ql)?:\/\//i, 'http://');
  const parsed = new URL(normalized);

  const database = parsed.pathname.replace(/^\//, '').split('?')[0] || 'postgres';

  return {
    host: parsed.hostname.trim(),
    port: parseInt(parsed.port || '5432', 10),
    database: database.trim(),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

/** Prefer discrete DB_* vars when set (avoids URL parsing issues on some hosts). */
export function resolveDatabaseConnectionConfig(): ParsedPostgresUrl {
  const discreteHost = process.env.DB_HOST?.trim();
  if (discreteHost) {
    return {
      host: discreteHost,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: (process.env.DB_NAME || process.env.DB_DATABASE || 'postgres').trim(),
      username: (process.env.DB_USER || process.env.DB_USERNAME || 'postgres').trim(),
      password: process.env.DB_PASSWORD || '',
    };
  }

  const databaseUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  if (databaseUrl) {
    return parsePostgresUrl(databaseUrl);
  }

  return {
    host: 'localhost',
    port: 5432,
    database: 'notap_db',
    username: 'postgres',
    password: process.env.DB_PASSWORD || '',
  };
}
