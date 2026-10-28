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
  phone?: string;
  dateOfBirth?: Date;
  /** Admission date for students, joining date for staff. */
  startDate?: Date;
  address?: string;
  departmentId?: mongoose.Types.ObjectId;
  /** A student's programme or primary course. */
  courseId?: mongoose.Types.ObjectId;
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
    email: { type: String, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    externalId: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 32 },
    dateOfBirth: Date,
    startDate: Date,
    address: { type: String, trim: true, maxlength: 500 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'AcademicDepartment' },
    courseId: { type: Schema.Types.ObjectId, ref: 'AcademicCourse' },
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
// Duplicate-email checks during imports and invitation lookups.
AcademicPersonSchema.index({ companyId: 1, type: 1, email: 1 });

export default mongoose.model<IAcademicPerson>('AcademicPerson', AcademicPersonSchema);
