import mongoose, { Document, Schema } from 'mongoose';

export type FeePaymentMethod = 'cash' | 'bank_transfer' | 'other';

export interface IFeePayment {
  amountMinor: number;
  method: FeePaymentMethod;
  reference?: string;
  receivedAt: Date;
  recordedBy: mongoose.Types.ObjectId;
}

export interface IAcademicFeeCharge extends Document {
  companyId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  description: string;
  amountMinor: number;
  paidAmountMinor: number;
  currency: string;
  dueAt?: Date;
  isVoided: boolean;
  payments: IFeePayment[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeePaymentSchema = new Schema<IFeePayment>(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'Payment must be an integer in minor currency units.' },
    },
    method: { type: String, enum: ['cash', 'bank_transfer', 'other'], required: true },
    reference: { type: String, trim: true, maxlength: 120 },
    receivedAt: { type: Date, default: Date.now, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const AcademicFeeChargeSchema = new Schema<IAcademicFeeCharge>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'AcademicPerson', required: true },
    invoiceNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 180 },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      max: 100000000000,
      validate: { validator: Number.isSafeInteger, message: 'Amount must be an integer in minor currency units.' },
    },
    paidAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: 'Paid amount must be an integer in minor currency units.' },
    },
    currency: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/ },
    dueAt: Date,
    isVoided: { type: Boolean, default: false, required: true },
    payments: { type: [FeePaymentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AcademicFeeChargeSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
AcademicFeeChargeSchema.index({ companyId: 1, studentId: 1, dueAt: 1 });

export default mongoose.model<IAcademicFeeCharge>('AcademicFeeCharge', AcademicFeeChargeSchema);
