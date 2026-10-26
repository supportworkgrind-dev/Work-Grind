import mongoose from 'mongoose';
import { Response } from 'express';
import AcademicImportJob, { AcademicImportMode, AcademicImportModule } from '../models/AcademicImportJob';
import { AuthRequest } from '../middleware/auth';
import {
  executeImport,
  generateTemplate,
  IMPORT_MODULES,
  issuesCsv,
  previewImport,
} from '../services/academicImport.service';

const MODES: AcademicImportMode[] = ['create_only', 'update_only', 'upsert', 'skip_duplicates'];

function companyId(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function isModule(value: unknown): value is AcademicImportModule {
  return typeof value === 'string' && IMPORT_MODULES.some((item) => item.id === value);
}

function safeJob(job: InstanceType<typeof AcademicImportJob>) {
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
  if (!isModule(module) || !req.file) {
    res.status(400).json({ success: false, message: 'Choose an import module and upload a CSV or XLSX file.' });
    return;
  }
  try {
    const preview = await previewImport(req.file.buffer, req.file.originalname, module, companyId(req), typeof req.body?.worksheet === 'string' ? req.body.worksheet : undefined);
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
  if (!isModule(module) || !MODES.includes(mode) || req.body?.confirmed !== 'true' || !req.file) {
    res.status(400).json({ success: false, message: 'Preview the file and explicitly confirm the import before writing records.' });
    return;
  }
  const tenantId = companyId(req);
  try {
    if (idempotencyKey) {
      const previous = await AcademicImportJob.findOne({ companyId: tenantId, idempotencyKey });
      if (previous) {
        res.status(200).json({ success: true, idempotent: true, job: safeJob(previous) });
        return;
      }
    }
    const job = await AcademicImportJob.create({
      companyId: tenantId,
      initiatedBy: new mongoose.Types.ObjectId(req.user!.userId),
      module,
      mode,
      originalFilename: req.file.originalname,
      worksheet: typeof req.body?.worksheet === 'string' ? req.body.worksheet : undefined,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      status: 'queued',
    });
    await executeImport({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      worksheet: job.worksheet,
      module,
      mode,
      companyId: tenantId,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      job: job as InstanceType<typeof AcademicImportJob>,
    });
    res.status(201).json({ success: true, job: safeJob(job) });
  } catch (error) {
    console.error('[AcademicImport] Import execution failed.', {
      module,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'The import could not be completed. Review the import history and try again with a corrected file.' });
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
  res.json({ success: true, job: { ...safeJob(job), issues: job.issues } });
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
