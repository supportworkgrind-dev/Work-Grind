import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  callingId?: string;
  incomingCallPrivacy?: 'everyone' | 'contacts' | 'nobody';
  contacts?: mongoose.Types.ObjectId[];
  blockedUsers?: mongoose.Types.ObjectId[];
  fullName: string; email: string; password?: string; googleId?: string; appleId?: string;
  avatar?: string; avatarStorageKey?: string; jobTitle?: string; department?: string; phone?: string;
  phoneVerified: boolean;
  phoneVerificationCodeHash?: string;
  phoneVerificationExpiresAt?: Date;
  phoneVerificationAttempts?: number;
  phoneVerificationResends?: number;
  phoneVerificationSentAt?: Date;
  phoneVerificationPurpose?: 'signup' | 'login' | 'recovery' | 'change';
  country?: string; timeZone: string; bio?: string; skills: string[];
  notificationPreferences?: {
    taskAssigned: boolean;
    meetingReminder: boolean;
    newMessage: boolean;
    dealUpdate: boolean;
  };
  preferredLanguage?: 'en' | 'ur' | 'ar' | 'fr' | 'de' | 'es' | 'zh' | 'hi';
  theme?: 'original' | 'midnight' | 'slate' | 'forest' | 'ocean' | 'sand' | 'plum' | 'high-contrast' | 'light' | 'aurora' | 'graphite' | 'dark' | 'neutral' | 'developer' | 'creative' | 'marketing' | 'sales' | 'project_manager' | 'freelancer' | 'executive' | 'student' | 'professional';
  workspaceProfile?: 'developer' | 'creative' | 'marketing' | 'sales' | 'project_manager' | 'freelancer' | 'executive' | 'student' | 'professional';
  isDeleted?: boolean;
  deletedAt?: Date;
  status: 'online'|'away'|'busy'|'offline'; isVerified: boolean;
  verificationToken?: string; verificationTokenExpiry?: Date;
  verificationCodeHash?: string; verificationCodeExpiry?: Date;
  verificationCodeAttempts?: number; verificationCodeResends?: number; verificationCodeSentAt?: Date;
  resetPasswordToken?: string; resetPasswordExpiry?: Date;
  refreshTokens: string[]; companyId?: mongoose.Types.ObjectId;
  role: string; isActive: boolean; lastSeen?: Date;
  lastLogin?: Date;
  accountType?: 'company' | 'individual';
  isSuperAdmin?: boolean;
  mfaEnabled?: boolean;
  mfaSecretEncrypted?: string;
  mfaTempSecretEncrypted?: string;
  mfaVerifiedAt?: Date;
  recoveryCodesHashed?: string[];
  mfaFailedAttempts?: number;
  mfaLockoutUntil?: Date;
  // ── Subscription fields ───────────────────────────────────────────
  subscriptionStatus: 'trialing'|'active'|'expired'|'cancelled'|'past_due'|'unpaid'|'paused'|'incomplete'|'none';
  subscriptionPlan: 'free'|'starter'|'pro';
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  polarCustomerId?: string;
  polarSubscriptionId?: string;
  polarOrderId?: string;
  cancelAtPeriodEnd?: boolean;
  aiRequestsThisMonth?: number;
  aiUsageResetDate?: Date;
  createdAt: Date; updatedAt: Date;
  comparePassword(p: string): Promise<boolean>;
}

