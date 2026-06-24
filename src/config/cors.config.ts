import type { CorsOptions } from 'cors';

/** Strip trailing slash so https://app.vercel.app/ matches browser Origin header */
export function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getAllowedOrigins(): string[] {
  const fromEnv = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS?.split(',') || []),
  ]
    .filter(Boolean)
    .map((o) => normalizeOrigin(o as string));

  return [...new Set(fromEnv)];
}

/** Vercel / Netlify production + preview frontends */
function isHostedPreviewOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:') return false;
    return (
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.netlify.app') ||
      hostname.endsWith('.netlify.live')
    );
  } catch {
    return false;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  if (process.env.CORS_ALLOW_ALL === 'true') return true;

  const normalized = normalizeOrigin(origin);
  const allowList = getAllowedOrigins();

  if (allowList.includes(normalized)) return true;

  if (process.env.CORS_ALLOW_VERCEL === 'false') {
    return isLocalDevOrigin(origin) && process.env.NODE_ENV !== 'production';
  }

  if (isHostedPreviewOrigin(normalized)) return true;

  if (process.env.VERCEL || process.env.NETLIFY) return true;

  if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(normalized)) {
    return true;
  }

  return false;
}

export function buildCorsOptions(): CorsOptions {
  const allowList = getAllowedOrigins();

  if (process.env.VERCEL || process.env.NETLIFY || process.env.CORS_ALLOW_ALL === 'true') {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 86400,
    };
  }

  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, origin ?? true);
        return;
      }
      console.warn(
        `[CORS] Blocked origin: ${origin}. Allowed: ${allowList.join(', ') || '(vercel.app + localhost in dev)'}. Set FRONTEND_URL or CORS_ORIGINS on the API.`
      );
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400,
  };
}
