import mongoose, { Document, Schema } from 'mongoose';

export type CallSessionStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'cancelled' | 'completed' | 'declined' | 'ended';

export interface ICallSession extends Document {
  sessionId: string;
  callerId: mongoose.Types.ObjectId;
  calleeId: mongoose.Types.ObjectId;
  status: CallSessionStatus;
  direction: 'outgoing';
  createdAt: Date;
  startedAt: Date;
  expiresAt: Date;
  answeredAt?: Date;
  acceptedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  crmContactId?: mongoose.Types.ObjectId;
}

const CallSessionSchema = new Schema<ICallSession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  calleeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['ringing', 'accepted', 'rejected', 'missed', 'cancelled', 'completed', 'declined', 'ended'], required: true, default: 'ringing' },
  direction: { type: String, enum: ['outgoing'], default: 'outgoing', required: true },
  startedAt: { type: Date, default: Date.now, required: true },
  expiresAt: { type: Date, required: true },
  answeredAt: Date,
  acceptedAt: Date,
  endedAt: Date,
  durationSeconds: { type: Number, min: 0 },
  crmContactId: { type: Schema.Types.ObjectId, ref: 'CrmContact' },
}, { timestamps: true });

CallSessionSchema.index({ callerId: 1, createdAt: -1 });
CallSessionSchema.index({ calleeId: 1, createdAt: -1 });
CallSessionSchema.index({ callerId: 1, calleeId: 1, status: 1, createdAt: -1 });
CallSessionSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model<ICallSession>('CallSession', CallSessionSchema);
