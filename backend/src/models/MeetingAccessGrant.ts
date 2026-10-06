import mongoose, { Schema } from 'mongoose';

const MeetingAccessGrantSchema = new Schema({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

MeetingAccessGrantSchema.index({ meetingId: 1, userId: 1, expiresAt: 1 });
MeetingAccessGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('MeetingAccessGrant', MeetingAccessGrantSchema);
