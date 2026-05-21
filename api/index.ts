import 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { applyVercelCorsHeaders, handlePreflight } from './cors-headers';
import { getExpressApp } from '../src/handler';

let handler: ReturnType<typeof serverless> | null = null;

export default async function vercelHandler(req: VercelRequest, res: VercelResponse) {
  applyVercelCorsHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    if (!handler) {
      const app = await getExpressApp();
      handler = serverless(app, {
        binary: ['image/*', 'application/pdf', 'application/octet-stream'],
      });
    }
    return await handler(req, res);
  } catch (error) {
    console.error('[api] Unhandled error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Server failed to start. Check DATABASE_URL and Vercel env vars.',
        statusCode: 500,
      });
    }
  }
}
