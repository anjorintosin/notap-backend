import './env';
import fs from 'fs';
import path from 'path';
import os from 'os';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

import { isServerlessRuntime } from './runtime';

function getLocalUploadsDir(): string {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), 'notap-uploads');
  }
  return path.join(process.cwd(), 'uploads');
}

function ensureUploadsDir(dir: string): void {
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
}

function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

if (cloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function createDiskStorage(): multer.StorageEngine {
  const uploadsDir = getLocalUploadsDir();
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        ensureUploadsDir(uploadsDir);
        cb(null, uploadsDir);
      } catch (err) {
        cb(err as Error, uploadsDir);
      }
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
}

/** Vercel: use Cloudinary (required in prod) or memory; local dev: Cloudinary or ./uploads */
function sanitizePublicId(originalname: string): string {
  const base = originalname.replace(/\.[^.]+$/, '');
  return `${Date.now()}-${base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}`;
}

export const storage: multer.StorageEngine = cloudinaryConfigured()
  ? new CloudinaryStorage({
      cloudinary,
      params: async (_req, file) => {
        const ext = (file.originalname.split('.').pop() || '').toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        return {
          folder: 'notap/agreements',
          resource_type: isImage ? 'image' : 'raw',
          public_id: sanitizePublicId(file.originalname),
        };
      },
    })
  : isServerlessRuntime()
    ? multer.memoryStorage()
    : createDiskStorage();

export default cloudinary;
