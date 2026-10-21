import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import File from '../models/File';
import { readPrivateFile } from './r2Storage';
import { fileContentMatches } from '../middleware/upload';
import { LINKEDIN_MAX_IMAGE_BYTES, LINKEDIN_MAX_VIDEO_BYTES } from './linkedinPublishing';
import { YOUTUBE_MAX_VIDEO_BYTES, YOUTUBE_VIDEO_TYPES } from './youtubePublishing';
import { isAcademicOrganizationType } from '../config/organization';

export class SocialMediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialMediaValidationError';
  }
}

export interface LinkedInMediaAsset {
  buffer: Buffer;
  mimeType: string;
  title: string;
  size: number;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const VIDEO_TYPES = new Set(['video/mp4']);

/** Media rules per publishing destination; `preview` accepts anything a destination accepts. */
export type SocialMediaRules = 'linkedin' | 'youtube' | 'preview';

const MEDIA_RULES: Record<SocialMediaRules, {
  imageTypes: Set<string>;
  videoTypes: Set<string>;
  maxImageBytes: number;
  maxVideoBytes: number;
  message: string;
}> = {
  linkedin: {
    imageTypes: IMAGE_TYPES,
    videoTypes: VIDEO_TYPES,
    maxImageBytes: LINKEDIN_MAX_IMAGE_BYTES,
    maxVideoBytes: LINKEDIN_MAX_VIDEO_BYTES,
    message: 'LinkedIn supports JPEG or PNG images up to 36 MB and MP4 videos up to 50 MB.',
  },
  youtube: {
    imageTypes: new Set(),
    videoTypes: YOUTUBE_VIDEO_TYPES,
    maxImageBytes: 0,
    maxVideoBytes: YOUTUBE_MAX_VIDEO_BYTES,
    message: 'YouTube publishing needs one MP4 or WebM video.',
  },
  preview: {
    imageTypes: IMAGE_TYPES,
    videoTypes: new Set([...VIDEO_TYPES, ...YOUTUBE_VIDEO_TYPES]),
    maxImageBytes: LINKEDIN_MAX_IMAGE_BYTES,
    maxVideoBytes: Math.max(LINKEDIN_MAX_VIDEO_BYTES, YOUTUBE_MAX_VIDEO_BYTES),
    message: 'This media type cannot be previewed.',
  },
};
const UPLOADS_DIR = path.resolve(path.join(__dirname, '../../uploads'));

export async function readLinkedInMediaAsset(
  fileId: mongoose.Types.ObjectId | string,
  companyId: mongoose.Types.ObjectId | string,
  access?: { userId: string; role: string; organizationType?: string },
): Promise<LinkedInMediaAsset> {
  return readSocialMediaAsset(fileId, companyId, access, 'linkedin');
}

export async function readSocialMediaAsset(
  fileId: mongoose.Types.ObjectId | string,
  companyId: mongoose.Types.ObjectId | string,
  access: { userId: string; role: string; organizationType?: string } | undefined,
  rulesId: SocialMediaRules,
): Promise<LinkedInMediaAsset> {
  const rules = MEDIA_RULES[rulesId];
  const query: Record<string, unknown> = {
    _id: fileId,
    companyId,
    isDeleted: false,
  };
  if (access && isAcademicOrganizationType(access.organizationType) &&
      !['owner', 'admin', 'principal'].includes(access.role)) {
    query.$or = [
      { uploaderId: access.userId },
      { sharedWith: { $elemMatch: { userId: access.userId, permission: { $in: ['view', 'edit'] } } } },
    ];
  }
  const file = await File.findOne(query).select('name originalName mimeType size url storageProvider storageKey');
  if (!file) throw new SocialMediaValidationError('The selected media file is unavailable in this workspace.');

  const isImage = rules.imageTypes.has(file.mimeType);
  const isVideo = rules.videoTypes.has(file.mimeType);
  const maxBytes = isImage ? rules.maxImageBytes : rules.maxVideoBytes;
  if ((!isImage && !isVideo) || file.size <= 0 || file.size > maxBytes) {
    throw new SocialMediaValidationError(rules.message);
  }

  let buffer: Buffer | undefined;
  if (file.storageProvider === 'r2' && file.storageKey) {
    const result = await readPrivateFile(file.storageKey);
    if (result) {
      if (result.mimeType !== file.mimeType) throw new SocialMediaValidationError('The selected file type could not be verified.');
      buffer = result.buffer;
    }
  } else if (file.storageProvider === 'local' && file.url) {
    const filePath = path.resolve(path.join(UPLOADS_DIR, path.basename(file.url)));
    if (!filePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) {
      throw new SocialMediaValidationError('The selected media file is unavailable.');
    }
    try {
      buffer = await fs.readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new SocialMediaValidationError('The selected media file is unavailable.');
      }
      throw error;
    }
  }

  if (!buffer || buffer.length !== file.size ||
      !fileContentMatches(buffer, file.mimeType, path.extname(file.originalName).toLowerCase())) {
    throw new SocialMediaValidationError('The selected media file is incomplete or does not match its declared type.');
  }

  return {
    buffer,
    mimeType: file.mimeType,
    title: file.name || file.originalName,
    size: file.size,
  };
}
