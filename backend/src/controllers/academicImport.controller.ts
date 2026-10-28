import mongoose from 'mongoose';
import { Response } from 'express';
import AcademicImportJob, { AcademicImportMode, AcademicImportModule } from '../models/AcademicImportJob';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import {
  executeImport,
  fileFingerprint,
  generateTemplate,
  IMPORT_MODULES,
  issuesCsv,
  previewImport,
} from '../services/academicImport.service';
import {
  AcademicImportBusyError,
  acquireImportLock,
  getIdentifierSettings,
  parseIdentifierSettings,
  releaseImportLock,
  saveIdentifierSettings,
} from '../services/academicIdentifiers';
import { exportAcademicRecords } from '../services/academicExport.service';

const MODES: AcademicImportMode[] = ['create_only', 'update_only', 'upsert', 'skip_duplicates'];

function companyId(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function isModule(value: unknown): value is AcademicImportModule {
  return typeof value === 'string' && IMPORT_MODULES.some((item) => item.id === value);
}

/** The column mapping arrives as a JSON object in the multipart form. */
function parseMapping(value: unknown): { mapping?: Record<string, unknown>; error?: string } {
  if (value === undefined || value === '') return {};
  if (typeof value !== 'string' || value.length > 20_000) return { error: 'The column mapping is invalid.' };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'The column mapping is invalid.' };
    return { mapping: parsed as Record<string, unknown> };
  } catch {
    return { error: 'The column mapping is invalid.' };
  }
}

function safeJob(job: InstanceType<typeof AcademicImportJob>) {
  const warningCount = job.issues.filter((item) => item.severity === 'warning').length;
  return {
    id: job._id,
    module: job.module,
    mode: job.mode,
    originalFilename: job.originalFilename,
    worksheet: job.worksheet,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successfulRows: job.successfulRows,
    skippedRows: job.skippedRows,
    failedRows: job.failedRows,
    issueCount: job.issues.length,
    warningCount,
    generatedIdCount: job.generatedIdCount ?? 0,
    personCount: job.personIds?.length ?? 0,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
  };
}

export const listImportModules = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, modules: IMPORT_MODULES });
};

