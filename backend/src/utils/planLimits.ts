/**
 * WorkGrind Plan Limit Utilities
 *
 * All limit checks use the COMPANY's subscription, not the individual user's.
 * A company pays once; all members inherit the company's plan.
 */

import mongoose from 'mongoose';
import User from '../models/User';
import Company from '../models/Company';
import AiUsage from '../models/AiUsage';
import { getCompanySubscription, getEffectiveSubscription } from '../services/companySubscription';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LimitCheckResult {
  allowed:  boolean;
  reason?:  string;
  code?:    string;
  limit?:   number;         // -1 = unlimited
  current?: number;
  upgrade?: boolean;
  subscription?: Awaited<ReturnType<typeof getEffectiveSubscription>>;
}

export interface PlanUsage {
  members: number;
  pendingInvites: number;
  memberSlotsUsed: number;
  storageBytes: number;
  aiRequests: number;
  aiRequestsByUser: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(0)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ── Storage ───────────────────────────────────────────────────────────────────

/**
 * Check whether a file upload of `fileSizeBytes` is within the company's
 * storage limit. Uses Company.storage.used for current usage.
 */
export async function reserveStorage(
  userId:        string,
  fileSizeBytes: number,
): Promise<LimitCheckResult> {
  const sub = await getEffectiveSubscription(userId);
  if (!sub.hasActiveAccess) {
    return {
      allowed: false,
      reason: 'An active workspace subscription is required to upload files.',
      code: 'SUBSCRIPTION_REQUIRED',
      limit: 0,
      current: 0,
    };
  }
  const limitBytes = sub.planConfig.limits.storage;
  const user = await User.findById(userId).select('companyId');
  if (!user?.companyId) {
    return {
      allowed: false,
      reason: 'Create or join a workspace before uploading files.',
      code: 'WORKSPACE_REQUIRED',
    };
  }

  const companyId = user.companyId;
  const filter: Record<string, any> = { _id: companyId };
  if (limitBytes !== -1) {
    filter['storage.used'] = { $lte: limitBytes - fileSizeBytes };
  }
  const company = await Company.findOneAndUpdate(
    filter,
    { $inc: { 'storage.used': fileSizeBytes } },
    { new: true },
  ).select('storage');

  if (!company) {
    const currentCompany = await Company.findById(companyId).select('storage');
    const current = currentCompany?.storage?.used ?? 0;
    if (!currentCompany) return { allowed: false, reason: 'Workspace not found.', code: 'WORKSPACE_NOT_FOUND' };
    return {
      allowed: false,
      reason: `Storage limit reached (${formatBytes(limitBytes)} on ${sub.planConfig.name} plan). Upgrade to upload more files.`,
      code: 'STORAGE_LIMIT_EXCEEDED',
      limit: limitBytes,
      current,
      upgrade: true,
    };
  }

  return { allowed: true, limit: limitBytes, current: company.storage.used, upgrade: false };
}

export async function releaseStorage(userId: string, fileSizeBytes: number): Promise<void> {
  const user = await User.findById(userId).select('companyId');
  if (!user?.companyId) return;
  await Company.updateOne(
    { _id: user.companyId },
    [{ $set: { 'storage.used': { $max: [0, { $subtract: ['$storage.used', fileSizeBytes] }] } } }],
  );
}

export async function getPlanUsage(userId: string): Promise<PlanUsage> {
  const user = await User.findById(userId).select('companyId');
  if (!user) throw new Error('User not found');
  const [aiRequests, aiRequestsByUser] = await Promise.all([
    getAiUsageThisMonth(userId),
    getUserAiUsageThisMonth(userId),
  ]);
  if (!user.companyId) {
    return { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests, aiRequestsByUser };
  }

  const companyId = user.companyId;
  const [members, company] = await Promise.all([
    User.countDocuments({ companyId, isActive: true }),
    Company.findById(companyId).select('pendingInvites storage'),
  ]);
  const pendingInvites = (company?.pendingInvites ?? []).filter(
    (invite) => new Date(invite.expiresAt).getTime() > Date.now(),
  ).length;
  return {
    members,
    pendingInvites,
    memberSlotsUsed: members + pendingInvites,
    storageBytes: company?.storage?.used ?? 0,
    aiRequests,
    aiRequestsByUser,
  };
}

// ── AI Requests ───────────────────────────────────────────────────────────────

/**
 * Returns the number of AI requests the user has made this calendar month.
 * Counter resets automatically when the month rolls over.
 */
export async function getAiUsageThisMonth(userId: string): Promise<number> {
  const user = await User.findById(userId).select('companyId aiRequestsThisMonth aiUsageResetDate');
  if (!user) return 0;

  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (user.companyId) {
    await ensureCompanyAiCounter(user.companyId.toString(), monthKey, monthStart);
    const company = await Company.findById(user.companyId).select('aiRequestsThisMonth');
    return company?.aiRequestsThisMonth ?? 0;
  }

  await ensureUserAiCounter(userId, monthStart);
  const currentUser = await User.findById(userId).select('aiRequestsThisMonth');
  return currentUser?.aiRequestsThisMonth ?? 0;
}

async function getUserAiUsageThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await ensureUserAiCounter(userId, monthStart);
  const user = await User.findById(userId).select('aiRequestsThisMonth');
  return user?.aiRequestsThisMonth ?? 0;
}

/**
 * Atomically reserve one AI request against the company-wide monthly limit.
 * Also increments the user's personal usage counter for usage reporting.
 */
