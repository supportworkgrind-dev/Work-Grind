import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicResult extends Document {
  companyId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  gradedBy: mongoose.Types.ObjectId;
  pointsEarned: number;
  feedback?: string;
  gradedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicResultSchema = new Schema<IAcademicResult>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'AcademicAssessment', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pointsEarned: { type: Number, required: true, min: 0, max: 100000 },
    feedback: { type: String, trim: true, maxlength: 2000 },
    gradedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

AcademicResultSchema.index({ companyId: 1, assessmentId: 1, studentId: 1 }, { unique: true });
AcademicResultSchema.index({ companyId: 1, studentId: 1, gradedAt: -1 });

export default mongoose.model<IAcademicResult>('AcademicResult', AcademicResultSchema);
