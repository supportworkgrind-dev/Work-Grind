import mongoose, { Document, Schema } from 'mongoose';
export interface IAuditLog extends Document {
  companyId: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId;
  action: string; resource: string; resourceId?: string;
  details?: Record<string, any>; ipAddress?: string; createdAt: Date;
}
const S = new Schema<IAuditLog>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, resource: { type: String, required: true },
  resourceId: String, details: Schema.Types.Mixed, ipAddress: String,
}, { timestamps: true });
S.index({ companyId: 1, createdAt: -1 });
export default mongoose.model<IAuditLog>('AuditLog', S);
