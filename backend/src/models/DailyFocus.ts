import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyFocusItem {
  id: string;
  type: 'task' | 'meeting' | 'message';
  title: string;
  reason: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
  badge: string;
  meta?: Record<string, any>;
}

export interface IDailyFocus extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  dateKey: string; // YYYY-MM-DD
  summary: string;
  focusItems: IDailyFocusItem[];
  generatedBy: 'ai' | 'rules';
  isAllClear: boolean;
  totalUrgentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyFocusItemSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['task', 'meeting', 'message'], required: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
    link: { type: String, required: true },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    badge: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const DailyFocusSchema = new Schema<IDailyFocus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    dateKey: { type: String, required: true },
    summary: { type: String, default: '' },
    focusItems: [DailyFocusItemSchema],
    generatedBy: { type: String, enum: ['ai', 'rules'], default: 'rules' },
    isAllClear: { type: Boolean, default: false },
    totalUrgentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DailyFocusSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
DailyFocusSchema.index({ companyId: 1, dateKey: 1 });

export default mongoose.model<IDailyFocus>('DailyFocus', DailyFocusSchema);
