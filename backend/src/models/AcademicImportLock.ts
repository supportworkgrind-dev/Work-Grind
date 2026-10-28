import mongoose, { Document, Schema } from 'mongoose';

/** One running import per institution; the unique companyId makes acquisition atomic. */
export interface IAcademicImportLock extends Document {
  companyId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  expiresAt: Date;
}

const AcademicImportLockSchema = new Schema<IAcademicImportLock>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'AcademicImportJob', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.model<IAcademicImportLock>('AcademicImportLock', AcademicImportLockSchema);
