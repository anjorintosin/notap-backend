import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/initiate', PaymentsController.initiate);
router.post('/verify', PaymentsController.verify);

export default router;
