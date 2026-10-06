import mongoose, { Document, Schema } from 'mongoose';
export interface IDocument extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId; creatorId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId; title: string; content: string;
  type: 'document'|'meeting_notes'|'sop'|'policy'|'report'; icon?: string;
  isPublic: boolean; sharedWith: { userId: mongoose.Types.ObjectId; permission: 'view'|'comment'|'edit' }[];
  collaborators: mongoose.Types.ObjectId[]; tags: string[];
  versionHistory: { version: number; content: string; editedBy: mongoose.Types.ObjectId; editedAt: Date }[];
  comments: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; content: string; createdAt: Date }[];
  isArchived: boolean; lastEditedBy?: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date;
}
const S = new Schema<IDocument>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  title: { type: String, required: true, trim: true }, content: { type: String, default: '' },
  type: { type: String, enum: ['document','meeting_notes','sop','policy','report'], default: 'document' },
  icon: String, isPublic: { type: Boolean, default: false },
  sharedWith: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, permission: { type: String, enum: ['view','comment','edit'], default: 'view' } }],
  collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }], tags: [String],
  versionHistory: [{ version: Number, content: String, editedBy: { type: Schema.Types.ObjectId, ref: 'User' }, editedAt: Date }],
  comments: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, content: String, createdAt: { type: Date, default: Date.now } }],
  isArchived: { type: Boolean, default: false }, lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
S.index({ companyId: 1, creatorId: 1 });
S.index({ companyId: 1, isArchived: 1 });
export default mongoose.model<IDocument>('Document', S);
