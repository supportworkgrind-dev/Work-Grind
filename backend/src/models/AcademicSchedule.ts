import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicSchedule extends Document {
  companyId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicScheduleSchema = new Schema<IAcademicSchedule>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'AcademicCourse' },
    dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    location: { type: String, trim: true, maxlength: 160 },
    validFrom: Date,
    validUntil: Date,
  },
  { timestamps: true }
);

AcademicScheduleSchema.index({ companyId: 1, classId: 1, dayOfWeek: 1, startTime: 1 });
AcademicScheduleSchema.index({ companyId: 1, dayOfWeek: 1, validFrom: 1, validUntil: 1 });

export default mongoose.model<IAcademicSchedule>('AcademicSchedule', AcademicScheduleSchema);
