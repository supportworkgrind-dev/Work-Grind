import mongoose, { Document, Schema } from 'mongoose';

export interface IOAuthExchange extends Document {
  codeHash: string;
  audience: 'user' | 'client';
  userId?: mongoose.Types.ObjectId;
  clientUserId?: mongoose.Types.ObjectId;
  returnTo: string;
  expiresAt: Date;
}

const OAuthExchangeSchema = new Schema<IOAuthExchange>({
  codeHash: { type: String, required: true, unique: true },
  audience: { type: String, enum: ['user', 'client'], default: 'user', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  clientUserId: { type: Schema.Types.ObjectId, ref: 'ClientUser' },
  returnTo: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });

export default mongoose.model<IOAuthExchange>('OAuthExchange', OAuthExchangeSchema);
