import mongoose, { Document, Schema } from 'mongoose';

export type ReportTargetType = 'message' | 'user' | 'conversation';
export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'inappropriate_content'
  | 'hate_speech'
  | 'violence'
  | 'privacy_violation'
  | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IModerationAction {
  moderatorId: mongoose.Types.ObjectId;
  action: string;   // e.g. 'MESSAGE_DELETED', 'USER_WARNED', 'USER_SUSPENDED', 'DISMISSED'
  note?: string;
  timestamp: Date;
}

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;

  // Who reported
  reporterId: mongoose.Types.ObjectId;

  // What is being reported
  targetType: ReportTargetType;
  targetId: string;               // messageId | userId | conversationId

  // Snapshot context (stored at report time so content can be viewed even if deleted)
  targetSnapshot?: {
    content?: string;
    senderName?: string;
    senderId?: string;
    conversationId?: string;
    channelId?: string;
    createdAt?: Date;
  };

  reason: ReportReason;
  details?: string;               // reporter's free-text description

  severity: ReportSeverity;
  status: ReportStatus;

  // Moderation trail
  actions: IModerationAction[];
  assignedTo?: mongoose.Types.ObjectId;  // moderator handling this report

  createdAt: Date;
  updatedAt: Date;
}

const ModerationActionSchema = new Schema<IModerationAction>(
  {
    moderatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action:      { type: String, required: true },
    note:        { type: String },
    timestamp:   { type: Date, default: Date.now },
  },
  { _id: true }
);

const ReportSchema = new Schema<IReport>(
  {
    companyId:  { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    targetType: {
      type: String,
      enum: ['message', 'user', 'conversation'],
      required: true,
    },
    targetId: { type: String, required: true },

    targetSnapshot: {
      content:        String,
      senderName:     String,
      senderId:       String,
      conversationId: String,
      channelId:      String,
      createdAt:      Date,
    },

    reason: {
      type: String,
      enum: ['harassment','spam','inappropriate_content','hate_speech','violence','privacy_violation','other'],
      required: true,
    },
    details: { type: String, maxlength: 2000 },

    severity: {
      type: String,
      enum: ['low','medium','high','critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open','reviewing','resolved','dismissed'],
      default: 'open',
      index: true,
    },

    actions:    [ModerationActionSchema],
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ReportSchema.index({ companyId: 1, status: 1, createdAt: -1 });
ReportSchema.index({ companyId: 1, targetId: 1 });
ReportSchema.index({ companyId: 1, reporterId: 1 });
ReportSchema.index({ companyId: 1, severity: 1, status: 1 });

export default mongoose.model<IReport>('Report', ReportSchema);
