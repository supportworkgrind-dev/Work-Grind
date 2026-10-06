import mongoose, { Document, Schema } from 'mongoose';

export type StorageProvider = 'local' | 'r2';

export interface IFile extends Document {
  _id:         mongoose.Types.ObjectId;
  companyId:   mongoose.Types.ObjectId;
  uploaderId:  mongoose.Types.ObjectId;
  folderId?:   mongoose.Types.ObjectId;
  projectId?:  mongoose.Types.ObjectId;
  name:         string;
  originalName: string;
  mimeType:     string;
  size:         number;
  /** Legacy local URL — kept for backward compatibility with pre-R2 files */
  url:          string;
  /**
   * R2 object key, e.g. companies/{id}/files/{uuid}/{filename}
   * Only present for files stored in R2. Use this for signed-URL generation.
   */
  storageKey?:      string;
  storageProvider:  StorageProvider;
  isStarred:        boolean;
  sharedWith:       { userId: mongoose.Types.ObjectId; permission: 'view' | 'edit' }[];
  tags:             string[];
  isDeleted:        boolean;
  deletedAt?:       Date;
  createdAt:        Date;
  updatedAt:        Date;
}

const S = new Schema<IFile>(
  {
    companyId:  { type: Schema.Types.ObjectId, ref: 'Company',  required: true },
    uploaderId: { type: Schema.Types.ObjectId, ref: 'User',     required: true },
    folderId:   { type: Schema.Types.ObjectId, ref: 'Folder'   },
    projectId:  { type: Schema.Types.ObjectId, ref: 'Project'  },
    name:         { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType:     { type: String, required: true },
    size:         { type: Number, required: true },
    // Legacy field — remains for files uploaded before R2 migration
    url: {
      type: String,
      default: '',
      required: function(this: IFile) { return this.storageProvider === 'local'; },
    },
    // R2 fields
    storageKey:      { type: String },
    storageProvider: { type: String, enum: ['local', 'r2'], default: 'local' },
    isStarred:  { type: Boolean, default: false },
    sharedWith: [
      {
        userId:     { type: Schema.Types.ObjectId, ref: 'User' },
        permission: { type: String, enum: ['view', 'edit'], default: 'view' },
      },
    ],
    tags:      [String],
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

S.index({ companyId: 1, folderId: 1 });
S.index({ companyId: 1, uploaderId: 1 });
S.index({ companyId: 1, isDeleted: 1 });

export default mongoose.model<IFile>('File', S);
