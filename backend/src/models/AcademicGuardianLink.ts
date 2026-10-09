import mongoose, { Document, Schema } from 'mongoose';

export type GuardianRelationshipType = 'parent' | 'guardian' | 'other';

export interface IAcademicGuardianLink extends Document {
  companyId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  guardianId: mongoose.Types.ObjectId;
  relationship: GuardianRelationshipType;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicGuardianLinkSchema = new Schema<IAcademicGuardianLink>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    guardianId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    relationship: { type: String, enum: ['parent', 'guardian', 'other'], required: true },
  },
  { timestamps: true }
);

AcademicGuardianLinkSchema.index({ companyId: 1, studentId: 1, guardianId: 1 }, { unique: true });
AcademicGuardianLinkSchema.index({ companyId: 1, guardianId: 1 });

export default mongoose.model<IAcademicGuardianLink>('AcademicGuardianLink', AcademicGuardianLinkSchema);
