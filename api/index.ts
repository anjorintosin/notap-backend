import 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { getExpressApp } from '../src/handler';

let handler: ReturnType<typeof serverless> | null = null;

export default async function vercelHandler(req: VercelRequest, res: VercelResponse) {
  if (!handler) {
    const app = await getExpressApp();
    handler = serverless(app);
  }
  return handler(req, res);
}
