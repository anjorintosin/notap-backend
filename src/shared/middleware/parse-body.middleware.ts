import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';

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

/** serverless-http (Netlify/Lambda) sometimes leaves JSON POST bodies as Buffer or byte-index objects. */
export function ensureParsedJsonBody(req: Request, _res: Response, next: NextFunction) {
  try {
    const { body } = req;

    if (Buffer.isBuffer(body)) {
      const text = body.toString('utf8').trim();
      req.body = text ? JSON.parse(text) : {};
      return next();
    }

    if (typeof body === 'string' && body.trim()) {
      req.body = JSON.parse(body);
      return next();
    }

    if (body && typeof body === 'object' && isNumericKeyObject(body as Record<string, unknown>)) {
      const text = bufferFromNumericKeyObject(body as Record<string, unknown>).toString('utf8').trim();
      req.body = text ? JSON.parse(text) : {};
      return next();
    }

    next();
  } catch {
    next(new AppError('Invalid JSON request body', 400));
  }
}
