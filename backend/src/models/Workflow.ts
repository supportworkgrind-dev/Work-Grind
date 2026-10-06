import mongoose, { Document, Schema } from 'mongoose';

export type WorkflowTriggerType =
  | 'deal_created' | 'deal_updated' | 'deal_stage_changed'
  | 'contact_created'
  | 'task_created' | 'task_completed' | 'task_overdue'
  | 'project_status_changed'
  | 'meeting_ended'
  | 'file_uploaded';

export type WorkflowActionType =
  | 'create_task' | 'update_crm' | 'send_notification'
  | 'send_channel_message' | 'create_meeting' | 'ai_analysis' | 'ai_summary';

export interface IWorkflowCondition {
  field:    string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value:    string | number;
}

export interface IWorkflowAction {
  type:   WorkflowActionType;
  config: Record<string, any>;
}

export interface IWorkflowExecution {
  triggeredAt: Date;
  triggerData: Record<string, any>;
  success:     boolean;
  error?:      string;
  actionsRun:  Array<{ type: string; success: boolean; result?: any; error?: string }>;
}

export interface IWorkflow extends Document {
  _id:        mongoose.Types.ObjectId;
  companyId:  mongoose.Types.ObjectId;
  creatorId:  mongoose.Types.ObjectId;
  name:       string;
  description?: string;
  isEnabled:  boolean;
  trigger:    { type: WorkflowTriggerType; config?: Record<string, any> };
  conditions: IWorkflowCondition[];
  actions:    IWorkflowAction[];
  executions: IWorkflowExecution[];
  lastRunAt?: Date;
  runCount:   number;
  failCount:  number;
  createdAt:  Date;
  updatedAt:  Date;
}

const ExecutionSchema = new Schema<IWorkflowExecution>({
  triggeredAt: { type: Date, default: Date.now },
  triggerData: { type: Schema.Types.Mixed, default: {} },
  success:     { type: Boolean, required: true },
  error:       String,
  actionsRun:  [{
    type:    String,
    success: Boolean,
    result:  Schema.Types.Mixed,
    error:   String,
  }],
}, { _id: false });

const WorkflowSchema = new Schema<IWorkflow>({
  companyId:   { type: Schema.Types.ObjectId, ref: 'Company',  required: true },
  creatorId:   { type: Schema.Types.ObjectId, ref: 'User',     required: true },
  name:        { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, maxlength: 1000 },
  isEnabled:   { type: Boolean, default: true },
  trigger: {
    type:   { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  conditions: [{
    field:    String,
    operator: { type: String, enum: ['equals','not_equals','greater_than','less_than','contains'] },
    value:    Schema.Types.Mixed,
    _id:      false,
  }],
  actions: [{
    type:   { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    _id:    false,
  }],
  executions: { type: [ExecutionSchema], default: [] },
  lastRunAt:  Date,
  runCount:   { type: Number, default: 0 },
  failCount:  { type: Number, default: 0 },
}, { timestamps: true });

WorkflowSchema.index({ companyId: 1, isEnabled: 1 });
WorkflowSchema.index({ companyId: 1, 'trigger.type': 1, isEnabled: 1 });
WorkflowSchema.index({ companyId: 1, createdAt: -1 });

// Keep only last 50 executions per workflow
WorkflowSchema.pre('save', function (next) {
  if (this.executions.length > 50) {
    this.executions = this.executions.slice(-50);
  }
  next();
});

export default mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
