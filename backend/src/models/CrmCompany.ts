import mongoose, { Document, Schema } from 'mongoose';

export interface ICrmCompany extends Document {
  companyId: mongoose.Types.ObjectId;          // workspace isolation
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  ownerId: mongoose.Types.ObjectId;
  tags: string[];
  notes?: string;
  linkedInUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrmCompanySchema = new Schema<ICrmCompany>(
  {
    companyId:     { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name:          { type: String, required: true, trim: true, maxlength: 200 },
    domain:        { type: String, trim: true, lowercase: true, maxlength: 253 },
    website:       { type: String, trim: true, maxlength: 300 },
    industry:      { type: String, trim: true, maxlength: 100 },
    employeeCount: { type: Number, min: 0 },
    annualRevenue: { type: Number, min: 0 },
    country:       { type: String, trim: true, maxlength: 100 },
    city:          { type: String, trim: true, maxlength: 100 },
    address:       { type: String, trim: true, maxlength: 300 },
    phone:         { type: String, trim: true, maxlength: 30 },
    logoUrl:       { type: String, trim: true },
    ownerId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tags:          [{ type: String, trim: true, maxlength: 50 }],
    notes:         { type: String, maxlength: 5000 },
    linkedInUrl:   { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

CrmCompanySchema.index({ companyId: 1, name: 1 });
CrmCompanySchema.index({ companyId: 1, domain: 1 });

export const CrmCompany = mongoose.model<ICrmCompany>('CrmCompany', CrmCompanySchema);
