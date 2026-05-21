import 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';
import { applyVercelCorsHeaders, handlePreflight } from './cors-headers';

/** Vercel-native Express export — avoids serverless-http hanging on long cold starts */
export default async function vercelHandler(req: VercelRequest, res: VercelResponse) {
  applyVercelCorsHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  return app(req, res);
}
