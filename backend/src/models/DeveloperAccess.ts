import mongoose, { Document, Schema } from 'mongoose';

export const CONNECT_RESOURCES = ['contacts', 'companies', 'deals', 'projects', 'tasks', 'team'] as const;
export type ConnectResource = typeof CONNECT_RESOURCES[number];
export type ConnectScope = `${Exclude<ConnectResource, 'team'>}:${'read' | 'write'}` | 'team:read';
export const CONNECT_SCOPES: ConnectScope[] = CONNECT_RESOURCES.flatMap((resource) =>
  resource === 'team' ? ['team:read'] : [`${resource}:read`, `${resource}:write`],
) as ConnectScope[];

export interface IDeveloperApiKey extends Document {
  companyId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  name: string;
  lookupId: string;
  secretHash: string;
  scopes: ConnectScope[];
  lastUsedAt?: Date;
  revokedAt?: Date;
  rotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeveloperApiKeySchema = new Schema<IDeveloperApiKey>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  lookupId: { type: String, required: true, unique: true, index: true },
  secretHash: { type: String, required: true, select: false },
  scopes: [{ type: String, enum: CONNECT_SCOPES }],
  lastUsedAt: Date,
  revokedAt: Date,
  rotatedAt: Date,
}, { timestamps: true });
DeveloperApiKeySchema.index({ companyId:  1, createdAt: -1 });

export const DeveloperApiKey = mongoose.model<IDeveloperApiKey>('DeveloperApiKey', DeveloperApiKeySchema);

export interface IDeveloperApiRequestLog extends Document {
  companyId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: Date;
}

const DeveloperApiRequestLogSchema = new Schema<IDeveloperApiRequestLog>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'DeveloperApiKey', required: true, index: true },
  method: { type: String, required: true },
  path: { type: String, required: true, maxlength: 200 },
  statusCode: { type: Number, required: true },
  durationMs: { type: Number, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
DeveloperApiRequestLogSchema.index({ companyId: 1, createdAt: -1 });
DeveloperApiRequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const DeveloperApiRequestLog = mongoose.model<IDeveloperApiRequestLog>('DeveloperApiRequestLog', DeveloperApiRequestLogSchema);

const DeveloperApiRateWindowSchema = new Schema({
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'DeveloperApiKey', required: true },
  windowStart: { type: Date, required: true },
  requestCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
DeveloperApiRateWindowSchema.index({ apiKeyId: 1, windowStart: 1 }, { unique: true });
DeveloperApiRateWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const DeveloperApiRateWindow = mongoose.model('DeveloperApiRateWindow', DeveloperApiRateWindowSchema);

export interface IWebhookRegistration extends Document {
  companyId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  name: string;
  url: string;
  events: string[];
  isEnabled: boolean;
  deliveryStatus: 'not_configured';
  createdAt: Date;
  updatedAt: Date;
}

const WebhookRegistrationSchema = new Schema<IWebhookRegistration>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  url: { type: String, required: true, maxlength: 2048 },
  events: [{ type: String, trim: true, maxlength: 100 }],
  isEnabled: { type: Boolean, default: true },
  deliveryStatus: { type: String, enum: ['not_configured'], default: 'not_configured' },
}, { timestamps: true });
WebhookRegistrationSchema.index({ companyId: 1, createdAt: -1 });
export const WebhookRegistration = mongoose.model<IWebhookRegistration>('WebhookRegistration', WebhookRegistrationSchema);
