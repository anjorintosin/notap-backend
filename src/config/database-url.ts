export interface ParsedPostgresUrl {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/** Parse postgres(ql):// URL without letting pg-connection-string apply sslmode on its own */
export function parsePostgresUrl(databaseUrl: string): ParsedPostgresUrl {
  const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//i, 'http://');
  const parsed = new URL(normalized);

  const database = parsed.pathname.replace(/^\//, '').split('?')[0] || 'postgres';

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}
