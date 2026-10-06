import mongoose, { Document, Schema } from 'mongoose';

export type ApprovalTargetType = 'project' | 'task' | 'meeting' | 'document' | 'file';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';
export type ApprovalActorType = 'employee' | 'client';

export interface IApproval extends Document {
  companyId: mongoose.Types.ObjectId;
  crmCompanyId?: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  targetType: ApprovalTargetType;
  targetId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  requesterType: ApprovalActorType;
  requesterId: mongoose.Types.ObjectId;
  requesterName: string;
  approverType: ApprovalActorType;
  approverId: mongoose.Types.ObjectId;
  approverName: string;
  status: ApprovalStatus;
  dueAt?: Date;
  history: {
    actorType: ApprovalActorType;
    actorId: mongoose.Types.ObjectId;
    actorName: string;
    status: ApprovalStatus;
    comment?: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const S = new Schema<IApproval>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  crmCompanyId: { type: Schema.Types.ObjectId, ref: 'CrmCompany' },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  targetType: { type: String, enum: ['project', 'task', 'meeting', 'document', 'file'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 4000 },
  requesterType: { type: String, enum: ['employee', 'client'], required: true },
  requesterId: { type: Schema.Types.ObjectId, required: true },
  requesterName: { type: String, required: true, trim: true },
  approverType: { type: String, enum: ['employee', 'client'], required: true },
  approverId: { type: Schema.Types.ObjectId, required: true },
  approverName: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'changes_requested'], default: 'pending' },
  dueAt: Date,
  history: [{
    actorType: { type: String, enum: ['employee', 'client'], required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'changes_requested'], required: true },
    comment: { type: String, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

S.index({ companyId: 1, projectId: 1, status: 1, createdAt: -1 });
S.index({ companyId: 1, crmCompanyId: 1, status: 1, createdAt: -1 });
S.index({ approverType: 1, approverId: 1, status: 1 });

export default mongoose.model<IApproval>('Approval', S);