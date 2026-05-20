import { Router } from 'express';
import { SubmissionsController } from './submissions.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';
import { upload } from '../../shared/middleware/upload.middleware';

const router = Router();

router.use(authenticate, loadPermissions);

// Get stats for admin
router.get(
  '/stats',
  authorize('admin'),
  requirePermission('analytics.view'),
  SubmissionsController.getStats,
);

// Get submissions
router.get('/', requirePermission('submissions.view'), SubmissionsController.list);

const uploadFields = upload.fields([
  { name: 'agreement', maxCount: 1 },
  { name: 'taxClearance', maxCount: 1 },
]);

router.get('/:id', requirePermission('submissions.view'), SubmissionsController.getOne);

router.post(
  '/',
  uploadFields,
  authorize('partner', 'acquirer'),
  requirePermission('submissions.create'),
  SubmissionsController.create,
);

router.patch(
  '/:id',
  uploadFields,
  authorize('partner', 'acquirer'),
  requirePermission('submissions.edit'),
  SubmissionsController.update,
);

// Admin Review
router.patch(
  '/:id/review',
  authorize('admin'),
  requirePermission('submissions.review', 'submissions.approve'),
  SubmissionsController.review,
);

router.patch(
  '/:id/compliance-fee',
  authorize('admin'),
  requirePermission('settings.compliance_fee'),
  SubmissionsController.updateComplianceFee,
);

const renewalUploadFields = upload.fields([
  { name: 'prevDoctorFee', maxCount: 1 },
  { name: 'withholdingTax', maxCount: 1 },
  { name: 'vatCertificate', maxCount: 1 },
  { name: 'projectFee', maxCount: 1 },
]);

router.post(
  '/:id/renewal',
  authorize('acquirer'),
  requirePermission('renewals.submit'),
  renewalUploadFields,
  SubmissionsController.requestRenewal,
);

export default router;
