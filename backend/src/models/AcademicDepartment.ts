import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicDepartment extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicDepartmentSchema = new Schema<IAcademicDepartment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

AcademicDepartmentSchema.index({ companyId: 1, code: 1 }, { unique: true });
AcademicDepartmentSchema.index({ companyId: 1, name: 1 });

export default mongoose.model<IAcademicDepartment>('AcademicDepartment', AcademicDepartmentSchema);
