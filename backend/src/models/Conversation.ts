import mongoose, { Document, Schema } from 'mongoose';
export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[]; lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date; isGroup: boolean; groupName?: string; groupAvatar?: string;
  createdBy?: mongoose.Types.ObjectId;
  unreadCounts: { userId: mongoose.Types.ObjectId; count: number }[];
  createdAt: Date; updatedAt: Date;
}
const S = new Schema<IConversation>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  lastMessageAt: Date, isGroup: { type: Boolean, default: false },
  groupName: String, groupAvatar: String, createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  unreadCounts: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, count: { type: Number, default: 0 } }],
}, { timestamps: true });
S.index({ companyId: 1, participants: 1 });
S.index({ companyId: 1, updatedAt: -1 });
S.index({ companyId: 1, participants: 1, updatedAt: -1 });
S.index({ isGroup: 1, participants: 1 });
export default mongoose.model<IConversation>('Conversation', S);
