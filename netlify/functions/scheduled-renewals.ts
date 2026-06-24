import type { Config } from '@netlify/functions';
import { runBootstrap } from '../../src/bootstrap';
import { RenewalService } from '../../src/shared/services/renewal.service';

export default async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await runBootstrap('serverless');
  await RenewalService.checkExpiries();

  return new Response(
    JSON.stringify({ success: true, message: 'Renewal expiry check completed' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

export const config: Config = {
  schedule: '0 0 * * *',
};
