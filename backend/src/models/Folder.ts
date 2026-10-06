import mongoose, { Document, Schema } from 'mongoose';
export interface IFolder extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId; creatorId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId; projectId?: mongoose.Types.ObjectId;
  name: string; color?: string; isStarred: boolean; createdAt: Date; updatedAt: Date;
}
const S = new Schema<IFolder>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Folder' },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  name: { type: String, required: true, trim: true }, color: String,
  isStarred: { type: Boolean, default: false },
}, { timestamps: true });
S.index({ companyId: 1, parentId: 1 });
export default mongoose.model<IFolder>('Folder', S);
