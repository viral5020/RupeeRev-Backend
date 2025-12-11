import multer from 'multer';
import path from 'path';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import type { Request } from 'express';
import env from '../config/env';
import { randomUUID } from 'crypto';

const useCloudinary = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

if (useCloudinary) {
  cloudinary.v2.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

const localStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`),
});

const cloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: async (_req: Request, file) => ({
    folder: 'money-manager/receipts',
    resource_type: 'image',
    format: file.mimetype.split('/')[1],
    public_id: randomUUID(),
  }),
});

export const receiptUpload = multer({
  storage: useCloudinary ? cloudStorage : localStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

