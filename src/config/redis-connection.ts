import IORedis, { RedisOptions } from 'ioredis';

const TLS_HOST_PATTERNS = [
  'aivencloud.com',
  'aiven.io',
  'upstash.io',
  'redis.vercel-storage.com',
  'amazonaws.com',
];

function parseTruthy(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  return undefined;
}

function isTlsScheme(url: string): boolean {
  return /^rediss:\/\//i.test(url);
}

function hostFromUrl(url: string): string {
  try {
    const normalized = url.replace(/^rediss?:\/\//i, 'http://');
    return new URL(normalized).hostname;
  } catch {
    return '';
  }
}

function isCloudRedisHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return TLS_HOST_PATTERNS.some((p) => h === p || h.endsWith(`.${p}`) || h.includes(p));
}

export function shouldUseRedisTls(options: { redisUrl?: string; host?: string }): boolean {
  const explicit = parseTruthy(process.env.REDIS_TLS);
  if (explicit === false) return false;
  if (explicit === true) return true;

  if (options.redisUrl && isTlsScheme(options.redisUrl)) return true;

  const host = options.host || (options.redisUrl ? hostFromUrl(options.redisUrl) : '');
  return isCloudRedisHost(host);
}

function buildTlsOptions(): NonNullable<RedisOptions['tls']> {
  const strict = process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true';
  return { rejectUnauthorized: strict };
}

function bullMqDefaults(): Pick<RedisOptions, 'maxRetriesPerRequest'> {
  return { maxRetriesPerRequest: null };
}

function parseRedisUrl(url: string): RedisOptions {
  const normalized = url.replace(/^rediss?:\/\//i, 'http://');
  const parsed = new URL(normalized);
  const options: RedisOptions = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    ...bullMqDefaults(),
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }
  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  return options;
}

function createFromHostEnv(): IORedis {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const username = process.env.REDIS_USERNAME || process.env.REDIS_USER;
  const password = process.env.REDIS_PASSWORD;

  const options: RedisOptions = {
    host,
    port,
    ...bullMqDefaults(),
  };

  if (username) options.username = username;
  if (password) options.password = password;

  if (shouldUseRedisTls({ host })) {
    options.tls = buildTlsOptions();
  }

  return new IORedis(options);
}

function createFromUrl(redisUrl: string): IORedis {
  const host = hostFromUrl(redisUrl);
  const useTls = shouldUseRedisTls({ redisUrl, host });

  if (useTls && !isTlsScheme(redisUrl)) {
    const options = parseRedisUrl(redisUrl);
    options.tls = buildTlsOptions();
    return new IORedis(options);
  }

  return new IORedis(redisUrl, bullMqDefaults());
}

export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();

  if (redisHost) {
    return createFromHostEnv();
  }

  if (redisUrl) {
    return createFromUrl(redisUrl);
  }

  return new IORedis({
    host: 'localhost',
    port: 6379,
    ...bullMqDefaults(),
  });
}
