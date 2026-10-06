/**
 * WorkGrind File Controller — R2-backed with local fallback
 *
 * multer is configured with memoryStorage so req.file.buffer is always available.
 *
 * Storage routing:
 *   R2 configured  → upload buffer directly to R2, store object key in DB
 *   R2 missing     → write buffer to local uploads/ dir (legacy fallback)
 *
 * Company isolation: every DB query is scoped to req.user.companyId (from JWT).
 */

import { Response } from 'express';
import mongoose from 'mongoose';
import path   from 'path';
import fs     from 'fs';
import { v4 as uuidv4 } from 'uuid';
import File   from '../models/File';
import Folder from '../models/Folder';
import Project from '../models/Project';
import Company from '../models/Company';
import { AuthRequest } from '../middleware/auth';
import { releaseStorage, reserveStorage } from '../utils/planLimits';
import { getEffectiveSubscription } from '../services/companySubscription';
import {
  isR2Configured,
  uploadFile   as r2Upload,
  deleteFile   as r2Delete,
  generateSignedDownloadUrl,
  testR2Connection,
} from '../services/r2Storage';

// ── Helpers ───────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(path.join(__dirname, '../../uploads'));

function localFilePath(url: string): string {
  return path.resolve(path.join(UPLOADS_DIR, path.basename(url)));
}

