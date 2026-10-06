import mongoose, { Document, Schema } from 'mongoose';

export interface ISupportReply {
  replyText: string;
  sentBy: string;
  sentAt: Date;
  emailMessageId?: string;
}

export interface ISupportTicket extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'contact' | 'demo';
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
  status: 'new' | 'replied' | 'closed' | 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  replies: ISupportReply[];
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema = new Schema<ISupportReply>(
  {
    replyText: { type: String, required: true },
    sentBy: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    emailMessageId: { type: String },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    type: {
      type: String,
      enum: ['contact', 'demo'],
      default: 'contact',
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    company: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['new', 'replied', 'closed', 'open', 'in_progress', 'resolved'],
      default: 'new',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    replies: [ReplySchema],
    adminNotes: { type: String },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ type: 1, status: 1, createdAt: -1 });
SupportTicketSchema.index({ isRead: 1, createdAt: -1 });
SupportTicketSchema.index({ email: 1 });

export default mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

