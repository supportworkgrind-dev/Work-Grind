import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicAssignment extends Document {
  companyId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  title: string;
  instructions?: string;
  dueAt?: Date;
  pointsPossible: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicAssignmentSchema = new Schema<IAcademicAssignment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'AcademicCourse' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    instructions: { type: String, trim: true, maxlength: 10000 },
    dueAt: Date,
    pointsPossible: { type: Number, required: true, min: 0, max: 100000 },
  },
  { timestamps: true }
);

AcademicAssignmentSchema.index({ companyId: 1, classId: 1, dueAt: 1 });
AcademicAssignmentSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model<IAcademicAssignment>('AcademicAssignment', AcademicAssignmentSchema);
