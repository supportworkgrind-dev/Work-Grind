/**
 * WorkGrind Upload Middleware
 *
 * Uses multer memoryStorage so the file buffer is available for R2 upload.
 * For the local fallback, the controller writes the buffer to disk itself.
 *
 * Security:
 *   - Dual allowlist: MIME type AND file extension must both be permitted
 *   - Blocked-extension hard-stop before anything else
 *   - File size capped via MAX_FILE_SIZE env var (default 50 MB)
 */

import multer  from 'multer';
import path    from 'path';
import { Request } from 'express';

function invalidUpload(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

// ── Allowlists ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/webm',
  'application/zip',
  'text/plain', 'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.mp4', '.webm',
  '.mp3',
  '.zip',
  '.txt', '.csv',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.php', '.py', '.rb', '.pl', '.sh', '.bash', '.zsh',
  '.exe', '.bat', '.cmd', '.com', '.ps1', '.psm1',
  '.html', '.htm', '.svg', '.xml',
  '.jar', '.war', '.class',
  '.env', '.pem', '.key', '.crt', '.p12',
]);

// ── multer — memory storage so buffer is available for both R2 and local ──────

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: Request, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(invalidUpload(`File extension "${ext}" is not permitted for security reasons`));
    }

    const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
    const extOk  = ALLOWED_EXTENSIONS.has(ext);

    if (mimeOk && extOk) {
      cb(null, true);
    } else if (!mimeOk) {
      cb(invalidUpload(`File type "${file.mimetype}" is not allowed`));
    } else {
      cb(invalidUpload(`File extension "${ext}" is not allowed`));
    }
  },
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 52_428_800, // 50 MB default
    files: 1,
    fields: 10,
  },
});

const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const PROFILE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: Request, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!PROFILE_IMAGE_TYPES.has(file.mimetype) || !PROFILE_IMAGE_EXTENSIONS.has(extension)) {
      return cb(new Error('Choose a PNG, JPG, GIF, or WEBP image.'));
    }
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
});
