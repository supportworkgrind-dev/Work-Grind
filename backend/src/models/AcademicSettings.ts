import mongoose, { Document, Schema } from 'mongoose';

export type AcademicRollNumberMode = 'manual' | 'sequential_per_class';

/** Institution-wide identifier rules used by imports and record creation. */
export interface IAcademicSettings extends Document {
  companyId: mongoose.Types.ObjectId;
  studentIdPrefix: string;
  teacherIdPrefix: string;
  parentIdPrefix: string;
  idPadding: number;
  rollNumberMode: AcademicRollNumberMode;
  rollNumberPadding: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PREFIX = { type: String, trim: true, uppercase: true, maxlength: 12, match: /^[A-Z0-9-]{1,12}$/ };

const AcademicSettingsSchema = new Schema<IAcademicSettings>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    studentIdPrefix: { ...PREFIX, default: 'STU' },
    teacherIdPrefix: { ...PREFIX, default: 'TCH' },
    parentIdPrefix: { ...PREFIX, default: 'GRD' },
    idPadding: { type: Number, min: 4, max: 10, default: 6 },
    rollNumberMode: { type: String, enum: ['manual', 'sequential_per_class'], default: 'manual', required: true },
    rollNumberPadding: { type: Number, min: 1, max: 6, default: 2 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model<IAcademicSettings>('AcademicSettings', AcademicSettingsSchema);
