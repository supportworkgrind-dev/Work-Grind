import mongoose, { Document, Schema } from 'mongoose';

export type AcademicPersonType = 'student' | 'teacher' | 'parent';
export type AcademicPersonStatus = 'active' | 'inactive';

export interface IAcademicPerson extends Document {
  companyId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  type: AcademicPersonType;
  firstName: string;
  lastName: string;
  email?: string;
  externalId?: string;
  status: AcademicPersonStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicPersonSchema = new Schema<IAcademicPerson>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['student', 'teacher', 'parent'], required: true },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    externalId: { type: String, trim: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
  },
  { timestamps: true }
);

AcademicPersonSchema.index({ companyId: 1, type: 1, status: 1, lastName: 1, firstName: 1 });
AcademicPersonSchema.index(
  { companyId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);
AcademicPersonSchema.index(
  { companyId: 1, userId: 1, type: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);

export default mongoose.model<IAcademicPerson>('AcademicPerson', AcademicPersonSchema);
