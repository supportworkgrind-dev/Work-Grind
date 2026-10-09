import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface IAcademicAttendance extends Document {
  companyId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  recordedBy: mongoose.Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicAttendanceSchema = new Schema<IAcademicAttendance>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

AcademicAttendanceSchema.index({ companyId: 1, classId: 1, studentId: 1, date: 1 }, { unique: true });
AcademicAttendanceSchema.index({ companyId: 1, studentId: 1, date: -1 });

export default mongoose.model<IAcademicAttendance>('AcademicAttendance', AcademicAttendanceSchema);
