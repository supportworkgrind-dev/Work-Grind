import mongoose, { Document, Schema } from 'mongoose';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export interface ITask extends Document {
  _id: mongoose.Types.ObjectId; companyId: mongoose.Types.ObjectId; projectId?: mongoose.Types.ObjectId;
  title: string; description?: string; assigneeId?: mongoose.Types.ObjectId; creatorId: mongoose.Types.ObjectId;
  priority: 'low'|'medium'|'high'|'urgent'; status: 'todo'|'in_progress'|'review'|'completed'|'blocked';
  startDate?: Date; dueDate?: Date; completedAt?: Date; dueReminderDate?: string; tags: string[];
  recurrence: TaskRecurrence; dependencyIds: mongoose.Types.ObjectId[]; estimatedMinutes?: number;
  customFields: { key: string; value: string }[];
  timeEntries: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; startedAt: Date; stoppedAt?: Date | null; durationSeconds: number }[];
  attachments: { name: string; url: string; type: string; size: number }[];
  subtasks: { _id: mongoose.Types.ObjectId; title: string; isCompleted: boolean; assigneeId?: mongoose.Types.ObjectId }[];
  comments: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; content: string; createdAt: Date }[];
  position: number; isArchived: boolean; createdAt: Date; updatedAt: Date;
}
const S = new Schema<ITask>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  title: { type: String, required: true, trim: true }, description: String,
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  priority: { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
  status: { type: String, enum: ['todo','in_progress','review','completed','blocked'], default: 'todo' },
  startDate: Date, dueDate: Date, completedAt: Date, dueReminderDate: String,
  recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  dependencyIds: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  estimatedMinutes: { type: Number, min: 0, max: 525600 },
  customFields: [{ key: { type: String, required: true, trim: true, maxlength: 60 }, value: { type: String, trim: true, maxlength: 500 } }],
  timeEntries: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true },
    stoppedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0, min: 0 },
  }],
  tags: [String],
  attachments: [{ name: String, url: String, type: String, size: Number }],
  subtasks: [{ title: { type: String, required: true }, isCompleted: { type: Boolean, default: false }, assigneeId: { type: Schema.Types.ObjectId, ref: 'User' } }],
  comments: [{ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }],
  position: { type: Number, default: 0 }, isArchived: { type: Boolean, default: false },
}, { timestamps: true });
S.index({ companyId: 1, assigneeId: 1, status: 1 });
S.index({ companyId: 1, projectId: 1 });
S.index({ companyId: 1, dueDate: 1 });
S.index({ companyId: 1, isArchived: 1, createdAt: -1 });
S.index({ companyId: 1, isArchived: 1, status: 1 });
S.index({ companyId: 1, assigneeId: 1, isArchived: 1, dueDate: 1 });
S.index({ projectId: 1, isArchived: 1, status: 1 });
export default mongoose.model<ITask>('Task', S);
