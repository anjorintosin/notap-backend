import { Router } from 'express';
import { InvitationsController } from './invitations.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';

const router = Router();

router.get('/validate', InvitationsController.validate);
router.post('/accept', InvitationsController.accept);
router.post('/resend', authenticate, authorize('partner', 'acquirer'), InvitationsController.resend);

export default router;
