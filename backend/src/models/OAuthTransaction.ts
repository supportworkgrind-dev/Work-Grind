import mongoose, { Document, Schema } from 'mongoose';
import { OrganizationType, ORGANIZATION_TYPES } from '../config/organization';

export type OAuthProvider = 'google' | 'apple';

export interface IOAuthTransaction extends Document {
  stateHash: string;
  provider: OAuthProvider;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  intent: 'login' | 'link' | 'signup';
  accountType?: 'company' | 'individual';
  organizationType?: OrganizationType;
  userId?: mongoose.Types.ObjectId;
  expiresAt: Date;
}

const OAuthTransactionSchema = new Schema<IOAuthTransaction>({
  stateHash: { type: String, required: true, unique: true },
  provider: { type: String, required: true, enum: ['google', 'apple'] },
  nonce: { type: String, required: true },
  codeVerifier: { type: String, required: true },
  returnTo: { type: String, required: true },
  intent: { type: String, required: true, enum: ['login', 'link', 'signup'] },
  accountType: { type: String, enum: ['company', 'individual'] },
  organizationType: { type: String, enum: ORGANIZATION_TYPES },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });

export default mongoose.model<IOAuthTransaction>('OAuthTransaction', OAuthTransactionSchema);
