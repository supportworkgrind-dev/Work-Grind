import mongoose, { Document, Schema } from 'mongoose';

export type AcademicInvitationStatus = 'pending' | 'sent' | 'failed' | 'accepted' | 'revoked';

/**
 * Onboarding invitation for one academic person. Only a SHA-256 hash of the
 * single-use token is stored; re-sending rotates the token and expiry.
 */
export interface IAcademicInvitation extends Document {
  companyId: mongoose.Types.ObjectId;
  personId: mongoose.Types.ObjectId;
  email: string;
  tokenHash?: string;
  status: AcademicInvitationStatus;
  expiresAt?: Date;
  sendAttempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  lastError?: string;
  acceptedAt?: Date;
  acceptedUserId?: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  importJobId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicInvitationSchema = new Schema<IAcademicInvitation>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    personId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    tokenHash: { type: String, match: /^[a-f0-9]{64}$/ },
    status: { type: String, enum: ['pending', 'sent', 'failed', 'accepted', 'revoked'], required: true, default: 'pending' },
    expiresAt: Date,
    sendAttempts: { type: Number, required: true, min: 0, default: 0 },
    lastAttemptAt: Date,
    sentAt: Date,
    lastError: { type: String, trim: true, maxlength: 300 },
    acceptedAt: Date,
    acceptedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    importJobId: { type: Schema.Types.ObjectId, ref: 'AcademicImportJob' },
  },
  { timestamps: true },
);

AcademicInvitationSchema.index({ companyId: 1, personId: 1 }, { unique: true });
AcademicInvitationSchema.index({ tokenHash: 1 }, { unique: true, partialFilterExpression: { tokenHash: { $type: 'string' } } });
AcademicInvitationSchema.index({ companyId: 1, status: 1, updatedAt: -1 });

export default mongoose.model<IAcademicInvitation>('AcademicInvitation', AcademicInvitationSchema);