export const downloadImportTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const module = req.params.module;
  const format = req.query.format === 'xlsx' ? 'xlsx' : req.query.format === 'csv' ? 'csv' : null;
  if (!isModule(module) || !format) {
    res.status(400).json({ success: false, message: 'Choose a supported import module and template format.' });
    return;
  }
  try {
    const template = await generateTemplate(module, format);
    res.set({
      'Content-Type': template.contentType,
      'Content-Disposition': `attachment; filename="workgrind-${module}-template.${template.extension}"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(template.buffer);
  } catch (error) {
    console.error('[AcademicImport] Template generation failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Unable to generate the import template.' });
  }
};

export const previewImportFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const module = req.body?.module;
  const mode = MODES.includes(req.body?.mode) ? req.body.mode as AcademicImportMode : undefined;
  const { mapping, error: mappingError } = parseMapping(req.body?.mapping);
  if (!isModule(module) || !req.file || mappingError) {
    res.status(400).json({ success: false, message: mappingError ?? 'Choose an import module and upload a CSV or XLSX file.' });
    return;
  }
  try {
    const preview = await previewImport(req.file.buffer, req.file.originalname, module, companyId(req), typeof req.body?.worksheet === 'string' ? req.body.worksheet : undefined, { mapping, mode });
    res.json({ success: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse this import file.';
    res.status(400).json({ success: false, message });
  }
};

export const createImportJob = async (req: AuthRequest, res: Response): Promise<void> => {
  const module = req.body?.module;
  const mode = req.body?.mode;
  const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
  const { mapping, error: mappingError } = parseMapping(req.body?.mapping);
  if (!isModule(module) || !MODES.includes(mode) || req.body?.confirmed !== 'true' || !req.file || mappingError) {
    res.status(400).json({ success: false, message: mappingError ?? 'Preview the file and explicitly confirm the import before writing records.' });
    return;
  }
  if (idempotencyKey && !/^[A-Za-z0-9-]{8,120}$/.test(idempotencyKey)) {
    res.status(400).json({ success: false, message: 'The import request key is invalid.' });
    return;
  }
  const tenantId = companyId(req);
  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const fileSha256 = fileFingerprint(req.file.buffer);
  const jobId = new mongoose.Types.ObjectId();
  let locked = false;
  try {
    if (idempotencyKey) {
      const previous = await AcademicImportJob.findOne({ companyId: tenantId, idempotencyKey });
      if (previous) {
        res.status(200).json({ success: true, idempotent: true, job: safeJob(previous) });
        return;
      }
    }
    if (req.body?.allowReimport !== 'true') {
      const previous = await AcademicImportJob.findOne({ companyId: tenantId, module, fileSha256, status: { $in: ['completed', 'completed_with_errors'] } }).select('_id createdAt');
      if (previous) {
        res.status(409).json({ success: false, code: 'DUPLICATE_FILE', message: 'This exact file was already imported. Confirm the re-import to continue.' });
        return;
      }
    }
    await acquireImportLock(tenantId, jobId);
    locked = true;
    const job = await AcademicImportJob.create({
      _id: jobId,
      companyId: tenantId,
      initiatedBy: userId,
      module,
      mode,
      originalFilename: req.file.originalname.slice(0, 255),
      worksheet: typeof req.body?.worksheet === 'string' ? req.body.worksheet : undefined,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      fileSha256,
      status: 'queued',
    });
    await executeImport({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      worksheet: job.worksheet,
      module,
      mode,
      companyId: tenantId,
      userId,
      job: job as InstanceType<typeof AcademicImportJob>,
      mapping,
    });
    res.status(201).json({ success: true, job: safeJob(job) });
  } catch (error) {
    if (error instanceof AcademicImportBusyError) {
      res.status(409).json({ success: false, code: 'IMPORT_IN_PROGRESS', message: error.message });
      return;
    }
    if ((error as { code?: number })?.code === 11000 && idempotencyKey) {
      const previous = await AcademicImportJob.findOne({ companyId: tenantId, idempotencyKey });
      if (previous) {
        res.status(200).json({ success: true, idempotent: true, job: safeJob(previous) });
        return;
      }
    }
    console.error('[AcademicImport] Import execution failed.', {
      module,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'The import could not be completed. Review the import history and try again with a corrected file.' });
  } finally {
    if (locked) await releaseImportLock(tenantId, jobId).catch(() => undefined);
  }
};

export const listImportHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  const pageValue = Number(req.query.page);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = 20;
  try {
    const filter = { companyId: companyId(req) };
    const [jobs, total] = await Promise.all([
      AcademicImportJob.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AcademicImportJob.countDocuments(filter),
    ]);
    res.json({ success: true, jobs: jobs.map(safeJob), total, page, pageSize: limit });
  } catch (error) {
    console.error('[AcademicImport] History lookup failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Unable to load import history.' });
  }
};

export const getImportJob = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid import job identifier.' });
    return;
  }
  const job = await AcademicImportJob.findOne({ _id: req.params.id, companyId: companyId(req) });
  if (!job) {
    res.status(404).json({ success: false, message: 'Import job not found.' });
    return;
  }
  res.json({ success: true, job: { ...safeJob(job), issues: job.issues.slice(0, 500) } });
};

/** Live progress for an import whose request is still running, looked up by its request key. */
export const getImportProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  const key = req.params.key;
  if (!/^[A-Za-z0-9-]{8,120}$/.test(key)) {
    res.status(400).json({ success: false, message: 'The import request key is invalid.' });
    return;
  }
  const job = await AcademicImportJob.findOne({ companyId: companyId(req), idempotencyKey: key }).select('-issues -personIds');
  if (!job) {
    res.status(404).json({ success: false, message: 'Import has not started yet.' });
    return;
  }
  res.json({
    success: true,
    progress: {
      id: job._id,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successfulRows: job.successfulRows,
      skippedRows: job.skippedRows,
      failedRows: job.failedRows,
    },
  });
};

export const downloadImportErrors = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid import job identifier.' });
    return;
  }
  const job = await AcademicImportJob.findOne({ _id: req.params.id, companyId: companyId(req) }).select('issues module');
  if (!job) {
    res.status(404).json({ success: false, message: 'Import job not found.' });
    return;
  }
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="workgrind-${job.module}-import-errors.csv"`,
    'Cache-Control': 'private, no-store',
  });
  res.send(issuesCsv(job.issues));
};

export const exportAcademicData = async (req: AuthRequest, res: Response): Promise<void> => {
  const module = req.params.module;
  const format = req.query.format === 'xlsx' ? 'xlsx' : req.query.format === 'csv' ? 'csv' : null;
  const definition = IMPORT_MODULES.find((item) => item.id === module);
  if (!definition?.exportable || !format) {
    res.status(400).json({ success: false, message: 'Choose an exportable module and file format.' });
    return;
  }
  try {
    const exported = await exportAcademicRecords(companyId(req), definition.id, format);
    await AuditLog.create({
      companyId: companyId(req),
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      action: 'academic.export.downloaded',
      resource: 'academic_export',
      details: { module: definition.id, format, rowCount: exported.rowCount },
    });
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="workgrind-${definition.id}-${date}.${exported.extension}"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(exported.buffer);
  } catch (error) {
    console.error('[AcademicExport] Export failed.', { module, errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Unable to export these records.' });
  }
};

export const getImportSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ success: true, settings: await getIdentifierSettings(companyId(req)) });
  } catch (error) {
    console.error('[AcademicImport] Settings lookup failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Unable to load identifier settings.' });
  }
};

export const updateImportSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const { settings, error } = parseIdentifierSettings(req.body ?? {});
  if (error || !settings) {
    res.status(400).json({ success: false, message: error ?? 'Invalid settings.' });
    return;
  }
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const saved = await saveIdentifierSettings(companyId(req), settings, userId);
    await AuditLog.create({ companyId: companyId(req), userId, action: 'academic.settings.updated', resource: 'academic_settings', details: settings });
    res.json({ success: true, settings: saved });
  } catch (saveError) {
    console.error('[AcademicImport] Settings update failed.', { errorName: saveError instanceof Error ? saveError.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Unable to save identifier settings.' });
  }
};
