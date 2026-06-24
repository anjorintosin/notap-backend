import { Router } from 'express';
import { MessagingController } from './messaging.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/conversations', MessagingController.listConversations);
router.get('/contacts/partners', authorize('admin'), MessagingController.listPartnerContacts);
router.get('/contacts/acquirers', authorize('admin'), MessagingController.listAcquirerContacts);
router.get('/contacts/submissions', authorize('admin'), MessagingController.listSubmissionsForMessaging);
router.post('/conversations/start', MessagingController.startConversation);
router.post('/conversations', MessagingController.getOrCreateConversation);
router.post(
  '/conversations/for-submission/:submissionId',
  authorize('admin'),
  MessagingController.conversationForSubmission,
);
router.get('/conversations/:conversationId/messages', MessagingController.getMessages);
router.post('/conversations/:conversationId/messages', MessagingController.sendMessage);

export default router;
