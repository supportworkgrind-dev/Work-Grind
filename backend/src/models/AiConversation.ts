import mongoose, { Document, Schema } from 'mongoose';

export type AgentMessageRole = 'user' | 'assistant' | 'tool';

export interface IAgentMessage {
  role:       AgentMessageRole;
  content:    string;
  /** For tool calls — name of the tool that was invoked */
  toolName?:  string;
  /** For tool calls — result payload (stored as string to avoid schema coupling) */
  toolResult?: string;
  createdAt:  Date;
}

export interface IAiConversation extends Document {
  _id:       mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  userId:    mongoose.Types.ObjectId;
  title?:    string;
  messages:  IAgentMessage[];
  pendingVoiceAction?: {
    toolName: string;
    toolArgs: Record<string, unknown>;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AgentMessageSchema = new Schema<IAgentMessage>(
  {
    role:       { type: String, enum: ['user', 'assistant', 'tool'], required: true },
    content:    { type: String, required: true, maxlength: 32_000 },
    toolName:   { type: String },
    toolResult: { type: String, maxlength: 32_000 },
    createdAt:  { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiConversationSchema = new Schema<IAiConversation>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    userId:    { type: Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    title:     { type: String, maxlength: 200 },
    messages:  { type: [AgentMessageSchema], default: [] },
    pendingVoiceAction: {
      toolName: { type: String },
      toolArgs: { type: Schema.Types.Mixed },
      createdAt: { type: Date },
    },
  },
  { timestamps: true }
);

AiConversationSchema.index({ companyId: 1, userId: 1, updatedAt: -1 });

export default mongoose.model<IAiConversation>('AiConversation', AiConversationSchema);
