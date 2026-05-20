import dotenv from 'dotenv';

dotenv.config();

// REST API URLs are invalid here — Cloudinary expects cloudinary://api_key:api_secret@cloud_name
if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  delete process.env.CLOUDINARY_URL;
}
