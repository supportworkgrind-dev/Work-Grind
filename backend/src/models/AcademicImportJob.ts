import mongoose, { Document, Schema } from 'mongoose';

export type AcademicImportModule =
  | 'students'
  | 'teachers'
  | 'parents'
  | 'departments'
  | 'courses'
  | 'classes'
  | 'enrollments'
  | 'guardians'
  | 'teaching_assignments'
  | 'timetables'
  | 'attendance'
  | 'assessments'
  | 'results'
  | 'fees';

export type AcademicImportMode = 'create_only' | 'update_only' | 'upsert' | 'skip_duplicates';
export type AcademicImportStatus = 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';

export interface AcademicImportIssue {
  rowNumber: number;
  field?: string;
  code: string;
  message: string;
  /** Warnings are reported but do not stop the row from importing. */
  severity?: 'error' | 'warning';
}

export interface IAcademicImportJob extends Document {
  companyId: mongoose.Types.ObjectId;
  initiatedBy: mongoose.Types.ObjectId;
  module: AcademicImportModule;
  mode: AcademicImportMode;
  originalFilename: string;
  worksheet?: string;
  idempotencyKey?: string;
  /** SHA-256 of the uploaded file, used to flag accidental re-imports. */
  fileSha256?: string;
  /** Source column chosen for each template field. */
  mapping?: Record<string, string>;
  /** People created or updated by this job (for follow-up invitations). */
  personIds: mongoose.Types.ObjectId[];
  generatedIdCount: number;
  status: AcademicImportStatus;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  skippedRows: number;
  failedRows: number;
  issues: AcademicImportIssue[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicImportIssueSchema = new Schema<AcademicImportIssue>(
  {
    rowNumber: { type: Number, required: true, min: 1 },
    field: { type: String, trim: true, maxlength: 80 },
    code: { type: String, required: true, trim: true, maxlength: 80 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    severity: { type: String, enum: ['error', 'warning'] },
  },
  { _id: false },
);

const AcademicImportJobSchema = new Schema<IAcademicImportJob>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    module: {
      type: String,
      enum: ['students', 'teachers', 'parents', 'departments', 'courses', 'classes', 'enrollments', 'guardians', 'teaching_assignments', 'timetables', 'attendance', 'assessments', 'results', 'fees'],
      required: true,
    },
    mode: { type: String, enum: ['create_only', 'update_only', 'upsert', 'skip_duplicates'], required: true },
    originalFilename: { type: String, required: true, trim: true, maxlength: 255 },
    worksheet: { type: String, trim: true, maxlength: 120 },
    idempotencyKey: { type: String, trim: true, maxlength: 120 },
    fileSha256: { type: String, match: /^[a-f0-9]{64}$/ },
    mapping: { type: Map, of: String },
    personIds: { type: [{ type: Schema.Types.ObjectId, ref: 'AcademicPerson' }], default: [] },
    generatedIdCount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled'], required: true, default: 'queued' },
    totalRows: { type: Number, required: true, min: 0, default: 0 },
    processedRows: { type: Number, required: true, min: 0, default: 0 },
    successfulRows: { type: Number, required: true, min: 0, default: 0 },
    skippedRows: { type: Number, required: true, min: 0, default: 0 },
    failedRows: { type: Number, required: true, min: 0, default: 0 },
    issues: { type: [AcademicImportIssueSchema], default: [] },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

AcademicImportJobSchema.index({ companyId: 1, createdAt: -1 });
AcademicImportJobSchema.index({ companyId: 1, fileSha256: 1, module: 1 });
AcademicImportJobSchema.index(
  { companyId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export default mongoose.model<IAcademicImportJob>('AcademicImportJob', AcademicImportJobSchema);
