import multer from 'multer';
import { storage } from '../../config/cloudinary';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isAllowedUpload(file: Express.Multer.File): boolean {
  if (ALLOWED_MIMES.has(file.mimetype)) return true;
  const ext = (file.originalname.split('.').pop() || '').toLowerCase();
  return ext === 'pdf' || ext === 'docx';
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed (max 10MB)'));
    }
  },
});
