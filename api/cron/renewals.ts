import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runBootstrap } from '../../src/bootstrap';
import { RenewalService } from '../../src/shared/services/renewal.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;

  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  await runBootstrap('serverless');
  await RenewalService.checkExpiries();

  return res.status(200).json({ success: true, message: 'Renewal expiry check completed' });
}
