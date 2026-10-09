import mongoose, { Document, Schema } from 'mongoose';

export interface IRealtimePresence extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  socketId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RealtimePresenceSchema = new Schema<IRealtimePresence>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  socketId: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

RealtimePresenceSchema.index({ userId: 1, expiresAt: 1 });
RealtimePresenceSchema.index({ companyId: 1, expiresAt: 1 });
RealtimePresenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRealtimePresence>('RealtimePresence', RealtimePresenceSchema);
