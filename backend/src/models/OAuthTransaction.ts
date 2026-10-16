import mongoose, { Document, Schema } from 'mongoose';
import { OrganizationType, ORGANIZATION_TYPES } from '../config/organization';

export type OAuthProvider = 'google' | 'apple' | 'linkedin';

export interface IOAuthTransaction extends Document {
  correlationId?: string;
  stateHash: string;
  provider: OAuthProvider;
  audience: 'user' | 'client';
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  intent: 'login' | 'link' | 'signup' | 'publishing';
  accountType?: 'company' | 'individual';
  organizationType?: OrganizationType;
  userId?: mongoose.Types.ObjectId;
  clientUserId?: mongoose.Types.ObjectId;
  expiresAt: Date;
}

const OAuthTransactionSchema = new Schema<IOAuthTransaction>({
  correlationId: { type: String, maxlength: 64 },
  stateHash: { type: String, required: true, unique: true },
  provider: { type: String, required: true, enum: ['google', 'apple', 'linkedin'] },
  audience: { type: String, enum: ['user', 'client'], default: 'user', required: true },
  nonce: { type: String, required: true },
  codeVerifier: { type: String, required: true },
  returnTo: { type: String, required: true },
  intent: { type: String, required: true, enum: ['login', 'link', 'signup', 'publishing'] },
  accountType: { type: String, enum: ['company', 'individual'] },
  organizationType: { type: String, enum: ORGANIZATION_TYPES },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  clientUserId: { type: Schema.Types.ObjectId, ref: 'ClientUser' },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });

export default mongoose.model<IOAuthTransaction>('OAuthTransaction', OAuthTransactionSchema);
