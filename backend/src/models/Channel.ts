import mongoose, { Document, Schema } from 'mongoose';

export interface IChannel extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'public' | 'private';
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  pinnedMessages: mongoose.Types.ObjectId[];
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const S = new Schema<IChannel>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, maxlength: 500 },
    type: { type: String, enum: ['public', 'private'], default: 'public' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    isDefault: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

S.index({ companyId: 1, name: 1 }, { unique: true });
S.index({ companyId: 1, projectId: 1 });
S.index({ companyId: 1, isArchived: 1, type: 1 });
S.index({ companyId: 1, members: 1, isArchived: 1 });

export default mongoose.model<IChannel>('Channel', S);
