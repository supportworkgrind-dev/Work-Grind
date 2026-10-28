import mongoose, { Document, Schema } from 'mongoose';

/**
 * Monotonic per-institution counters (student IDs, per-class roll numbers).
 * Values are only ever incremented atomically, so concurrent imports never
 * receive the same number.
 */
export interface IAcademicSequence extends Document {
  companyId: mongoose.Types.ObjectId;
  key: string;
  value: number;
}

const AcademicSequenceSchema = new Schema<IAcademicSequence>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    key: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

AcademicSequenceSchema.index({ companyId: 1, key: 1 }, { unique: true });

export default mongoose.model<IAcademicSequence>('AcademicSequence', AcademicSequenceSchema);
