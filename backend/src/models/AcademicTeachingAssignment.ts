import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicTeachingAssignment extends Document {
  companyId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicTeachingAssignmentSchema = new Schema<IAcademicTeachingAssignment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AcademicTeachingAssignmentSchema.index({ companyId: 1, teacherId: 1, classId: 1 }, { unique: true });
AcademicTeachingAssignmentSchema.index({ companyId: 1, classId: 1 });

export default mongoose.model<IAcademicTeachingAssignment>(
  'AcademicTeachingAssignment',
  AcademicTeachingAssignmentSchema
);
