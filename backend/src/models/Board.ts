import mongoose, { Document, Schema } from 'mongoose';

export type BoardPermission = 'view' | 'comment' | 'edit';
export type WhiteboardElementType = 'stroke' | 'rect' | 'circle' | 'text';

export interface IBoard extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  lastEditedBy?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  visibility: 'private' | 'workspace';
  workspacePermission: BoardPermission;
  members: { userId: mongoose.Types.ObjectId; permission: BoardPermission }[];
  content: { elements: unknown[]; appState: Record<string, unknown> };
  assets: { assetId: string; fileName: string; mimeType: string; size: number; storageKey: string; localPath?: string; excalidrawFileId: string; uploadedBy: mongoose.Types.ObjectId }[];
  comments: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; content: string; mentions: mongoose.Types.ObjectId[]; reactions: { userId: mongoose.Types.ObjectId; emoji: string }[]; createdAt: Date }[];
  favorites: mongoose.Types.ObjectId[];
  archivedAt?: Date;
  projectId?: mongoose.Types.ObjectId;
  meetingId?: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  versions: { _id: mongoose.Types.ObjectId; name: string; content: { elements: unknown[]; appState: Record<string, unknown> }; createdBy: mongoose.Types.ObjectId; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const S = new Schema<IBoard>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    visibility: { type: String, enum: ['private', 'workspace'], default: 'workspace', index: true },
    workspacePermission: { type: String, enum: ['view', 'comment', 'edit'], default: 'edit' },
    members: [{ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, permission: { type: String, enum: ['view', 'comment', 'edit'], default: 'view' } }],
    content: { type: Schema.Types.Mixed, default: { elements: [], appState: {} } },
    assets: [{ assetId: String, fileName: String, mimeType: String, size: Number, storageKey: String, localPath: String, excalidrawFileId: String, uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' } }],
    comments: [{ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true, maxlength: 2000 }, mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }], reactions: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, emoji: String }], createdAt: { type: Date, default: Date.now } }],
    favorites: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    archivedAt: { type: Date, default: null, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting' },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
    versions: [{ name: String, content: Schema.Types.Mixed, createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

S.index({ companyId: 1, archivedAt: 1, updatedAt: -1 });
S.index({ companyId: 1, createdBy: 1, archivedAt: 1 });
S.index({ companyId: 1, 'members.userId': 1, archivedAt: 1 });

export default mongoose.model<IBoard>('Board', S);