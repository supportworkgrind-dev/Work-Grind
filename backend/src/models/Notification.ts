import mongoose, { Document, Schema } from 'mongoose';
export interface INotification extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId;
  type: 'message'|'mention'|'task_assigned'|'task_due'|'task_updated'|'meeting_invite'|'deal_update'|'project_update'|'file_shared'|'comment'|'system';
  title: string; body: string; isRead: boolean; actionUrl?: string; metadata?: Record<string, any>;
  createdAt: Date; updatedAt: Date;
}
const S = new Schema<INotification>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['message','mention','task_assigned','task_due','task_updated','meeting_invite','deal_update','project_update','file_shared','comment','system'], required: true },
  title: { type: String, required: true }, body: { type: String, required: true },
  isRead: { type: Boolean, default: false }, actionUrl: String, metadata: Schema.Types.Mixed,
}, { timestamps: true });
S.index({ userId: 1, isRead: 1, createdAt: -1 });
S.index({ companyId: 1, userId: 1, isRead: 1, createdAt: -1 });
export default mongoose.model<INotification>('Notification', S);
