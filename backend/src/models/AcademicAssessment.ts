import mongoose, { Document, Schema } from 'mongoose';

export type AssessmentType = 'exam' | 'quiz' | 'test' | 'project';

export interface IAcademicAssessment extends Document {
  companyId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  title: string;
  type: AssessmentType;
  scheduledAt?: Date;
  pointsPossible: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicAssessmentSchema = new Schema<IAcademicAssessment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'AcademicCourse' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    type: { type: String, enum: ['exam', 'quiz', 'test', 'project'], required: true },
    scheduledAt: Date,
    pointsPossible: { type: Number, required: true, min: 0, max: 100000 },
  },
  { timestamps: true }
);

AcademicAssessmentSchema.index({ companyId: 1, classId: 1, scheduledAt: 1 });

export default mongoose.model<IAcademicAssessment>('AcademicAssessment', AcademicAssessmentSchema);
