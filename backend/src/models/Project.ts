import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  crmCompanyId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  managerId: mongoose.Types.ObjectId;
  assigneeId?: mongoose.Types.ObjectId;
  channelId?: mongoose.Types.ObjectId;
  members: { userId: mongoose.Types.ObjectId; role: 'manager' | 'member' | 'viewer' }[];
  startDate?: Date;
  deadline?: Date;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  progress: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const S = new Schema<IProject>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    crmCompanyId: { type: Schema.Types.ObjectId, ref: 'CrmCompany' },
    name: { type: String, required: true, trim: true },
    description: String,
    color: { type: String, default: '#4F46E5' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel' },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['manager', 'member', 'viewer'], default: 'member' },
      },
    ],
    startDate: Date,
    deadline: Date,
    status: { type: String, enum: ['planning', 'active', 'on_hold', 'completed'], default: 'planning' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

S.index({ companyId: 1, status: 1 });
S.index({ companyId: 1, isArchived: 1, createdAt: -1 });
S.index({ companyId: 1, 'members.userId': 1, isArchived: 1 });
S.index({ companyId: 1, assigneeId: 1, isArchived: 1 });
S.index({ companyId: 1, managerId: 1, isArchived: 1 });
S.index({ companyId: 1, channelId: 1 });
S.index({ companyId: 1, crmCompanyId: 1, isArchived: 1 });

export default mongoose.model<IProject>('Project', S);
