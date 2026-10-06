import mongoose, { Document, Schema } from 'mongoose';
export interface IMeeting extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId; title: string;
  description?: string; hostId: mongoose.Types.ObjectId;
  participants: { userId: mongoose.Types.ObjectId; status: 'invited'|'accepted'|'declined'|'joined'; joinedAt?: Date; leftAt?: Date }[];
  crmCompanyId?: mongoose.Types.ObjectId; crmContactIds: mongoose.Types.ObjectId[];
  projectId?: mongoose.Types.ObjectId; scheduledAt?: Date; startedAt?: Date; endedAt?: Date;
  duration?: number; meetingLink: string; status: 'scheduled'|'active'|'ended'|'cancelled';
  isRecorded: boolean; recordingUrl?: string;
  aiSummary?: { summary: string; keyPoints: string[]; decisions: string[]; actionItems: { title: string; assignedTo?: string; deadline?: string; taskId?: mongoose.Types.ObjectId }[]; generatedAt: Date };
  createdAt: Date; updatedAt: Date;
}
const S = new Schema<IMeeting>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true, trim: true }, description: String,
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, status: { type: String, enum: ['invited','accepted','declined','joined'], default: 'invited' }, joinedAt: Date, leftAt: Date }],
  crmCompanyId: { type: Schema.Types.ObjectId, ref: 'CrmCompany' },
  crmContactIds: [{ type: Schema.Types.ObjectId, ref: 'CrmContact' }],
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  scheduledAt: Date, startedAt: Date, endedAt: Date, duration: Number,
  meetingLink: { type: String, unique: true },
  status: { type: String, enum: ['scheduled','active','ended','cancelled'], default: 'scheduled' },
  isRecorded: { type: Boolean, default: false }, recordingUrl: String,
  aiSummary: { summary: String, keyPoints: [String], decisions: [String], actionItems: [{ title: String, assignedTo: String, deadline: String, taskId: { type: Schema.Types.ObjectId, ref: 'Task' } }], generatedAt: Date },
}, { timestamps: true });
S.index({ companyId: 1, scheduledAt: 1 });
S.index({ companyId: 1, status: 1 });
S.index({ companyId: 1, scheduledAt: -1, createdAt: -1 });
S.index({ companyId: 1, 'participants.userId': 1 });
S.index({ companyId: 1, crmCompanyId: 1, scheduledAt: -1 });
S.index({ companyId: 1, crmContactIds: 1 });
S.index({ hostId: 1, scheduledAt: -1, createdAt: -1 });
S.index({ 'participants.userId': 1, scheduledAt: -1, createdAt: -1 });
export default mongoose.model<IMeeting>('Meeting', S);
