import mongoose, { Document, Schema } from 'mongoose';

export interface IPendingRegistration extends Document {
  email: string;
  phone: string;
  fullName: string;
  passwordCiphertext: string;
  passwordIv: string;
  passwordAuthTag: string;
  verificationCodeHash: string;
  verificationExpiresAt: Date;
  expiresAt: Date;
  attempts: number;
  resendCount: number;
  lastSentAt: Date;
}

const PendingRegistrationSchema = new Schema<IPendingRegistration>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  passwordCiphertext: { type: String, required: true },
  passwordIv: { type: String, required: true },
  passwordAuthTag: { type: String, required: true },
  verificationCodeHash: { type: String, required: true },
  verificationExpiresAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts: { type: Number, default: 0 },
  resendCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
}, { timestamps: true });

PendingRegistrationSchema.index({ phone: 1, expiresAt: 1 });

export default mongoose.model<IPendingRegistration>('PendingRegistration', PendingRegistrationSchema);
