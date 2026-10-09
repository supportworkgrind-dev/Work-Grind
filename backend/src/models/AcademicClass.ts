import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicClass extends Document {
  companyId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  name: string;
  academicYear: string;
  courseIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AcademicClassSchema = new Schema<IAcademicClass>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'AcademicDepartment', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    academicYear: { type: String, required: true, trim: true, maxlength: 30 },
    courseIds: [{ type: Schema.Types.ObjectId, ref: 'AcademicCourse' }],
  },
  { timestamps: true }
);

AcademicClassSchema.index({ companyId: 1, academicYear: 1, name: 1 }, { unique: true });
AcademicClassSchema.index({ companyId: 1, departmentId: 1, academicYear: 1 });

export default mongoose.model<IAcademicClass>('AcademicClass', AcademicClassSchema);
