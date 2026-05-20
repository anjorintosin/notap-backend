import { Router } from 'express';
import { VerificationController } from './verification.controller';
import { publicRateLimit } from '../../shared/middleware/public-rate-limit.middleware';

const router = Router();

router.get(
  '/certificates/verify/:token',
  publicRateLimit,
  VerificationController.verifyCertificate,
);

export default router;
