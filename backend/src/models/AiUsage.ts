import mongoose, { Document, Schema } from 'mongoose';

export interface I_AiUsageDocument extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  feature: string;
  provider: 'local' | 'gemini' | 'openai' | 'cloudflare' | 'fallback';
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
  timestamp: Date;
  cached?: boolean;
}

const AiUsageSchema = new Schema<I_AiUsageDocument>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  feature: { type: String, maxlength: 80, required: true },
  provider: { type: String, enum: ['local', 'gemini', 'openai', 'cloudflare', 'fallback'], required: true },
  modelName: { type: String, maxlength: 120, required: true },
  inputTokens: { type: Number },
  outputTokens: { type: Number },
  success: { type: Boolean, default: true },
  errorMessage: { type: String, maxlength: 500 },
  durationMs: { type: Number },
  timestamp: { type: Date, default: Date.now, index: true },
  cached: { type: Boolean, default: false },
});

AiUsageSchema.index({ companyId: 1, timestamp: -1 });
AiUsageSchema.index({ userId: 1, timestamp: -1 });
AiUsageSchema.index({ companyId: 1, provider: 1, timestamp: -1 });
AiUsageSchema.index({ feature: 1, timestamp: -1 });

export default mongoose.model<I_AiUsageDocument>('AiUsage', AiUsageSchema);
