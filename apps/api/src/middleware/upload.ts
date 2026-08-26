import multer from 'multer';
import { FILE_LIMITS } from '@aip/config';
import { AppError } from '../utils/AppError';

interface UploadOptions {
  maxMb: number;
  mimeTypes: readonly string[];
}

export function makeUpload({ maxMb, mimeTypes }: UploadOptions): multer.Multer {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (mimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
      }
    },
  });
}

export const uploadResume = makeUpload({
  maxMb: FILE_LIMITS.RESUME_MB,
  mimeTypes: FILE_LIMITS.ALLOWED_RESUME_MIME,
});

export const uploadLogo = makeUpload({
  maxMb: FILE_LIMITS.LOGO_MB,
  mimeTypes: FILE_LIMITS.ALLOWED_IMAGE_MIME,
});

export const uploadDocument = makeUpload({
  maxMb: 5,
  mimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
});
