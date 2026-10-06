import mongoose, { Document, Schema } from 'mongoose';

export type DealStage =
  | 'new_lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IDealActivity {
  _id?: mongoose.Types.ObjectId;
  type: 'note' | 'email' | 'call' | 'meeting' | 'stage_change';
  content: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ICrmDeal extends Document {
  companyId: mongoose.Types.ObjectId;          // workspace isolation
  title: string;
  value?: number;
  currency: string;
  stage: DealStage;
  priority: DealPriority;
  contactId?: mongoose.Types.ObjectId;
  crmCompanyId?: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  closeDate?: Date;
  probability?: number;                        // 0–100
  description?: string;
  tags: string[];
  lostReason?: string;
  activities: IDealActivity[];
  createdAt: Date;
  updatedAt: Date;
}

const DealActivitySchema = new Schema<IDealActivity>(
  {
    type:      { type: String, enum: ['note', 'email', 'call', 'meeting', 'stage_change'], required: true },
    content:   { type: String, required: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CrmDealSchema = new Schema<ICrmDeal>(
  {
    companyId:    { type: Schema.Types.ObjectId, ref: 'Company',    required: true, index: true },
    title:        { type: String, required: true, trim: true, maxlength: 200 },
    value:        { type: Number, min: 0 },
    currency:     { type: String, default: 'USD', maxlength: 3 },
    stage:        { type: String, enum: ['new_lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], default: 'new_lead' },
    priority:     { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    contactId:    { type: Schema.Types.ObjectId, ref: 'CrmContact' },
    crmCompanyId: { type: Schema.Types.ObjectId, ref: 'CrmCompany' },
    ownerId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closeDate:    { type: Date },
    probability:  { type: Number, min: 0, max: 100 },
    description:  { type: String, maxlength: 3000 },
    tags:         [{ type: String, trim: true, maxlength: 50 }],
    lostReason:   { type: String, maxlength: 500 },
    activities:   [DealActivitySchema],
  },
  { timestamps: true }
);

CrmDealSchema.index({ companyId: 1, stage: 1 });
CrmDealSchema.index({ companyId: 1, ownerId: 1 });
CrmDealSchema.index({ companyId: 1, contactId: 1 });

export const CrmDeal = mongoose.model<ICrmDeal>('CrmDeal', CrmDealSchema);
