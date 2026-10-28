import mongoose, { Document, Schema } from 'mongoose';

export type AcademicEnrollmentStatus = 'active' | 'completed' | 'withdrawn';

export interface IAcademicEnrollment extends Document {
  companyId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  status: AcademicEnrollmentStatus;
  enrolledAt: Date;
  completedAt?: Date;
  /** Roll number within the class; unique per class when present. */
  rollNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicEnrollmentSchema = new Schema<IAcademicEnrollment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    status: { type: String, enum: ['active', 'completed', 'withdrawn'], default: 'active', required: true },
    enrolledAt: { type: Date, default: Date.now, required: true },
    completedAt: Date,
    rollNumber: { type: String, trim: true, maxlength: 40 },
  },
  { timestamps: true }
);

AcademicEnrollmentSchema.index({ companyId: 1, studentId: 1, classId: 1 }, { unique: true });
AcademicEnrollmentSchema.index({ companyId: 1, classId: 1, status: 1 });
AcademicEnrollmentSchema.index({ companyId: 1, studentId: 1, status: 1 });
AcademicEnrollmentSchema.index(
  { companyId: 1, classId: 1, rollNumber: 1 },
  { unique: true, partialFilterExpression: { rollNumber: { $type: 'string' } } }
);

export default mongoose.model<IAcademicEnrollment>('AcademicEnrollment', AcademicEnrollmentSchema);
