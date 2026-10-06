import mongoose, { Document, Schema } from 'mongoose';

export interface IOAuthExchange extends Document {
  codeHash: string;
  userId: mongoose.Types.ObjectId;
  returnTo: string;
  expiresAt: Date;
}

const OAuthExchangeSchema = new Schema<IOAuthExchange>({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  returnTo: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });

export default mongoose.model<IOAuthExchange>('OAuthExchange', OAuthExchangeSchema);
