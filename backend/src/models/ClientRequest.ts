import mongoose, { Document, Schema } from 'mongoose';

export type ClientRequestStatus = 'submitted' | 'in_review' | 'resolved' | 'rejected';

export interface IClientRequest extends Document {
  companyId: mongoose.Types.ObjectId;
  clientUserId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: ClientRequestStatus;
  comments: {
    authorType: 'client' | 'team';
    authorId: mongoose.Types.ObjectId;
    authorName: string;
    content: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const S = new Schema<IClientRequest>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  clientUserId: { type: Schema.Types.ObjectId, ref: 'ClientUser', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: ['submitted', 'in_review', 'resolved', 'rejected'], default: 'submitted' },
  comments: [{
    authorType: { type: String, enum: ['client', 'team'], required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    authorName: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

S.index({ companyId: 1, projectId: 1, status: 1, createdAt: -1 });
S.index({ clientUserId: 1, createdAt: -1 });

export default mongoose.model<IClientRequest>('ClientRequest', S);