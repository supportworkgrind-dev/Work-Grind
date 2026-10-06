import mongoose, { Document, Schema } from 'mongoose';

export type ContactStatus = 'lead' | 'prospect' | 'customer' | 'churned' | 'inactive';

export interface ICrmContact extends Document {
  companyId: mongoose.Types.ObjectId;          // workspace isolation
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  crmCompanyId?: mongoose.Types.ObjectId;      // linked CRM company
  ownerId: mongoose.Types.ObjectId;            // WorkGrind user who owns this contact
  status: ContactStatus;
  tags: string[];
  notes?: string;
  linkedInUrl?: string;
  avatarUrl?: string;
  dealIds: mongoose.Types.ObjectId[];
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CrmContactSchema = new Schema<ICrmContact>(
  {
    companyId:      { type: Schema.Types.ObjectId, ref: 'Company',    required: true, index: true },
    firstName:      { type: String, required: true, trim: true, maxlength: 100 },
    lastName:       { type: String, required: true, trim: true, maxlength: 100 },
    email:          { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone:          { type: String, trim: true, maxlength: 30 },
    jobTitle:       { type: String, trim: true, maxlength: 150 },
    department:     { type: String, trim: true, maxlength: 100 },
    crmCompanyId:   { type: Schema.Types.ObjectId, ref: 'CrmCompany', index: true },
    ownerId:        { type: Schema.Types.ObjectId, ref: 'User',       required: true },
    status:         { type: String, enum: ['lead', 'prospect', 'customer', 'churned', 'inactive'], default: 'lead' },
    tags:           [{ type: String, trim: true, maxlength: 50 }],
    notes:          { type: String, maxlength: 5000 },
    linkedInUrl:    { type: String, trim: true, maxlength: 300 },
    avatarUrl:      { type: String, trim: true },
    dealIds:        [{ type: Schema.Types.ObjectId, ref: 'CrmDeal' }],
    lastContactedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for fast per-workspace queries
CrmContactSchema.index({ companyId: 1, status: 1 });
CrmContactSchema.index({ companyId: 1, crmCompanyId: 1 });
CrmContactSchema.index({ companyId: 1, email: 1 });

export const CrmContact = mongoose.model<ICrmContact>('CrmContact', CrmContactSchema);
