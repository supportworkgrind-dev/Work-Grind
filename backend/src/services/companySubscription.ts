/**
 * companySubscription.ts
 *
 * Centralized service for resolving a company's effective subscription.
 * Every feature check that needs subscription/plan information MUST go
 * through this service — never read User.subscriptionStatus for company
 * feature gating.
 *
 * Model:
 *   - The COMPANY holds the subscription.
 *   - All members of the company inherit that subscription automatically.
 *   - Individual User.subscriptionStatus is only used for personal trial
 *     tracking (the 7-day trial before the user even creates a workspace).
 */

import mongoose from 'mongoose';
import Company, { CompanySubscriptionStatus, CompanyPlan } from '../models/Company';
import User from '../models/User';
import { getPlan, getPolarProductId, hasActiveAccess, PlanId, resolveEffectivePlanId, TRIAL_DAYS } from '../config/subscription';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompanySubscriptionInfo {
  companyId:            string;
  status:               CompanySubscriptionStatus | 'never_subscribed';
  plan:                 PlanId;
  isLifetime:           boolean;
  hasActiveAccess:      boolean;
  /** Effective plan config (limits, features) */
  planConfig:           ReturnType<typeof getPlan>;
  subscriptionStartDate?: Date;
  subscriptionEndDate?:   Date;
  pendingSubscriptionPlan?: CompanyPlan;
  pendingSubscriptionPlanEffectiveDate?: Date;
  trialStartDate?:        Date;
  trialEndDate?:          Date;
  cancelAtPeriodEnd:      boolean;
  polarCustomerId?:       string;
  polarSubscriptionId?:   string;
  coupon?: {
    code:       string;
    type:       'three_months_free' | 'lifetime';
    redeemedAt: Date;
    freeUntil?: Date;
  };
}

// ── Known coupons (server-side only — never expose to frontend) ───────────────

interface CouponDefinition {
  code:     string;
  type:     'three_months_free' | 'lifetime';
  /** How many calendar months of free access (only for three_months_free) */
  months?:  number;
}

const VALID_COUPONS: Record<string, CouponDefinition> = {
  WORKGRIND3: {
    code:   'WORKGRIND3',
    type:   'three_months_free',
    months: 3,
  },
  WORKGRINDLIFE: {
    code: 'WORKGRINDLIFE',
    type: 'lifetime',
  },
};

/**
 * Validate a coupon code server-side.
 * Returns the coupon definition or null if invalid.
 * Never trusts frontend values.
 */
export function getCouponDefinition(code: string): CouponDefinition | null {
  return VALID_COUPONS[code.trim().toUpperCase()] ?? null;
}

// ── Core: get a company's effective subscription ──────────────────────────────

/**
 * Returns the effective subscription info for a company.
 * Auto-expires `trialing` status whose trial window has passed.
 * Handles WORKGRIND3 free period expiry (resumes normal billing state).
 *
 * @param companyId  MongoDB ObjectId string of the company.
 */