export async function reserveAiRequest(userId: string): Promise<LimitCheckResult> {
  const sub = await getEffectiveSubscription(userId);
  if (!sub.hasActiveAccess) {
    return {
      allowed: false,
      reason: 'An active workspace subscription is required to use AI features.',
      code: 'SUBSCRIPTION_REQUIRED',
      limit: 0,
      current: 0,
    };
  }
  const limit = sub.planConfig.limits.aiRequests;
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const companyId = sub.companyId;

  let current: number;
  let reserved = false;
  if (companyId) {
    await ensureCompanyAiCounter(companyId, monthKey, monthStart);
    const filter: Record<string, any> = { _id: companyId, aiUsageResetMonth: monthKey };
    if (limit !== -1) filter.aiRequestsThisMonth = { $lt: limit };
    const company = await Company.findOneAndUpdate(filter, { $inc: { aiRequestsThisMonth: 1 } }, { new: true })
      .select('aiRequestsThisMonth');
    if (company) {
      current = company.aiRequestsThisMonth ?? 0;
      reserved = true;
    } else {
      current = await getAiUsageThisMonth(userId);
    }
  } else {
    await ensureUserAiCounter(userId, monthStart);
    const filter: Record<string, any> = { _id: userId, aiUsageResetDate: monthStart };
    if (limit !== -1) filter.aiRequestsThisMonth = { $lt: limit };
    const updatedUser = await User.findOneAndUpdate(filter, { $inc: { aiRequestsThisMonth: 1 } }, { new: true })
      .select('aiRequestsThisMonth');
    if (updatedUser) {
      current = updatedUser.aiRequestsThisMonth ?? 0;
      reserved = true;
    } else {
      current = await getAiUsageThisMonth(userId);
    }
  }

  if (!reserved) {
    return {
      allowed: false,
      reason: `AI request limit reached (${limit}/month on ${sub.planConfig.name} plan). Upgrade for more AI requests.`,
      code: 'AI_LIMIT_EXCEEDED',
      limit,
      current,
      upgrade: true,
    };
  }

  if (companyId) {
    try {
      await incrementUserAiCounter(userId, monthStart);
    } catch (error) {
      console.error('Failed to update per-user AI usage counter:', error);
    }
  }
  return { allowed: true, limit, current, upgrade: false, subscription: sub };
}

async function ensureCompanyAiCounter(companyId: string, monthKey: string, monthStart: Date): Promise<void> {
  const company = await Company.findById(companyId).select('aiUsageResetMonth');
  if (company?.aiUsageResetMonth === monthKey) return;
  const historicalUsage = await AiUsage.countDocuments({
    companyId: new mongoose.Types.ObjectId(companyId),
    timestamp: { $gte: monthStart },
  });
  await Company.updateOne(
    { _id: companyId, aiUsageResetMonth: { $ne: monthKey } },
    { $set: { aiUsageResetMonth: monthKey, aiRequestsThisMonth: historicalUsage } },
  );
}

async function ensureUserAiCounter(userId: string, monthStart: Date): Promise<void> {
  const user = await User.findById(userId).select('aiUsageResetDate');
  if (user?.aiUsageResetDate?.getTime() === monthStart.getTime()) return;
  const historicalUsage = await AiUsage.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    timestamp: { $gte: monthStart },
  });
  await User.updateOne(
    { _id: userId, aiUsageResetDate: { $ne: monthStart } },
    { $set: { aiUsageResetDate: monthStart, aiRequestsThisMonth: historicalUsage } },
  );
}

async function incrementUserAiCounter(userId: string, monthStart: Date): Promise<void> {
  await User.updateOne(
    { _id: userId, aiUsageResetDate: monthStart },
    { $inc: { aiRequestsThisMonth: 1 } },
  );
}

// ── Members ───────────────────────────────────────────────────────────────────

/**
 * Check whether adding a new member is within the company plan's member limit.
 * Counts active members against the plan, including the owner.
 * Owner's subscription is used to determine the plan (but limit is company-wide).
 */
export async function checkMemberLimit(
  _ownerUserId: string,
  companyId:   string,
  options: { excludePendingInviteToken?: string } = {},
): Promise<LimitCheckResult> {
  const sub = await getCompanySubscription(companyId);

  if (!sub.hasActiveAccess) {
    return {
      allowed: false,
      reason: 'An active workspace subscription is required to add members.',
      code: 'SUBSCRIPTION_REQUIRED',
      limit: 0,
    };
  }
  const limit = sub.planConfig.limits.members;
  if (limit === -1) return { allowed: true, limit: -1 }; // Pro: unlimited

  const [activeMembers, company] = await Promise.all([User.countDocuments({
    companyId: new mongoose.Types.ObjectId(companyId),
    isActive:  true,
  }), Company.findById(companyId).select('pendingInvites')]);
  const now = Date.now();
  const pendingInvites = (company?.pendingInvites ?? []).filter((invite) =>
    invite.token !== options.excludePendingInviteToken &&
    new Date(invite.expiresAt).getTime() > now
  ).length;
  const current = activeMembers + pendingInvites;

  if (current >= limit) {
    return {
      allowed: false,
      reason:  `Member limit reached (${limit} members on ${sub.planConfig.name} plan). Upgrade to a higher plan for more members.`,
      code:    'MEMBER_LIMIT_EXCEEDED',
      limit,
      current,
      upgrade: true,
    };
  }

  return { allowed: true, limit, current: activeMembers, upgrade: false };
}

// ── Re-export getEffectiveSubscription for convenience ────────────────────────
export { getEffectiveSubscription };
