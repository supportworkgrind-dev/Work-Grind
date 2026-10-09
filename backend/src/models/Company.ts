import mongoose, { Document, Schema } from 'mongoose';
import { ORGANIZATION_TYPES, OrganizationType } from '../config/organization';

export type CompanySubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'lifetime'
  | 'none';

export type CompanyPlan = 'free' | 'starter' | 'pro';

export interface ICouponRedemption {
  code:         string;
  type:         'three_months_free' | 'lifetime';
  redeemedAt:   Date;
  redeemedBy:   mongoose.Types.ObjectId;   // userId of owner who redeemed
  /** For WORKGRIND3: ISO date when the free period ends and normal billing resumes */
  freeUntil?:   Date;
}

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  logo?: string;
  industry?: string;
  size?: string;
  country?: string;
  timeZone: string;
  currency: string;
  academicSettings: {
    academicYearStartMonth: number;
    gradingScale: 'percentage' | 'letter' | 'points' | 'pass_fail';
  };
  ownerId: mongoose.Types.ObjectId;
  inviteCode: string;
  pendingInvites: { email: string; token: string; expiresAt: Date; role: string }[];

  /** Legacy workspace-level plan field (kept for backward compat). */
  plan: CompanyPlan;

  storage: { used: number; limit: number };
  aiRequestsThisMonth?: number;
  aiUsageResetMonth?: string;
  settings: { allowGuestAccess: boolean; defaultRole: string };
  isActive: boolean;
  accountType: 'company' | 'individual';
  organizationType: OrganizationType;

  // ── Company subscription (Polar-based) ────────────────────────────────────
  subscriptionStatus:     CompanySubscriptionStatus;
  subscriptionPlan:       CompanyPlan;
  subscriptionStartDate?: Date;
  subscriptionEndDate?:   Date;
  pendingSubscriptionPlan?: CompanyPlan;
  pendingSubscriptionPlanEffectiveDate?: Date;
  trialStartDate?:        Date;
  trialEndDate?:          Date;
  cancelAtPeriodEnd:      boolean;

  // Polar identifiers
  polarCustomerId?:        string;
  polarSubscriptionId?:    string;
  polarProductId?:         string;
  polarOrderId?:           string;

  // ── Coupon system ─────────────────────────────────────────────────────────
  /**
   * Coupon redemption record. Only ONE coupon may be applied per company.
   * Checked server-side — never trust frontend.
   */
  coupon?: ICouponRedemption;

  /** Convenience flag: set to true when WORKGRINDLIFE is successfully redeemed. */
  isLifetime: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICouponRedemption>(
  {
    code:        { type: String, required: true, uppercase: true, trim: true },
    type:        { type: String, enum: ['three_months_free', 'lifetime'], required: true },
    redeemedAt:  { type: Date, default: Date.now },
    redeemedBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    freeUntil:   { type: Date },
  },
  { _id: false }
);

const CompanySchema = new Schema<ICompany>(
  {
    name:     { type: String, required: true, trim: true },
    logo:     String,
    industry: String,
    size:     { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '500+'] },
    country:  String,
    timeZone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD', uppercase: true, match: /^[A-Z]{3}$/ },
    academicSettings: {
      academicYearStartMonth: { type: Number, default: 8, min: 1, max: 12 },
      gradingScale: { type: String, enum: ['percentage', 'letter', 'points', 'pass_fail'], default: 'percentage' },
    },
    ownerId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteCode: { type: String, unique: true },
    pendingInvites: [
      {
        email:     String,
        token:     String,
        expiresAt: Date,
        role:      { type: String, default: 'employee' },
      },
    ],

    // Legacy plan field (still used for display in some places)
    plan: { type: String, enum: ['free', 'starter', 'pro'], default: 'free' },

    storage: {
      used:  { type: Number, default: 0 },
      limit: { type: Number, default: 1073741824 },
    },
    aiRequestsThisMonth: { type: Number, default: 0 },
    aiUsageResetMonth: { type: String },
    settings: {
      allowGuestAccess: { type: Boolean, default: false },
      defaultRole:      { type: String, default: 'employee' },
    },
    accountType: { type: String, enum: ['company', 'individual'], default: 'company' },
    organizationType: { type: String, enum: ORGANIZATION_TYPES, default: 'business', required: true },
    isActive:    { type: Boolean, default: true },

    // ── Subscription ──────────────────────────────────────────────────────────
    subscriptionStatus: {
      type:    String,
      enum:    ['trialing', 'active', 'expired', 'cancelled', 'past_due', 'unpaid', 'paused', 'incomplete', 'lifetime', 'none'],
      default: 'none',
      index:   true,
    },
    subscriptionPlan: {
      type:    String,
      enum:    ['free', 'starter', 'pro'],
      default: 'free',
    },
    subscriptionStartDate: { type: Date },
    subscriptionEndDate:   { type: Date },
    pendingSubscriptionPlan: { type: String, enum: ['free', 'starter', 'pro'] },
    pendingSubscriptionPlanEffectiveDate: { type: Date },
    trialStartDate:        { type: Date },
    trialEndDate:          { type: Date },
    cancelAtPeriodEnd:     { type: Boolean, default: false },

    polarCustomerId:     { type: String, sparse: true },
    polarSubscriptionId: { type: String, sparse: true },
    polarProductId:      { type: String },
    polarOrderId:        { type: String },

    // ── Coupon ────────────────────────────────────────────────────────────────
    coupon:     { type: CouponSchema },
    isLifetime: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CompanySchema.index({ ownerId: 1 });
CompanySchema.index({ 'pendingInvites.token': 1 });

export default mongoose.model<ICompany>('Company', CompanySchema);
