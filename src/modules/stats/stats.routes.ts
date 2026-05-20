import { Router } from 'express';
import { StatsController } from './stats.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/overview', StatsController.getOverview);

export default router;