export async function getCompanySubscription(
  companyId: string,
): Promise<CompanySubscriptionInfo> {
  const company = await Company.findById(companyId).select(
    'subscriptionStatus subscriptionPlan isLifetime ' +
    'trialStartDate trialEndDate subscriptionStartDate subscriptionEndDate ' +
    'pendingSubscriptionPlan pendingSubscriptionPlanEffectiveDate cancelAtPeriodEnd ' +
    'ownerId polarCustomerId polarSubscriptionId polarProductId polarOrderId coupon createdAt storage plan',
  );

  if (!company) throw new Error(`Company ${companyId} not found`);

  let status: CompanySubscriptionStatus | 'never_subscribed' = !company.subscriptionStatus || company.subscriptionStatus === 'none'
    ? 'never_subscribed'
    : company.subscriptionStatus;
  const now  = new Date();
  let trialFieldsChanged = false;

  if (status === 'never_subscribed') {
    const hasPaidHistory = Boolean(
      company.polarSubscriptionId ||
      company.polarOrderId ||
      company.polarProductId ||
      company.subscriptionStartDate ||
      company.subscriptionPlan === 'starter' ||
      company.subscriptionPlan === 'pro' ||
      company.plan === 'starter' ||
      company.plan === 'pro',
    );
    const hasTrialHistory = Boolean(company.trialStartDate || company.trialEndDate);
    if (hasPaidHistory) {
      status = company.subscriptionEndDate && company.subscriptionEndDate.getTime() > now.getTime()
        ? company.cancelAtPeriodEnd ? 'cancelled' : 'active'
        : 'expired';
      company.subscriptionStatus = status;
      trialFieldsChanged = true;
    } else if (hasTrialHistory) {
      status = company.trialEndDate && company.trialEndDate.getTime() <= now.getTime() ? 'expired' : 'trialing';
      company.subscriptionStatus = status;
      trialFieldsChanged = true;
    } else {
      const owner = company.ownerId
        ? await User.findById(company.ownerId).select('subscriptionStatus trialStartDate trialEndDate createdAt')
        : null;
      const ownerHasTrialHistory = Boolean(
        owner?.trialStartDate ||
        owner?.trialEndDate ||
        owner?.subscriptionStatus === 'trialing' ||
        owner?.subscriptionStatus === 'expired',
      );
      if (owner && ownerHasTrialHistory) {
        company.trialStartDate = owner.trialStartDate ?? owner.createdAt;
        company.trialEndDate = owner.trialEndDate ??
          new Date(company.trialStartDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        status = company.trialEndDate.getTime() <= now.getTime() ? 'expired' : 'trialing';
        company.subscriptionStatus = status;
        trialFieldsChanged = true;
      }
    }
    if (trialFieldsChanged) await company.save();
  }

  // ── Auto-expire company trial ─────────────────────────────────────────────
  if (status === 'trialing') {
    const trialStart = company.trialStartDate ?? company.createdAt;
    const trialEnd = company.trialEndDate ?? new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    if (!company.trialStartDate) {
      company.trialStartDate = trialStart;
      trialFieldsChanged = true;
    }
    if (!company.trialEndDate) {
      company.trialEndDate = trialEnd;
      trialFieldsChanged = true;
    }
    if (now.getTime() >= trialEnd.getTime()) {
      status = 'expired';
      company.subscriptionStatus = 'expired';
    }
    if (status === 'expired') trialFieldsChanged = true;
    if (trialFieldsChanged) await company.save();
  }

  if (
    (status === 'active' || status === 'cancelled') &&
    company.subscriptionEndDate &&
    now.getTime() >= company.subscriptionEndDate.getTime()
  ) {
    status = 'expired';
    company.subscriptionStatus = 'expired';
    await company.save();
  }

  if (
    company.pendingSubscriptionPlan &&
    company.pendingSubscriptionPlanEffectiveDate &&
    now >= company.pendingSubscriptionPlanEffectiveDate
  ) {
    if (status === 'expired') {
      company.pendingSubscriptionPlan = undefined;
      company.pendingSubscriptionPlanEffectiveDate = undefined;
      await company.save();
    } else if (
      (company.pendingSubscriptionPlan === 'starter' || company.pendingSubscriptionPlan === 'pro') &&
      status === 'active'
    ) {
      company.subscriptionPlan = company.pendingSubscriptionPlan;
      company.plan = company.pendingSubscriptionPlan;
      company.pendingSubscriptionPlan = undefined;
      company.pendingSubscriptionPlanEffectiveDate = undefined;
      await company.save();
    }
  }

  // ── WORKGRIND3: check if free period has ended, revert to paid status ──────
  if (
    company.coupon?.type === 'three_months_free' &&
    company.coupon.freeUntil &&
    now > company.coupon.freeUntil &&
    status === 'active'
  ) {
    // Free period over — subscription remains active (Polar billing resumes)
    // Nothing to change; normal billing should have kicked in via Polar webhook.
    // We just ensure status stays 'active'.
  }

  // ── Lifetime access never expires ─────────────────────────────────────────
  if (company.isLifetime) {
    status = 'lifetime';
    if (company.subscriptionStatus !== 'lifetime') {
      company.subscriptionStatus = 'lifetime';
      await company.save();
    }
  }

  const polarPlan = company.polarProductId
    ? (['starter', 'pro'] as const).find((candidate) => getPolarProductId(candidate) === company.polarProductId)
    : undefined;
  const historicalPlan = company.subscriptionPlan === 'starter' || company.subscriptionPlan === 'pro'
    ? company.subscriptionPlan
    : polarPlan ??
      (company.plan === 'starter' || company.plan === 'pro' ? company.plan : company.subscriptionPlan);
  const effectivePlanId = resolveEffectivePlanId(
    status,
    historicalPlan,
    company.isLifetime,
    company.subscriptionEndDate,
  );

  const activeAccess = hasActiveAccess(
    status,
    company.subscriptionEndDate,
    company.trialEndDate ?? (company.trialStartDate
      ? new Date(company.trialStartDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      : undefined),
  );
  const resolvedPlanConfig = getPlan(effectivePlanId);
  const planConfig = activeAccess
    ? resolvedPlanConfig
    : {
        ...resolvedPlanConfig,
        entitlements: Object.fromEntries(
          Object.keys(resolvedPlanConfig.entitlements).map((key) => [key, false]),
        ) as typeof resolvedPlanConfig.entitlements,
        limits: { members: 0, storage: 0, aiRequests: 0 },
      };
  if (activeAccess && (company.storage.limit !== resolvedPlanConfig.limits.storage || company.plan !== effectivePlanId)) {
    company.storage.limit = resolvedPlanConfig.limits.storage;
    company.plan = effectivePlanId;
    await company.save();
  }

  return {
    companyId:            company._id.toString(),
    status,
    plan:                 effectivePlanId,
    isLifetime:           company.isLifetime,
    hasActiveAccess:      activeAccess,
    planConfig,
    subscriptionStartDate: company.subscriptionStartDate,
    subscriptionEndDate:   company.subscriptionEndDate,
    pendingSubscriptionPlan: company.pendingSubscriptionPlan,
    pendingSubscriptionPlanEffectiveDate: company.pendingSubscriptionPlanEffectiveDate,
    trialStartDate:        company.trialStartDate,
    trialEndDate:          company.trialEndDate,
    cancelAtPeriodEnd:     company.cancelAtPeriodEnd,
    polarCustomerId:       company.polarCustomerId,
    polarSubscriptionId:   company.polarSubscriptionId,
    coupon: company.coupon
      ? {
          code:       company.coupon.code,
          type:       company.coupon.type,
          redeemedAt: company.coupon.redeemedAt,
          freeUntil:  company.coupon.freeUntil,
        }
      : undefined,
  };
}

/**
 * Resolve subscription for a user by looking up their company.
 * Used by middleware and limit checks.
 *
 * Falls back to the user's own trial status if they haven't joined a
 * company yet (the personal 7-day trial on registration).
 */
export async function getEffectiveSubscription(userId: string): Promise<{
  source:  'company' | 'user_trial';
  status:  CompanySubscriptionStatus | 'trialing' | 'none' | 'never_subscribed';
  plan:    CompanyPlan;
  planConfig: ReturnType<typeof getPlan>;
  hasActiveAccess: boolean;
  companyId?: string;
  isLifetime: boolean;
  subscriptionEndDate?: Date;
  trialEndDate?: Date;
}> {
  const user = await User.findById(userId).select(
    'companyId subscriptionStatus subscriptionPlan trialStartDate trialEndDate subscriptionEndDate createdAt',
  );
  if (!user) throw new Error('User not found');

  // If the user belongs to a company, always use the company's subscription
  if (user.companyId) {
    const sub = await getCompanySubscription(user.companyId.toString());
    return {
      source:          'company',
      status:          sub.status,
      plan:            sub.plan,
      planConfig:      sub.planConfig,
      hasActiveAccess: sub.hasActiveAccess,
      companyId:       sub.companyId,
      isLifetime:      sub.isLifetime,
      subscriptionEndDate: sub.subscriptionEndDate,
      trialEndDate: sub.trialEndDate,
    };
  }

  // No company yet — fall back to user's personal trial
  let userStatus = !user.subscriptionStatus || user.subscriptionStatus === 'none'
    ? 'never_subscribed'
    : user.subscriptionStatus as string;
  let trialEnd: Date | undefined;
  if (
    userStatus === 'never_subscribed' &&
    (user.trialStartDate || user.trialEndDate)
  ) {
    userStatus = 'trialing';
  }
  if (userStatus === 'trialing') {
    const trialStart = user.trialStartDate ?? user.createdAt;
    trialEnd = user.trialEndDate ?? new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    let trialFieldsChanged = false;
    if (!user.trialStartDate) {
      user.trialStartDate = trialStart;
      trialFieldsChanged = true;
    }
    if (!user.trialEndDate) {
      user.trialEndDate = trialEnd;
      trialFieldsChanged = true;
    }
    if (user.subscriptionStatus === 'none') {
      user.subscriptionStatus = 'trialing';
      trialFieldsChanged = true;
    }
    if (new Date().getTime() >= trialEnd.getTime()) {
      userStatus = 'expired';
      user.subscriptionStatus = 'expired' as any;
      trialFieldsChanged = true;
    }
    if (trialFieldsChanged) await user.save();
  }

  const active = hasActiveAccess(userStatus, user.subscriptionEndDate, trialEnd);
  const planId = resolveEffectivePlanId(userStatus, user.subscriptionPlan);
  const resolvedPlanConfig = getPlan(planId);
  const planConfig = active
    ? resolvedPlanConfig
    : {
        ...resolvedPlanConfig,
        entitlements: Object.fromEntries(
          Object.keys(resolvedPlanConfig.entitlements).map((key) => [key, false]),
        ) as typeof resolvedPlanConfig.entitlements,
        limits: { members: 0, storage: 0, aiRequests: 0 },
      };
  return {
    source:          'user_trial',
    status:          userStatus as any,
    plan:            planId,
    planConfig,
    hasActiveAccess: active,
    companyId:       undefined,
    isLifetime:      false,
    subscriptionEndDate: user.subscriptionEndDate,
    trialEndDate: trialEnd,
  };
}