function isLocalPathSafe(p: string): boolean {
  return p.startsWith(UPLOADS_DIR + path.sep) || p === UPLOADS_DIR;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/files
// ═══════════════════════════════════════════════════════════════════════════════
export const getFiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { folderId, projectId, isStarred, search } = req.query;
    const filter: any = { companyId: req.user!.companyId, isDeleted: false };

    if (folderId)              filter.folderId  = folderId === 'root' ? null : folderId;
    if (projectId)             filter.projectId = projectId;
    if (isStarred === 'true')  filter.isStarred = true;
    if (search)                filter.name      = { $regex: search, $options: 'i' };

    const [files, subscription, company] = await Promise.all([
      File.find(filter)
        .populate('uploaderId', 'fullName avatar')
        .populate('sharedWith.userId', 'fullName avatar')
        .populate({ path: 'projectId', select: 'name color crmCompanyId', populate: { path: 'crmCompanyId', select: 'name' } })
        .sort({ createdAt: -1 }),
      getEffectiveSubscription(req.user!.userId),
      req.user!.companyId
        ? Company.findById(req.user!.companyId).select('storage.used')
        : Promise.resolve(null),
    ]);

    res.json({
      success: true,
      files,
      storage: {
        used: company?.storage?.used ?? 0,
        limit: subscription.planConfig.limits.storage,
        plan: subscription.plan,
        status: subscription.status,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/files/upload
// ═══════════════════════════════════════════════════════════════════════════════
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  let reservedBytes = 0;
  let reservationNeedsRollback = false;
  let unrecordedR2Key: string | undefined;
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const company = await Company.findById(req.user!.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    const requestedProjectId = req.body.projectId;
    const { folderId, tags } = req.body;
    let linkedProjectId: mongoose.Types.ObjectId | null = null;
    let linkedFolderId: mongoose.Types.ObjectId | null = null;
    if (requestedProjectId) {
      if (typeof requestedProjectId !== 'string' || !mongoose.Types.ObjectId.isValid(requestedProjectId)) {
        res.status(400).json({ success: false, message: 'Invalid project id.' });
        return;
      }
      const projectFilter: Record<string, any> = { _id: requestedProjectId, companyId: req.user!.companyId, isArchived: false };
      if (req.user!.role === 'employee') {
        projectFilter.$or = [
          { 'members.userId': req.user!.userId },
          { assigneeId: req.user!.userId },
          { managerId: req.user!.userId },
        ];
      }
      if (!await Project.exists(projectFilter)) {
        res.status(400).json({ success: false, message: 'Project not found or access denied.' });
        return;
      }
      linkedProjectId = new mongoose.Types.ObjectId(requestedProjectId);
    }

    if (folderId && folderId !== 'root') {
      if (typeof folderId !== 'string' || !mongoose.Types.ObjectId.isValid(folderId)) {
        res.status(400).json({ success: false, message: 'Invalid folder id.' });
        return;
      }
      if (!await Folder.exists({ _id: folderId, companyId: req.user!.companyId })) {
        res.status(400).json({ success: false, message: 'Folder not found or access denied.' });
        return;
      }
      linkedFolderId = new mongoose.Types.ObjectId(folderId);
    }

    // ── Storage quota check ────────────────────────────────────────────────
    const storageCheck = await reserveStorage(req.user!.userId, req.file.size);
    if (!storageCheck.allowed) {
      res.status(403).json({
        success:         false,
        message:         storageCheck.reason,
        code:            storageCheck.code,
        requiresUpgrade: storageCheck.upgrade ?? false,
      });
      return;
    }
    reservedBytes = req.file.size;
    reservationNeedsRollback = true;

    let fileRecord: any;

    if (isR2Configured()) {
      // ── R2 upload (buffer available via memoryStorage) ────────────────────
      const { key } = await r2Upload({
        companyId:    req.user!.companyId,
        originalName: req.file.originalname,
        buffer:       req.file.buffer,
        mimeType:     req.file.mimetype,
        size:         req.file.size,
      });
      unrecordedR2Key = key;

      fileRecord = await File.create({
        companyId:       req.user!.companyId,
        uploaderId:      req.user!.userId,
        folderId:        linkedFolderId,
        projectId:       linkedProjectId,
        name:            req.file.originalname,
        originalName:    req.file.originalname,
        mimeType:        req.file.mimetype,
        size:            req.file.size,
        url:             '',          // R2 files use storageKey; url is legacy only
        storageKey:      key,
        storageProvider: 'r2',
        tags:            tags ? JSON.parse(tags) : [],
      });
    } else {
      // ── Local fallback: write buffer to uploads/ directory ─────────────────
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const rawExt  = path.extname(req.file.originalname).toLowerCase();
      const safeExt = /^\.[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : '';
      const diskFilename = `${uuidv4()}${safeExt}`;
      const diskPath     = path.join(UPLOADS_DIR, diskFilename);
      fs.writeFileSync(diskPath, req.file.buffer);

      fileRecord = await File.create({
        companyId:       req.user!.companyId,
        uploaderId:      req.user!.userId,
        folderId:        linkedFolderId,
        projectId:       linkedProjectId,
        name:            req.file.originalname,
        originalName:    req.file.originalname,
        mimeType:        req.file.mimetype,
        size:            req.file.size,
        url:             `/uploads/${diskFilename}`,
        storageProvider: 'local',
        tags:            tags ? JSON.parse(tags) : [],
      });
    }

    reservationNeedsRollback = false;
    unrecordedR2Key = undefined;

    const populated = await fileRecord.populate('uploaderId', 'fullName avatar');
    res.status(201).json({
      success: true,
      file: populated,
      storage: {
        used: storageCheck.current,
        limit: storageCheck.limit,
      },
    });
  } catch (err: any) {
    if (unrecordedR2Key) {
      try {
        const deleted = await r2Delete(unrecordedR2Key);
        if (!deleted) console.error('[File Upload] R2 cleanup failed for an unrecorded object.');
      } catch (cleanupError) {
        console.error('[File Upload] R2 cleanup failed for an unrecorded object:', cleanupError);
      }
    }
    if (reservationNeedsRollback && reservedBytes > 0) {
      try {
        await releaseStorage(req.user!.userId, reservedBytes);
      } catch (rollbackError) {
        console.error('[File Upload] Storage reservation rollback failed:', rollbackError);
      }
    }
    console.error('[File Upload] Error:', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/files/:id/download
// R2: returns a signed URL (JSON); local: streams the file
// ═══════════════════════════════════════════════════════════════════════════════
export const downloadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = await File.findOne({
      _id:       req.params.id,
      companyId: req.user!.companyId, // workspace isolation — never bypass
      isDeleted: false,
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }

    // ── R2: generate a short-lived signed URL ─────────────────────────────
    if (file.storageProvider === 'r2' && file.storageKey) {
      const signedUrl = await generateSignedDownloadUrl(file.storageKey, file.name, 900);
      res.json({ success: true, url: signedUrl, filename: file.name });
      return;
    }

    // ── Local (legacy pre-R2 files): stream the file ──────────────────────
    const filePath = localFilePath(file.url);
    if (!isLocalPathSafe(filePath)) {
      res.status(400).json({ success: false, message: 'Invalid file path' });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found on disk' });
      return;
    }

    const sanitizedName = file.name.replace(/[^\w\s.\-()]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err: any) {
    console.error('[File Download] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/files/:id
// ═══════════════════════════════════════════════════════════════════════════════
export const updateFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ALLOWED = ['name', 'isStarred', 'tags', 'folderId', 'projectId'];
    const updates: Record<string, any> = {};
    ALLOWED.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const file = await File.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      updates,
      { new: true }
    ).populate('uploaderId', 'fullName avatar');

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }

    res.json({ success: true, file });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/files/:id
// ═══════════════════════════════════════════════════════════════════════════════
export const deleteFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = await File.findOne({
      _id:       req.params.id,
      companyId: req.user!.companyId,
      isDeleted: false,
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }

    // ── Delete from storage ────────────────────────────────────────────────
    if (file.storageProvider === 'r2' && file.storageKey) {
      const ok = await r2Delete(file.storageKey);
      if (!ok) {
        res.status(500).json({ success: false, message: 'Failed to delete file from R2 storage.' });
        return;
      }
    } else if (file.url) {
      const fp = localFilePath(file.url);
      if (isLocalPathSafe(fp) && fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch { /* non-fatal */ }
      }
    }

    // ── Mark deleted in DB ─────────────────────────────────────────────────
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    // ── Decrement storage usage ────────────────────────────────────────────
    await releaseStorage(req.user!.userId, file.size);

    res.json({ success: true, message: 'File deleted' });
  } catch (err: any) {
    console.error('[File Delete] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Folder operations (unchanged logic) ──────────────────────────────────────

export const getFolders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { parentId, projectId } = req.query;
    const filter: any = { companyId: req.user!.companyId };
    if (parentId !== undefined) filter.parentId = parentId === 'root' ? null : parentId;
    if (projectId) filter.projectId = projectId;

    const folders = await Folder.find(filter)
      .populate('creatorId', 'fullName avatar')
      .sort({ name: 1 });

    res.json({ success: true, folders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createFolder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, parentId, projectId, color } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Folder name is required' });
      return;
    }

    const folder = await Folder.create({
      companyId: req.user!.companyId,
      creatorId: req.user!.userId,
      name,
      parentId:  parentId && parentId !== 'root' ? parentId : null,
      projectId: projectId || null,
      color:     color || '#4F46E5',
    });

    const populated = await folder.populate('creatorId', 'fullName avatar');
    res.status(201).json({ success: true, folder: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteFolder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const folder = await Folder.findOne({
      _id:       req.params.id,
      companyId: req.user!.companyId,
    });

    if (!folder) {
      res.status(404).json({ success: false, message: 'Folder not found' });
      return;
    }

    const files = await File.find({
      folderId: req.params.id,
      companyId: req.user!.companyId,
      isDeleted: false,
    }).select('name size storageKey url storageProvider');

    for (const file of files) {
      if (file.storageProvider === 'r2' && file.storageKey) {
        const deleted = await r2Delete(file.storageKey);
        if (!deleted) {
          res.status(500).json({ success: false, message: `Failed to delete ${file.name} from storage.` });
          return;
        }
      } else if (file.url) {
        const diskPath = localFilePath(file.url);
        if (isLocalPathSafe(diskPath) && fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      }
    }

    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    await File.updateMany(
      { _id: { $in: files.map((file) => file._id) }, companyId: req.user!.companyId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    );
    await Folder.deleteOne({ _id: folder._id, companyId: req.user!.companyId });
    if (totalBytes > 0) await releaseStorage(req.user!.userId, totalBytes);

    res.json({ success: true, message: 'Folder deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/files/storage/health  — owner/admin only
// Tests R2 connectivity without exposing credentials
// ═══════════════════════════════════════════════════════════════════════════════
export const storageHealth = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!['owner', 'admin'].includes(req.user!.role)) {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return;
  }

  if (!isR2Configured()) {
    res.json({ success: true, provider: 'local', message: 'R2 not configured — using local storage.' });
    return;
  }

  try {
    const result = await testR2Connection();
    res.json({ provider: 'r2', ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
