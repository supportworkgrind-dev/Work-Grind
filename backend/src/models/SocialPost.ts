import mongoose, { Document, Schema } from 'mongoose';

export type SocialPostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

export type SocialProviderId = 'linkedin' | 'instagram' | 'facebook' | 'youtube';

export interface ISocialPostDestination {
  provider: SocialProviderId;
  integrationId?: mongoose.Types.ObjectId;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  externalPostId?: string;
  externalPostUrl?: string;
  errorCode?: string;
  publishedAt?: Date;
}

export interface ISocialPost extends Document {
  companyId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  reviewerId?: mongoose.Types.ObjectId;
  scheduledBy?: mongoose.Types.ObjectId;
  text: string;
  platform: SocialProviderId;
  integrationId?: mongoose.Types.ObjectId;
  destinations: ISocialPostDestination[];
  media: { mimeType: string; fileId?: mongoose.Types.ObjectId; altText?: string }[];
  platformData: Record<string, unknown>;
  status: SocialPostStatus;
  scheduledAt?: Date;
  scheduleTimeZone?: string;
  scheduledFromStatus?: 'draft' | 'approved';
  scheduleAttempts: number;
  rejectionReason?: string;
  linkedinPostUrn?: string;
  linkedinPostUrl?: string;
  publishedAt?: Date;
  failureCode?: string;
}

const SocialPostDestinationSchema = new Schema<ISocialPostDestination>({
  provider: { type: String, enum: ['linkedin', 'instagram', 'facebook', 'youtube'], required: true },
  integrationId: { type: Schema.Types.ObjectId, ref: 'Integration' },
  status: { type: String, enum: ['pending', 'publishing', 'published', 'failed'], required: true },
  externalPostId: { type: String, maxlength: 500 },
  externalPostUrl: { type: String, maxlength: 2048 },
  errorCode: { type: String, maxlength: 100 },
  publishedAt: Date,
}, { _id: false });

const SocialPostSchema = new Schema<ISocialPost>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  scheduledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true, trim: true, maxlength: 3000 },
  platform: {
    type: String,
    enum: ['linkedin', 'instagram', 'facebook', 'youtube'],
    default: 'linkedin',
    required: true,
  },
  integrationId: { type: Schema.Types.ObjectId, ref: 'Integration' },
  destinations: { type: [SocialPostDestinationSchema], default: [] },
  media: {
    type: [{
      mimeType: { type: String, required: true, maxlength: 100 },
      fileId: { type: Schema.Types.ObjectId, ref: 'File' },
      altText: { type: String, maxlength: 1000 },
    }],
    default: [],
  },
  platformData: { type: Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'publishing', 'published', 'failed'],
    default: 'draft',
    required: true,
  },
  scheduledAt: Date,
  scheduleTimeZone: { type: String, maxlength: 100 },
  scheduledFromStatus: { type: String, enum: ['draft', 'approved'] },
  scheduleAttempts: { type: Number, default: 0, min: 0 },
  rejectionReason: { type: String, maxlength: 500 },
  linkedinPostUrn: String,
  linkedinPostUrl: String,
  publishedAt: Date,
  failureCode: String,
}, { timestamps: true });

SocialPostSchema.index({ companyId: 1, updatedAt: -1 });
SocialPostSchema.index({ companyId: 1, status: 1 });
SocialPostSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model<ISocialPost>('SocialPost', SocialPostSchema);
