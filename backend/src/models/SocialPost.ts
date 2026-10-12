import mongoose, { Document, Schema } from 'mongoose';

export type SocialPostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'publishing'
  | 'published'
  | 'failed';

export interface ISocialPost extends Document {
  companyId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  reviewerId?: mongoose.Types.ObjectId;
  text: string;
  status: SocialPostStatus;
  rejectionReason?: string;
  linkedinPostUrn?: string;
  publishedAt?: Date;
  failureCode?: string;
}

const SocialPostSchema = new Schema<ISocialPost>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true, trim: true, maxlength: 3000 },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'publishing', 'published', 'failed'],
    default: 'draft',
    required: true,
  },
  rejectionReason: { type: String, maxlength: 500 },
  linkedinPostUrn: String,
  publishedAt: Date,
  failureCode: String,
}, { timestamps: true });

SocialPostSchema.index({ companyId: 1, updatedAt: -1 });
SocialPostSchema.index({ companyId: 1, status: 1 });

export default mongoose.model<ISocialPost>('SocialPost', SocialPostSchema);
