import mongoose, { Document, Schema } from 'mongoose';
export interface ICalendarEvent extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId; creatorId: mongoose.Types.ObjectId;
  title: string; description?: string; type: 'meeting'|'task'|'deadline'|'event'|'reminder';
  startDate: Date; endDate: Date; allDay: boolean; location?: string; videoLink?: string;
  attendees: mongoose.Types.ObjectId[]; color?: string; meetingId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId; projectId?: mongoose.Types.ObjectId;
  createdAt: Date; updatedAt: Date;
}
const S = new Schema<ICalendarEvent>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true }, description: String,
  type: { type: String, enum: ['meeting','task','deadline','event','reminder'], default: 'event' },
  startDate: { type: Date, required: true }, endDate: { type: Date, required: true },
  allDay: { type: Boolean, default: false }, location: String, videoLink: String,
  attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }], color: String,
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting' },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
}, { timestamps: true });
S.index({ companyId: 1, startDate: 1 }); S.index({ companyId: 1, attendees: 1 });
export default mongoose.model<ICalendarEvent>('CalendarEvent', S);
