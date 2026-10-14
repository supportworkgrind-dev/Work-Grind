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
import { NextFunction, Request, RequestHandler, Response } from 'express';

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

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'audio/mpeg': ['.mp3'],
  'audio/webm': ['.webm'],
  'application/zip': ['.zip'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

function isValidUtf8(buffer: Buffer): boolean {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (let offset = 0; offset < buffer.length; offset += 8192) {
      decoder.decode(buffer.subarray(offset, offset + 8192), { stream: true });
    }
    decoder.decode();
    return !buffer.includes(0);
  } catch {
    return false;
  }
}

export function fileContentMatches(buffer: Buffer, mimeType: string, extension: string): boolean {
  if (!buffer.length || !MIME_EXTENSIONS[mimeType]?.includes(extension)) return false;

  switch (mimeType) {
    case 'image/jpeg':
      return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/gif':
      return buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
    case 'image/webp':
      return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/zip':
      return ZIP_SIGNATURES.some((signature) => buffer.subarray(0, signature.length).equals(signature));
    case 'video/mp4':
      return buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'video/webm':
    case 'audio/webm':
      return buffer.length > 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case 'audio/mpeg':
      return buffer.length > 3 &&
        (buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
          (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
    case 'text/plain':
    case 'text/csv':
      return isValidUtf8(buffer);
    default:
      return false;
  }
}

export const validateUploadedContent: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const file = req.file;
  if (!file) {
    next();
    return;
  }
  const extension = path.extname(file.originalname).toLowerCase();
  if (!fileContentMatches(file.buffer, file.mimetype, extension)) {
    next(invalidUpload('File content does not match its declared type.'));
    return;
  }
  next();
};

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
