import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';

type RequestWithRawBody = Request & { rawBody?: Buffer };

function isNumericKeyObject(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  if (keys.length === 0) return false;
  return keys.every((k) => /^\d+$/.test(k));
}

function bufferFromNumericKeyObject(body: Record<string, unknown>): Buffer {
  const bytes = Object.keys(body)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((i) => Number(body[String(i)]));
  return Buffer.from(bytes);
}

function isJsonRequest(req: Request): boolean {
  const method = req.method?.toUpperCase() || 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;

  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) return false;
  if (contentType.includes('application/json') || contentType.includes('+json')) return true;

  // Netlify/serverless clients sometimes omit Content-Type on JSON POSTs
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}

function hasPlainParsedBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== 'object' || Buffer.isBuffer(body) || Array.isArray(body)) {
    return false;
  }
  const keys = Object.keys(body);
  if (keys.length === 0) return false;
  return !isNumericKeyObject(body as Record<string, unknown>);
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

/** serverless-http (Netlify/Lambda) may leave JSON POST bodies as Buffer, string, or byte-index objects. */
export function ensureParsedJsonBody(req: Request, _res: Response, next: NextFunction) {
  if (!isJsonRequest(req)) {
    return next();
  }

  if (hasPlainParsedBody(req.body)) {
    return next();
  }

  const reqWithRaw = req as RequestWithRawBody;
  const candidates: Buffer[] = [];

  if (Buffer.isBuffer(reqWithRaw.rawBody) && reqWithRaw.rawBody.length > 0) {
    candidates.push(reqWithRaw.rawBody);
  }
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    candidates.push(req.body);
  }

  for (const buf of candidates) {
    try {
      req.body = tryParseJson(buf.toString('utf8'));
      return next();
    } catch {
      // try next candidate
    }
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      req.body = tryParseJson(req.body);
      return next();
    } catch {
      return next(new AppError('Invalid JSON request body', 400));
    }
  }

  if (req.body && typeof req.body === 'object' && isNumericKeyObject(req.body as Record<string, unknown>)) {
    try {
      const text = bufferFromNumericKeyObject(req.body as Record<string, unknown>).toString('utf8');
      req.body = tryParseJson(text);
      return next();
    } catch {
      return next(new AppError('Invalid JSON request body', 400));
    }
  }

  // Empty body — let route validation return a clearer error
  next();
}

export function captureRawBody(
  req: Request,
  _res: Response,
  buf: Buffer,
  _encoding: string,
) {
  if (buf?.length) {
    (req as RequestWithRawBody).rawBody = buf;
  }
}