const S = new Schema<IUser>({
  fullName: { type: String, required: true, trim: true },
  callingId: { type: String, trim: true, uppercase: true, match: /^WG-\d{5,8}$/ },
  incomingCallPrivacy: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
  contacts: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, select: false },
  googleId: String,
  appleId: String,
  avatar: String, avatarStorageKey: String, jobTitle: String, department: String,
  phone: { type: String, trim: true },
  // Retained for compatibility with existing account records.
  phoneVerified: { type: Boolean, default: true },
  phoneVerificationCodeHash: { type: String, select: false },
  phoneVerificationExpiresAt: Date,
  phoneVerificationAttempts: { type: Number, default: 0, select: false },
  phoneVerificationResends: { type: Number, default: 0, select: false },
  phoneVerificationSentAt: Date,
  phoneVerificationPurpose: { type: String, enum: ['signup', 'login', 'recovery', 'change'], select: false },
  country: String,
  timeZone: { type: String, default: 'UTC' }, bio: { type: String, maxlength: 500 },
  skills: [String],
  notificationPreferences: {
    type: {
      taskAssigned: { type: Boolean, default: true },
      meetingReminder: { type: Boolean, default: true },
      newMessage: { type: Boolean, default: true },
      dealUpdate: { type: Boolean, default: true },
    },
    default: {
      taskAssigned: true,
      meetingReminder: true,
      newMessage: true,
      dealUpdate: true,
    },
  },
  preferredLanguage: { type: String, enum: ['en', 'ur', 'ar', 'fr', 'de', 'es', 'zh', 'hi'], default: 'en' },
  theme: { type: String, enum: ['original', 'midnight', 'slate', 'forest', 'ocean', 'sand', 'plum', 'high-contrast', 'light', 'aurora', 'graphite', 'dark', 'neutral', 'developer', 'creative', 'marketing', 'sales', 'project_manager', 'freelancer', 'executive', 'student', 'professional'], default: 'original' },
  workspaceProfile: { type: String, enum: ['developer', 'creative', 'marketing', 'sales', 'project_manager', 'freelancer', 'executive', 'student', 'professional'] },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  status: { type: String, enum: ['online','away','busy','offline'], default: 'offline' },
  isVerified: { type: Boolean, default: false },
  verificationToken: String, verificationTokenExpiry: Date,
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpiry: Date,
  verificationCodeAttempts: { type: Number, default: 0, select: false },
  verificationCodeResends: { type: Number, default: 0, select: false },
  verificationCodeSentAt: Date,
  resetPasswordToken: String, resetPasswordExpiry: Date,
  refreshTokens: [String],
  companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  role: { type: String, default: 'employee' },
  accountType: { type: String, enum: ['company', 'individual'], default: 'company' },
  isSuperAdmin: { type: Boolean, default: false },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecretEncrypted: { type: String, select: false },
  mfaTempSecretEncrypted: { type: String, select: false },
  mfaVerifiedAt: Date,
  recoveryCodesHashed: { type: [String], select: false },
  mfaFailedAttempts: { type: Number, default: 0, select: false },
  mfaLockoutUntil: { type: Date, select: false },
  isActive: { type: Boolean, default: true }, lastSeen: Date, lastLogin: Date,
  // ── Subscription ──────────────────────────────────────────────────────
  subscriptionStatus: {
    type: String,
    enum: ['trialing','active','expired','cancelled','past_due','unpaid','paused','incomplete','none'],
    default: 'none',
    index: true,
  },
  subscriptionPlan: {
    type: String,
    enum: ['free','starter','pro'],
    default: 'free',
  },
  trialStartDate:        { type: Date },
  trialEndDate:          { type: Date },
  subscriptionStartDate: { type: Date },
  subscriptionEndDate:   { type: Date },
  polarCustomerId:       { type: String, sparse: true },
  polarSubscriptionId:   { type: String, sparse: true },
  polarOrderId:          { type: String },
  cancelAtPeriodEnd:     { type: Boolean, default: false },
  // ── AI usage tracking ────────────────────────────────────────────────────
  aiRequestsThisMonth: { type: Number, default: 0 },
  aiUsageResetDate:    { type: Date },
}, { timestamps: true });

S.pre('validate', async function() {
  if (this.callingId) return;
  const UserModel = this.constructor as mongoose.Model<IUser>;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const digits = 5 + Math.floor(attempt / 16);
    const candidate = `WG-${randomInt(10 ** (digits - 1), 10 ** digits)}`;
    if (!await UserModel.exists({ callingId: candidate })) {
      this.callingId = candidate;
      return;
    }
  }
  throw new Error('Unable to allocate a unique WorkGrind Calling ID.');
});

S.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10); next();
});
S.methods.comparePassword = function(p: string) { return bcrypt.compare(p, this.password || ''); };
S.index({ companyId: 1, email: 1 }); S.index({ companyId: 1, status: 1 });
S.index({ companyId: 1, isActive: 1 });
S.index({ companyId: 1, role: 1 });
S.index({ companyId: 1, department: 1 });
S.index({ isSuperAdmin: 1 });
S.index({ callingId: 1 }, { unique: true, sparse: true, name: 'callingId_unique' });
S.index({ phone: 1 }, {
  unique: true,
  partialFilterExpression: { phone: { $type: 'string', $gt: '' } },
  name: 'phone_unique',
});
S.index({ googleId: 1 }, {
  unique: true,
  partialFilterExpression: { googleId: { $type: 'string', $gt: '' } },
  name: 'googleId_unique',
});
S.index({ appleId: 1 }, {
  unique: true,
  partialFilterExpression: { appleId: { $type: 'string', $gt: '' } },
  name: 'appleId_unique',
});

export default mongoose.model<IUser>('User', S);
