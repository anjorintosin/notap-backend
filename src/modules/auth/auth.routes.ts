import { Router } from 'express';
import { AuthController } from './auth.controller';
import { loginSchema, refreshSchema } from './auth.validation';
import { validate } from '../../shared/middleware/validation.middleware';

const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.post('/signup', AuthController.signup);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);

export default router;
