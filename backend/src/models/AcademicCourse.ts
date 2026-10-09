import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicCourse extends Document {
  companyId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  credits?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicCourseSchema = new Schema<IAcademicCourse>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'AcademicDepartment', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 2000 },
    credits: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

AcademicCourseSchema.index({ companyId: 1, code: 1 }, { unique: true });
AcademicCourseSchema.index({ companyId: 1, departmentId: 1, name: 1 });

export default mongoose.model<IAcademicCourse>('AcademicCourse', AcademicCourseSchema);
