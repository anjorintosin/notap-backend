import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  loginSchema,
  refreshSchema,
  signupSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
} from './auth.validation';
import { validate } from '../../shared/middleware/validation.middleware';

const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.post('/signup', validate(signupSchema), AuthController.signup);
router.post('/verify-email', validate(verifyEmailSchema), AuthController.verifyEmail);
router.get('/verify-email', AuthController.verifyEmailGet);
router.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);

export default router;
