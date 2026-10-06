import mongoose, { Document, Schema } from 'mongoose';

export type IntegrationProvider = 'webhook';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface IIntegration extends Document {
  _id:           mongoose.Types.ObjectId;
  companyId:     mongoose.Types.ObjectId;
  createdBy:     mongoose.Types.ObjectId;
  provider:      IntegrationProvider;
  status:        IntegrationStatus;
  /** OAuth access token — encrypted at rest */
  accessToken?:  string;
  /** OAuth refresh token — encrypted at rest */
  refreshToken?: string;
  tokenExpiresAt?: Date;
  /** Webhook secret / signing key */
  webhookSecret?: string;
  /** Inbound webhook URL token (for receiving events from third-party) */
  webhookToken?:  string;
  /** Provider-specific config (scopes, channel IDs, etc.) */
  config:        Record<string, any>;
  /** Last successful sync ISO timestamp */
  lastSyncAt?:   Date;
  /** Error message if status === 'error' */
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>({
  companyId:      { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy:      { type: Schema.Types.ObjectId, ref: 'User',    required: true },
  provider:       {
    type: String,
    enum: ['webhook'],
    required: true,
  },
  status:         { type: String, enum: ['connected','disconnected','error','pending'], default: 'disconnected' },
  // Tokens stored as opaque strings — encrypted before save by controller
  accessToken:    { type: String, select: false },
  refreshToken:   { type: String, select: false },
  tokenExpiresAt: Date,
  webhookSecret:  { type: String, select: false },
  webhookToken:   String,  // public token used in inbound webhook URL
  config:         { type: Schema.Types.Mixed, default: {} },
  lastSyncAt:     Date,
  errorMessage:   String,
}, { timestamps: true });

// One integration per provider per company
IntegrationSchema.index({ companyId: 1, provider: 1 }, { unique: true });
IntegrationSchema.index({ companyId: 1 });
IntegrationSchema.index({ webhookToken: 1 }, { sparse: true });

export default mongoose.model<IIntegration>('Integration', IntegrationSchema);
