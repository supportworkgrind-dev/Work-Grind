import mongoose, { Document, Schema } from 'mongoose';
export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId;
  channelId?: mongoose.Types.ObjectId; conversationId?: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId; content: string;
  clientMutationId?: string;
  type: 'text'|'file'|'image'|'voice'|'system';
  attachments: { name: string; url: string; type: string; size: number }[];
  reactions: { emoji: string; users: mongoose.Types.ObjectId[] }[];
  parentId?: mongoose.Types.ObjectId; threadCount: number;
  isPinned: boolean; isEdited: boolean; editedAt?: Date; deletedAt?: Date;
  mentions: mongoose.Types.ObjectId[];
  createdAt: Date; updatedAt: Date;
}
const AttachmentSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String },
  size: { type: Number },
}, { _id: false });

const S = new Schema<IMessage>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel' },
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientMutationId: { type: String, trim: true, maxlength: 64 },
  content: { type: String, default: '' },
  type: { type: String, enum: ['text','file','image','voice','system'], default: 'text' },
  attachments: [AttachmentSchema],
  reactions: [{ emoji: String, users: [{ type: Schema.Types.ObjectId, ref: 'User' }] }],
  parentId: { type: Schema.Types.ObjectId, ref: 'Message' },
  threadCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false }, editedAt: Date, deletedAt: Date,
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });
S.index({ companyId: 1, channelId: 1, deletedAt: 1, createdAt: -1 });
S.index({ companyId: 1, conversationId: 1, deletedAt: 1, createdAt: -1 });
S.index({ companyId: 1, deletedAt: 1, createdAt: -1 });
S.index(
  { senderId: 1, clientMutationId: 1 },
  { unique: true, partialFilterExpression: { clientMutationId: { $type: 'string' } } },
);
export default mongoose.model<IMessage>('Message', S);
