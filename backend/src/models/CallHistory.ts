import mongoose, { Document, Schema } from 'mongoose';

export interface ICallActivity extends Document {
  companyId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  direction: 'incoming' | 'outgoing';
  outcome: 'answered' | 'missed' | 'outgoing';
  /** Retained only for legacy history rows; never returned by Calling APIs. */
  phoneNumber?: string;
  contactId?: mongoose.Types.ObjectId;
  teammateId?: mongoose.Types.ObjectId;
  calledAt: Date;
  durationMinutes?: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const CallActivitySchema = new Schema<ICallActivity>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
  outcome: { type: String, enum: ['answered', 'missed', 'outgoing'], required: true },
  phoneNumber: { type: String, trim: true, maxlength: 32, select: false },
  contactId: { type: Schema.Types.ObjectId, ref: 'CrmContact' },
  teammateId: { type: Schema.Types.ObjectId, ref: 'User' },
  calledAt: { type: Date, required: true },
  durationMinutes: { type: Number, min: 0, max: 1440 },
  notes: { type: String, trim: true, maxlength: 3000, default: '' },
}, { timestamps: true, collection: 'businessphoneactivities' });

CallActivitySchema.index({ companyId: 1, calledAt: -1 });
CallActivitySchema.index({ companyId: 1, direction: 1, outcome: 1, calledAt: -1 });

export const CallActivity = mongoose.model<ICallActivity>('CallActivity', CallActivitySchema);
