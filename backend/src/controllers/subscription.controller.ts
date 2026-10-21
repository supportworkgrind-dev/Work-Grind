/**
 * WorkGrind Subscription Controller (Company-based)
 *
 * The COMPANY purchases a subscription. All its members share it.
 * Individual members do NOT purchase separate subscriptions.
 *
 * Security:
 *   - Only company owners/admins may checkout, cancel, or reactivate.
 *   - Subscription status is NEVER updated from frontend claims.
 *   - Coupons are validated entirely server-side.
 *   - Webhook signatures are verified before any state change.
 *   - Idempotency: duplicate webhooks are safely ignored.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { Polar } from '@polar-sh/sdk';
import User from '../models/User';
import Company, { type CompanySubscriptionStatus, type ICompany } from '../models/Company';
import AuditLog from '../models/AuditLog';
import ProcessedPolarWebhook from '../models/ProcessedPolarWebhook';
import { AuthRequest } from '../middleware/auth';
import {
  PLANS,
  TRIAL_DAYS,
  PlanId,
  EducationPlanId,
  getPlan,
  getPolarProductId,
  getEducationPolarProductId,
  getEducationPlanConfig,
  getEducationPolarProductIdEnv,
  educationPlanForOrganization,
  getConfiguredPlanIdForPolarProduct,
  validatePolarProductId,
  hasActiveAccess,
  getEducationPlanPricing,
  getPurchasablePlanIds,
} from '../config/subscription';
import { normalizeOrganizationType } from '../config/organization';
import {
  getCompanySubscription,
  getCouponDefinition,
  hasVerifiedEducationSubscription,
} from '../services/companySubscription';
import { getPlanUsage, getEffectiveSubscription } from '../utils/planLimits';
import { disconnectCompanySockets } from '../utils/socket';

// ── Polar client (fresh each call — avoids SDK env-memo caching bug) ──────────
function getPolar(): Polar {
  const token = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('POLAR_ACCESS_TOKEN environment variable is not set');

  const rawEnv = (process.env.POLAR_ENVIRONMENT ?? '').trim().toLowerCase();
  const server = rawEnv === 'production' ? 'production' : 'sandbox';
  return new Polar({ accessToken: token, server });
}

const educationProductValidationCache = new Map<
  EducationPlanId,
  { checkedAt: number; checkoutAvailable: boolean; checkoutError?: string }
>();

async function getEducationCheckoutConfiguration(
  planId: EducationPlanId,
): Promise<{ checkoutAvailable: boolean; checkoutError?: string }> {
  const productId = getEducationPolarProductId(planId);
  if (!productId) {
    return {
      checkoutAvailable: false,
      checkoutError: `Polar product ID is not configured. Set ${getEducationPolarProductIdEnv(planId)} after creating the matching monthly USD product in Polar.`,
    };
  }
  const cached = educationProductValidationCache.get(planId);
  if (cached && Date.now() - cached.checkedAt < 60_000) {
    return { checkoutAvailable: cached.checkoutAvailable, checkoutError: cached.checkoutError };
  }
  if (!process.env.POLAR_ACCESS_TOKEN?.trim()) {
    return {
      checkoutAvailable: false,
      checkoutError: 'Polar access is not configured; checkout cannot verify the education product price.',
    };
  }

  let result: { checkoutAvailable: boolean; checkoutError?: string };
  try {
    const product = await getPolar().products.get({ id: productId });
    result = matchesPolarProductPrice(product, planId)
      ? { checkoutAvailable: true }
      : {
        checkoutAvailable: false,
        checkoutError: `The configured Polar product must be active and priced at $${getEducationPlanConfig(planId).priceMonthly / 100} USD per month.`,
      };
  } catch (error) {
    console.error(`[Subscription] Polar product verification failed for ${planId}:`, error instanceof Error ? error.name : 'UnknownError');
    result = {
      checkoutAvailable: false,
      checkoutError: 'Polar could not verify this education product. Check the product ID and API configuration.',
    };
  }
  educationProductValidationCache.set(planId, { ...result, checkedAt: Date.now() });
  return result;
}

// ── Guard: must be owner or admin ─────────────────────────────────────────────
function isBillingAdmin(role: string): boolean {
  return role === 'owner' || role === 'founder' || role === 'admin';
}

function isEducationPlan(planId: PlanId): planId is 'school' | 'college' | 'university' {
  return planId === 'school' || planId === 'college' || planId === 'university';
}

export function isCheckoutPlanAllowedForOrganization(organizationType: string | null | undefined, planId: PlanId): boolean {
  const purchasable = getPurchasablePlanIds(organizationType);
  // The free trial is never checked out, but remains a valid business plan selection.
  if (planId === 'free') return purchasable.includes('starter');
  return purchasable.includes(planId);
}

export function matchesPolarProductPrice(
  product: Awaited<ReturnType<Polar['products']['get']>>,
  planId: 'school' | 'college' | 'university',
): boolean {
  const expected = getEducationPlanConfig(planId);
  return !product.isArchived &&
    product.isRecurring &&
    product.recurringInterval === 'month' &&
    product.recurringIntervalCount === 1 &&
    product.prices.some((price) =>
      price.amountType === 'fixed' &&
      !price.isArchived &&
      price.priceCurrency.toUpperCase() === 'USD' &&
      price.priceAmount === expected.priceMonthly
    );
}

export function resolveWebhookPlan(
  company: ICompany,
  productId: string | undefined,
  metadataPlanId: string | undefined,
): PlanId | undefined {
  if (!normalizeOrganizationType(company.organizationType)) return undefined;
  const mappedPlan = productId ? getConfiguredPlanIdForPolarProduct(productId) : undefined;
  const educationPlanId = educationPlanForOrganization(company.organizationType);

  if (educationPlanId) return mappedPlan === educationPlanId ? mappedPlan : undefined;
  if (mappedPlan && isEducationPlan(mappedPlan)) return undefined;
  if (mappedPlan) return mappedPlan;

  // Keep already-issued business checkout sessions working while never
  // allowing education subscriptions to be activated from metadata alone.
  return metadataPlanId === 'starter' || metadataPlanId === 'pro'
    ? metadataPlanId
    : undefined;
}

export async function claimPolarWebhookDelivery(webhookId: string): Promise<boolean> {
  try {
    await ProcessedPolarWebhook.create({
      _id: webhookId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return false;
    }
    throw error;
  }
}

export async function releasePolarWebhookDelivery(webhookId: string): Promise<void> {
  await ProcessedPolarWebhook.deleteOne({ _id: webhookId });
}

export function isCurrentPolarSubscription(
  company: Pick<ICompany, 'polarSubscriptionId' | 'polarProductId'>,
  subscription: { id: string; productId?: string },
): boolean {
  return company.polarSubscriptionId === subscription.id &&
    (!company.polarProductId || company.polarProductId === subscription.productId);
}

function normalizePolarSubscriptionStatus(status: string): CompanySubscriptionStatus | undefined {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'unpaid':
    case 'paused':
    case 'incomplete':
      return status;
    case 'canceled':
      return 'cancelled';
    case 'incomplete_expired':
    case 'revoked':
      return 'expired';
    default:
      return undefined;
  }
}

function disconnectIfSubscriptionInactive(company: ICompany): void {
  if (!hasActiveAccess(company.subscriptionStatus, company.subscriptionEndDate, company.trialEndDate)) {
    disconnectCompanySockets(company._id.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/subscription/status
// Returns the company's current subscription status for the authenticated user
// ═══════════════════════════════════════════════════════════════════════════════
export const getSubscriptionStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('companyId subscriptionStatus subscriptionPlan trialEndDate trialStartDate');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const usage = await getPlanUsage(req.user!.userId);

    // If the user belongs to a company → return company subscription
    if (user.companyId) {
      const sub = await getCompanySubscription(user.companyId.toString());
      const plan = sub.planConfig;

      let trialDaysRemaining: number | null = null;
      if (sub.status === 'trialing' && sub.trialEndDate) {
        const msLeft = sub.trialEndDate.getTime() - Date.now();
        trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      }

      res.json({
        success: true,
        source:  'company',
        subscription: {
          status:               sub.status,
          plan:                 sub.plan,
          organizationType:     sub.organizationType,
          availablePlanIds:     getPurchasablePlanIds(sub.organizationType),
          accountType:          sub.accountType,
          subscriptionMismatch: sub.subscriptionMismatch,
          billingInterval:      sub.plan === 'school' || sub.plan === 'college' || sub.plan === 'university' ? 'month' : undefined,
          currency:             sub.plan === 'school' || sub.plan === 'college' || sub.plan === 'university' ? 'USD' : undefined,
          planName:             sub.status === 'trialing' && educationPlanForOrganization(sub.organizationType)
            ? `${plan.name} trial`
            : sub.status === 'expired'
            ? sub.plan === 'free' ? 'Free Trial' : plan.name
            : sub.status === 'never_subscribed'
              ? 'No subscription'
              : plan.name,
          priceDisplay:         educationPlanForOrganization(sub.organizationType)
            ? sub.status === 'trialing'
              ? 'Free trial'
              : sub.hasActiveAccess
                ? plan.priceDisplay
                : 'No paid subscription'
            : plan.priceDisplay,
          trialStartDate:       sub.trialStartDate,
          trialEndDate:         sub.trialEndDate,
          trialDaysRemaining,
          subscriptionStartDate: sub.subscriptionStartDate,
          subscriptionEndDate:   sub.subscriptionEndDate,
          pendingSubscriptionPlan: sub.pendingSubscriptionPlan,
          pendingSubscriptionPlanEffectiveDate: sub.pendingSubscriptionPlanEffectiveDate,
          cancelAtPeriodEnd:     sub.cancelAtPeriodEnd,
          isLifetime:            sub.isLifetime,
          hasActiveAccess:       sub.hasActiveAccess,
          entitlements:          plan.entitlements,
          limits:                plan.limits,
          usage,
          coupon:                sub.coupon,
        },
      });
      return;
    }

    // No company yet — fall back to user's personal trial
    const effective = await getEffectiveSubscription(req.user!.userId);
    const plan = effective.planConfig;
    let trialDaysRemaining: number | null = null;
    if (effective.status === 'trialing' && effective.trialEndDate) {
      const msLeft = effective.trialEndDate.getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      source:  'user_trial',
      subscription: {
        status:            effective.status,
        plan:              effective.plan,
        planName:          effective.status === 'expired'
          ? effective.plan === 'free' ? 'Free Trial' : plan.name
          : effective.status === 'never_subscribed'
            ? 'No subscription'
            : plan.name,
        priceDisplay:      plan.priceDisplay,
        trialStartDate:    user.trialStartDate ?? user.createdAt,
        trialEndDate:      effective.trialEndDate,
        subscriptionEndDate: effective.subscriptionEndDate,
        trialDaysRemaining,
        hasActiveAccess:   effective.hasActiveAccess,
        entitlements:      plan.entitlements,
        limits:            plan.limits,
        usage,
        isLifetime:        false,
        cancelAtPeriodEnd: false,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/subscription/checkout
// Creates a Polar checkout — company owner/admin only
// ═══════════════════════════════════════════════════════════════════════════════
export const createCheckout = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { planId } = req.body as { planId: PlanId };

    if (!planId || !['free', 'starter', 'pro', 'school', 'college', 'university'].includes(planId)) {
      res.status(400).json({ success: false, message: 'Invalid plan selected' });
      return;
    }
    if (planId === 'free') {
      res.status(400).json({ success: false, message: 'Free trial does not require checkout' });
      return;
    }

    // Only owner/admin can purchase
    if (!isBillingAdmin(req.user!.role)) {
      res.status(403).json({
        success: false,
        message: 'Only the company owner or an admin can manage billing.',
      });
      return;
    }

    const companyId = req.user!.companyId;
    if (!companyId) {
      res.status(400).json({ success: false, message: 'You must create a workspace before subscribing.' });
      return;
    }

    // Validate the plan against the workspace's stored organization type before
    // touching Polar, so a mismatched plan is always refused for that reason.
    const company = await Company.findById(companyId).select(
      'name subscriptionStatus subscriptionPlan isLifetime polarCustomerId polarSubscriptionId polarProductId organizationType',
    );
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    const organizationType = normalizeOrganizationType(company.organizationType);
    if (!organizationType) {
      console.error(`[Subscription] Unrecognized organization type on company ${companyId}`);
      res.status(409).json({
        success: false,
        message: 'This workspace’s organization type is not recognized, so no plan can be matched. Please contact support.',
      });
      return;
    }
    const educationPlanId = educationPlanForOrganization(organizationType);
    if (!isCheckoutPlanAllowedForOrganization(organizationType, planId)) {
      res.status(403).json({
        success: false,
        message: educationPlanId
          ? `This ${organizationType} workspace can only subscribe to the ${educationPlanId} plan.`
          : 'Education plans are only available to school, college, and university workspaces.',
      });
      return;
    }

    const configError = isEducationPlan(planId) ? (
      getEducationPolarProductId(planId)
        ? null
        : `Polar product ID is not configured. Set ${getEducationPolarProductIdEnv(planId)} after creating the matching monthly USD product in Polar.`
    ) : validatePolarProductId(planId);
    if (configError) {
      console.error(`[Subscription] Configuration error: ${configError}`);
      res.status(500).json({ success: false, message: configError });
      return;
    }

    const polarProductId = isEducationPlan(planId)
      ? getEducationPolarProductId(planId)
      : getPolarProductId(planId);
    if (!polarProductId) {
      res.status(500).json({
        success: false,
        message: isEducationPlan(planId)
          ? `Polar product ID is not configured for the ${planId} plan.`
          : `Polar product ID not configured for plan "${planId}". Set POLAR_${planId.toUpperCase()}_PRODUCT_ID in your .env.`,
      });
      return;
    }

    const polar = getPolar();
    if (isEducationPlan(planId)) {
      let product: Awaited<ReturnType<Polar['products']['get']>>;
      try {
        product = await polar.products.get({ id: polarProductId });
      } catch (error) {
        console.error(`[Subscription] Could not verify Polar product for ${planId}:`, error);
        res.status(502).json({ success: false, message: `Could not verify the configured Polar product for the ${planId} plan. Check the product ID and Polar API credentials.` });
        return;
      }
      if (!matchesPolarProductPrice(product, planId)) {
        res.status(500).json({
          success: false,
          message: `The configured Polar product for ${planId} must be active and priced at $${getEducationPlanConfig(planId).priceMonthly / 100} USD per month.`,
        });
        return;
      }
    }

    if (
      educationPlanId &&
      company.polarSubscriptionId &&
      ['active', 'past_due', 'cancelled'].includes(company.subscriptionStatus) &&
      company.polarProductId !== getEducationPolarProductId(educationPlanId)
    ) {
      res.status(409).json({
        success: false,
        message: 'A different subscription is still active for this workspace. Cancel it and wait for its billing period to end before starting the education plan.',
      });
      return;
    }

    // Block if already active on the same plan
    if (company.subscriptionStatus === 'active' && company.subscriptionPlan === planId) {
      res.status(400).json({ success: false, message: 'This company already has an active subscription to this plan.' });
      return;
    }

    // Lifetime companies cannot purchase a regular subscription
    if (company.isLifetime) {
      res.status(400).json({ success: false, message: 'This workspace has lifetime access and does not require a subscription.' });
      return;
    }

    const user = await User.findById(req.user!.userId).select('email fullName');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const checkout = await polar.checkouts.create({
      products:      [polarProductId],
      successUrl:    `${clientUrl}/payment/success?plan=${planId}`,
      customerEmail: user.email,
      metadata: {
        companyId:   companyId,
        userId:      req.user!.userId,
        planId,
        userEmail:   user.email,
        companyName: company.name,
      },
    });

    res.json({ success: true, checkoutUrl: checkout.url, checkoutId: checkout.id });
  } catch (err: any) {
    console.error('[Subscription] Checkout creation failed:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create checkout session' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/subscription/cancel
// Cancels the company's Polar subscription (owner/admin only)
// ═══════════════════════════════════════════════════════════════════════════════
export const cancelSubscription = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!isBillingAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Only the company owner or an admin can cancel billing.' });
      return;
    }

    const company = await Company.findById(req.user!.companyId).select(
      'subscriptionStatus subscriptionEndDate polarSubscriptionId cancelAtPeriodEnd isLifetime',
    );
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    if (company.isLifetime) {
      res.status(400).json({ success: false, message: 'Lifetime access cannot be cancelled.' });
      return;
    }

    if (company.subscriptionStatus !== 'active') {
      res.status(400).json({ success: false, message: 'No active company subscription to cancel.' });
      return;
    }
    if (!company.subscriptionEndDate || company.subscriptionEndDate.getTime() <= Date.now()) {
      res.status(400).json({ success: false, message: 'The current billing period end is unavailable. Refresh billing status before trying again.' });
      return;
    }

    if (!company.polarSubscriptionId) {
      res.status(400).json({ success: false, message: 'No Polar subscription ID found. Please contact support.' });
      return;
    }

    const polar = getPolar();
    await polar.subscriptions.update({
      id: company.polarSubscriptionId,
      subscriptionUpdate: { action: 'cancel' } as any,
    });

    company.cancelAtPeriodEnd = true;
    company.pendingSubscriptionPlan = undefined;
    company.pendingSubscriptionPlanEffectiveDate = undefined;
    await company.save();

    await AuditLog.create({
      companyId: req.user!.companyId,
      userId:    req.user!.userId,
      action:    'COMPANY_SUBSCRIPTION_CANCELLED',
      resource:  'Company',
      resourceId: req.user!.companyId,
      details:   { planCancelled: company.polarSubscriptionId },
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period.',
      cancelAtPeriodEnd: true,
    });
  } catch (err: any) {
    console.error('[Subscription] Cancel failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/subscription/change-plan
// Schedules a downgrade for the end of the current billing period.
// ═══════════════════════════════════════════════════════════════════════════════
export const changeSubscriptionPlan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!isBillingAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Only the company owner or an admin can manage billing.' });
      return;
    }

    const { planId } = req.body as { planId: PlanId };
    if (!['free', 'starter', 'pro'].includes(planId)) {
      res.status(400).json({ success: false, message: 'Invalid plan selected.' });
      return;
    }

    const company = await Company.findById(req.user!.companyId).select(
      'subscriptionStatus subscriptionPlan subscriptionEndDate pendingSubscriptionPlan ' +
      'pendingSubscriptionPlanEffectiveDate polarSubscriptionId cancelAtPeriodEnd isLifetime organizationType',
    );
    if (!company) { res.status(404).json({ success: false, message: 'Company not found.' }); return; }
    if (educationPlanForOrganization(company.organizationType)) {
      res.status(400).json({ success: false, message: 'Education plans cannot be changed through the business downgrade flow.' });
      return;
    }
    if (company.isLifetime) {
      res.status(400).json({ success: false, message: 'Lifetime access cannot be changed to a paid plan.' });
      return;
    }
    if (company.subscriptionStatus !== 'active' || !company.polarSubscriptionId) {
      res.status(400).json({ success: false, message: 'An active Polar subscription is required to schedule a plan change.' });
      return;
    }
    if (!company.subscriptionEndDate || company.subscriptionEndDate.getTime() <= Date.now()) {
      res.status(400).json({ success: false, message: 'The current billing period end is unavailable. Refresh billing status before trying again.' });
      return;
    }
    if (company.cancelAtPeriodEnd) {
      res.status(400).json({ success: false, message: 'A cancellation is already scheduled. Reactivate the subscription before changing plans.' });
      return;
    }
    if (company.pendingSubscriptionPlan) {
      res.status(400).json({ success: false, message: 'A plan change is already scheduled for this subscription.' });
      return;
    }

    const businessPlanId = planId as 'free' | 'starter' | 'pro';
    const currentPlanId = company.subscriptionPlan as 'free' | 'starter' | 'pro';
    const rank: Record<'free' | 'starter' | 'pro', number> = { free: 0, starter: 1, pro: 2 };
    if (rank[businessPlanId] >= rank[currentPlanId]) {
      res.status(400).json({ success: false, message: 'Select a lower plan to schedule a downgrade.' });
      return;
    }

    const polar = getPolar();
    if (planId === 'free') {
      await polar.subscriptions.update({
        id: company.polarSubscriptionId,
        subscriptionUpdate: { action: 'cancel' } as any,
      });
      company.cancelAtPeriodEnd = true;
    } else {
      const productId = getPolarProductId(planId as 'starter' | 'pro');
      if (!productId) {
        res.status(500).json({ success: false, message: `Polar product ID is not configured for the ${planId} plan.` });
        return;
      }
      await polar.subscriptions.update({
        id: company.polarSubscriptionId,
        subscriptionUpdate: { productId, prorationBehavior: 'next_period' },
      });
    }

    company.pendingSubscriptionPlan = planId;
    company.pendingSubscriptionPlanEffectiveDate = company.subscriptionEndDate;
    await company.save();

    await AuditLog.create({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      action: 'COMPANY_SUBSCRIPTION_PLAN_CHANGE_SCHEDULED',
      resource: 'Company',
      resourceId: req.user!.companyId,
      details: { targetPlan: planId },
    }).catch(() => {});

    res.json({
      success: true,
      message: `Plan change to ${getPlan(planId).name} is scheduled for the end of the current billing period.`,
      pendingSubscriptionPlan: planId,
      effectiveDate: company.pendingSubscriptionPlanEffectiveDate,
    });
  } catch (err: any) {
    console.error('[Subscription] Plan change scheduling failed:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not schedule the plan change.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/subscription/reactivate
// Reactivates before cancellation takes effect (owner/admin only)
// ═══════════════════════════════════════════════════════════════════════════════
export const reactivateSubscription = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!isBillingAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Only the company owner or an admin can manage billing.' });
      return;
    }

    const company = await Company.findById(req.user!.companyId).select(
      'subscriptionStatus polarSubscriptionId cancelAtPeriodEnd',
    );
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    if (!company.cancelAtPeriodEnd) {
      res.status(400).json({ success: false, message: 'Subscription is not pending cancellation.' });
      return;
    }
    if (!company.polarSubscriptionId) {
      res.status(400).json({ success: false, message: 'No subscription ID on record.' });
      return;
    }

    const polar = getPolar();
    await polar.subscriptions.update({
      id: company.polarSubscriptionId,
      subscriptionUpdate: { action: 'resume' } as any,
    });

    company.cancelAtPeriodEnd = false;
    company.pendingSubscriptionPlan = undefined;
    company.pendingSubscriptionPlanEffectiveDate = undefined;
    await company.save();

    res.json({ success: true, message: 'Subscription reactivated successfully.' });
  } catch (err: any) {
    console.error('[Subscription] Reactivate failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/subscription/coupon
// Redeem a coupon code for the company (owner/admin only)
// ═══════════════════════════════════════════════════════════════════════════════
export const redeemCoupon = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!isBillingAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Only the company owner or an admin can redeem coupons.' });
      return;
    }

    const { code } = req.body as { code: string };
    if (!code?.trim()) {
      res.status(400).json({ success: false, message: 'Coupon code is required.' });
      return;
    }

    // Validate coupon server-side
    const couponDef = getCouponDefinition(code.trim());
    if (!couponDef) {
      res.status(400).json({ success: false, message: 'Invalid coupon code.' });
      return;
    }

    const company = await Company.findById(req.user!.companyId);
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    // Prevent re-use
    if (company.coupon) {
      res.status(400).json({
        success: false,
        message: `A coupon (${company.coupon.code}) has already been applied to this workspace.`,
      });
      return;
    }

    const redeemedAt = new Date();

    if (couponDef.type === 'lifetime') {
      // ── WORKGRINDLIFE: grant permanent lifetime access ─────────────────────
      company.subscriptionStatus = 'lifetime';
      company.subscriptionPlan   = 'pro';
      company.isLifetime         = true;
      company.cancelAtPeriodEnd  = false;
      // Sync legacy plan field
      company.plan = 'pro';
      company.coupon = {
        code:       couponDef.code,
        type:       'lifetime',
        redeemedAt,
        redeemedBy: req.user!.userId as any,
      };

      await company.save();

      await AuditLog.create({
        companyId:  req.user!.companyId,
        userId:     req.user!.userId,
        action:     'COUPON_LIFETIME_REDEEMED',
        resource:   'Company',
        resourceId: req.user!.companyId,
        details:    { couponCode: couponDef.code },
      }).catch(() => {});

      res.json({
        success: true,
        message: '🎉 Lifetime access activated! Your workspace now has permanent Pro access.',
        couponType: 'lifetime',
        isLifetime: true,
      });
      return;
    }

    if (couponDef.type === 'three_months_free') {
      // ── WORKGRIND3: 3 months free, then normal billing ─────────────────────
      const freeUntil = new Date(redeemedAt);
      freeUntil.setMonth(freeUntil.getMonth() + (couponDef.months ?? 3));

      // Mark company as having active access during the free period.
      // We do NOT create a Polar subscription here — the user should still
      // complete checkout after the free period, OR the coupon can be applied
      // during Polar checkout as a discount if Polar supports it.
      // For simplicity: we mark status as 'active' with an internal free period.
      if (company.subscriptionStatus !== 'active') {
        company.subscriptionStatus = 'active';
        company.subscriptionPlan   = 'starter'; // default to starter; can be changed at checkout
        company.plan = 'starter';
      }

      company.coupon = {
        code:       couponDef.code,
        type:       'three_months_free',
        redeemedAt,
        redeemedBy: req.user!.userId as any,
        freeUntil,
      };

      await company.save();

      await AuditLog.create({
        companyId:  req.user!.companyId,
        userId:     req.user!.userId,
        action:     'COUPON_3MONTHS_REDEEMED',
        resource:   'Company',
        resourceId: req.user!.companyId,
        details:    { couponCode: couponDef.code, freeUntil: freeUntil.toISOString() },
      }).catch(() => {});

      res.json({
        success:    true,
        message:    `🎉 3 months free applied! Your workspace has free access until ${freeUntil.toLocaleDateString()}.`,
        couponType: 'three_months_free',
        freeUntil:  freeUntil.toISOString(),
      });
      return;
    }

    res.status(400).json({ success: false, message: 'Unknown coupon type.' });
  } catch (err: any) {
    console.error('[Coupon] Redemption failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/subscription/webhook
// Polar webhook — updates COMPANY subscription, not individual user
// ═══════════════════════════════════════════════════════════════════════════════
export const handleWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhook] POLAR_WEBHOOK_SECRET not configured');
    res.status(500).json({ success: false, message: 'Webhook secret not configured' });
    return;
  }

  const signature = req.headers['webhook-signature'] as string;
  const timestamp = req.headers['webhook-timestamp'] as string;
  const webhookId = req.headers['webhook-id'] as string;

  if (!signature || !timestamp || !webhookId) {
    res.status(400).json({ success: false, message: 'Missing webhook headers' });
    return;
  }

  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      res.status(400).json({ success: false, message: 'Invalid webhook body' });
      return;
    }
    const signedContent = `${webhookId}.${timestamp}.${rawBody.toString('utf8')}`;
    const signatures    = signature.split(' ');

    const expectedSig = crypto
      .createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
      .update(signedContent)
      .digest('base64');

    const expectedSignature = Buffer.from(expectedSig, 'base64');
    const verified = signatures.some((s) => {
      const sigValue = s.split(',')[1];
      if (!sigValue) return false;
      const receivedSignature = Buffer.from(sigValue, 'base64');
      return receivedSignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(receivedSignature, expectedSignature);
    });

    if (!verified) {
      console.warn('[Webhook] Signature verification failed');
      res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    if (!/^\d+$/.test(timestamp)) {
      res.status(400).json({ success: false, message: 'Invalid webhook timestamp' });
      return;
    }
    const tsMs = Number(timestamp) * 1000;
    if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
      res.status(400).json({ success: false, message: 'Webhook timestamp too old' });
      return;
    }
  } catch (err) {
    console.error('[Webhook] Verification error:', err);
    res.status(400).json({ success: false, message: 'Webhook verification failed' });
    return;
  }

  const event = req.body as { type: string; data: any };
  if (!event || typeof event.type !== 'string' || !event.data || typeof event.data !== 'object') {
    res.status(400).json({ success: false, message: 'Invalid webhook event payload' });
    return;
  }
  try {
    if (!await claimPolarWebhookDelivery(webhookId)) {
      res.json({ success: true, received: true, duplicate: true });
      return;
    }
  } catch (error) {
    console.error('[Webhook] Could not record delivery idempotency state.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(503).json({ success: false, message: 'Webhook processing is temporarily unavailable' });
    return;
  }
  console.log(`[Webhook] Received: ${event.type}`);

  try {
    switch (event.type) {

      case 'order.created': {
        const order    = event.data;
        const meta     = order.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;

        if (!companyId) {
          console.warn('[Webhook] order.created: no companyId in metadata');
          break;
        }

        const company = await Company.findById(companyId);
        if (!company) { console.warn('[Webhook] order.created: company not found', companyId); break; }
        const planId = resolveWebhookPlan(company, order.productId, meta?.planId);
        if (!planId) {
          console.warn(`[Webhook] order.created: product does not match workspace type for ${companyId}`);
          break;
        }
        if (educationPlanForOrganization(company.organizationType)) {
          console.info(`[Webhook] order.created: awaiting verified subscription lifecycle event for ${companyId}`);
          break;
        }

        if (company.polarOrderId === order.id) { console.log('[Webhook] Duplicate order, skipping'); break; }

        company.subscriptionStatus    = 'active';
        company.subscriptionPlan      = planId;
        company.polarOrderId          = order.id;
        company.polarCustomerId       = order.customerId ?? company.polarCustomerId;
        company.subscriptionStartDate = new Date();
        company.cancelAtPeriodEnd     = false;
        company.plan = planId;
        await company.save();
        disconnectIfSubscriptionInactive(company);

        console.log(`[Webhook] ✅ Order activated plan ${planId} for company ${companyId}`);
        break;
      }

      case 'subscription.created': {
        const sub     = event.data;
        const meta    = sub.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;

        if (!companyId) { console.warn('[Webhook] subscription.created: no companyId'); break; }

        const company = await Company.findById(companyId);
        if (!company) { console.warn('[Webhook] subscription.created: company not found'); break; }
        const planId = resolveWebhookPlan(company, sub.productId, meta?.planId);
        if (!planId) {
          console.warn(`[Webhook] subscription.created: product does not match workspace type for ${companyId}`);
          break;
        }

        if (company.polarSubscriptionId === sub.id) { break; } // idempotent
        if (company.polarSubscriptionId && company.polarSubscriptionId !== sub.id &&
            hasVerifiedEducationSubscription(company) &&
            hasActiveAccess(company.subscriptionStatus, company.subscriptionEndDate, company.trialEndDate)) {
          console.warn(`[Webhook] subscription.created: existing subscription still grants access for ${companyId}`);
          break;
        }

        const polarStatus = normalizePolarSubscriptionStatus(sub.status);
        if (!polarStatus) {
          console.warn(`[Webhook] subscription.created: unsupported Polar status "${sub.status}"`);
          break;
        }
        company.subscriptionStatus    = polarStatus;
        company.subscriptionPlan      = planId;
        company.polarSubscriptionId   = sub.id;
        company.polarCustomerId       = sub.customerId ?? company.polarCustomerId;
        company.polarProductId        = sub.productId  ?? company.polarProductId;
        company.subscriptionStartDate = new Date(sub.startedAt ?? Date.now());
        company.subscriptionEndDate   = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : undefined;
        if (sub.status === 'trialing' && sub.currentPeriodEnd) {
          company.trialEndDate = new Date(sub.currentPeriodEnd);
        }
        company.cancelAtPeriodEnd     = sub.cancelAtPeriodEnd ?? false;
        company.plan = planId;
        await company.save();
        disconnectIfSubscriptionInactive(company);

        console.log(`[Webhook] ✅ Subscription created: ${sub.id} for company ${companyId}`);
        break;
      }

      case 'subscription.updated': {
        const sub     = event.data;
        const meta    = sub.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;

        if (!companyId) break;
        const company = await Company.findById(companyId);
        if (!company) break;
        if (!isCurrentPolarSubscription(company, sub)) {
          console.warn(`[Webhook] subscription.updated: event does not match the recorded subscription for ${companyId}`);
          break;
        }

        const productPlan = resolveWebhookPlan(company, sub.productId, meta?.planId);
        if (!productPlan) {
          console.warn(`[Webhook] subscription.updated: product does not match workspace type for ${companyId}`);
          break;
        }
        const pendingPlanTakesEffect = company.pendingSubscriptionPlan &&
          productPlan === company.pendingSubscriptionPlan &&
          (!company.subscriptionEndDate || Date.now() >= company.subscriptionEndDate.getTime());
        if (pendingPlanTakesEffect && productPlan) {
          company.subscriptionPlan = productPlan;
          company.plan = productPlan;
          company.pendingSubscriptionPlan = undefined;
          company.pendingSubscriptionPlanEffectiveDate = undefined;
        } else if (!company.pendingSubscriptionPlan && productPlan) {
          company.subscriptionPlan = productPlan;
          company.plan = productPlan;
        } else if (
          !company.pendingSubscriptionPlan &&
          productPlan &&
          company.subscriptionPlan !== productPlan
        ) {
          company.subscriptionPlan = productPlan;
          company.plan = productPlan;
        }
        const polarStatus = normalizePolarSubscriptionStatus(sub.status);
        if (polarStatus) company.subscriptionStatus = polarStatus;
        else console.warn(`[Webhook] subscription.updated: unsupported Polar status "${sub.status}"`);
        if (sub.currentPeriodEnd) company.subscriptionEndDate = new Date(sub.currentPeriodEnd);
        if (sub.status === 'trialing' && sub.currentPeriodEnd) {
          company.trialEndDate = new Date(sub.currentPeriodEnd);
        }
        company.cancelAtPeriodEnd = sub.cancelAtPeriodEnd ?? false;
        await company.save();
        disconnectIfSubscriptionInactive(company);

        console.log(`[Webhook] ✅ Subscription updated for company ${companyId}`);
        break;
      }

      case 'subscription.canceled':
      case 'subscription.cancelled': {
        const sub     = event.data;
        const meta    = sub.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;

        if (!companyId) break;
        const company = await Company.findById(companyId);
        if (!company) break;
        if (!isCurrentPolarSubscription(company, sub)) {
          console.warn(`[Webhook] subscription.canceled: event does not match the recorded subscription for ${companyId}`);
          break;
        }
        if (!resolveWebhookPlan(company, sub.productId, meta?.planId) &&
            !(company.polarSubscriptionId === sub.id && company.polarProductId === sub.productId)) {
          console.warn(`[Webhook] subscription.canceled: product does not match workspace type for ${companyId}`);
          break;
        }

        company.subscriptionStatus = 'cancelled';
        company.cancelAtPeriodEnd  = sub.cancelAtPeriodEnd ?? true;
        if (sub.currentPeriodEnd) company.subscriptionEndDate = new Date(sub.currentPeriodEnd);
        if (company.pendingSubscriptionPlan === 'free' &&
            company.subscriptionEndDate &&
            Date.now() >= company.subscriptionEndDate.getTime()) {
          company.pendingSubscriptionPlan = undefined;
          company.pendingSubscriptionPlanEffectiveDate = undefined;
        }
        await company.save();
        disconnectIfSubscriptionInactive(company);

        console.log(`[Webhook] ✅ Subscription cancelled for company ${companyId}`);
        break;
      }

      case 'subscription.uncanceled': {
        const sub     = event.data;
        const meta    = sub.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;
        if (!companyId) break;
        const company = await Company.findById(companyId);
        if (!company) break;
        if (!isCurrentPolarSubscription(company, sub)) {
          console.warn(`[Webhook] subscription.uncanceled: event does not match the recorded subscription for ${companyId}`);
          break;
        }
        if (!resolveWebhookPlan(company, sub.productId, meta?.planId) &&
            !(company.polarSubscriptionId === sub.id && company.polarProductId === sub.productId)) {
          console.warn(`[Webhook] subscription.uncanceled: product does not match workspace type for ${companyId}`);
          break;
        }
        const polarStatus = normalizePolarSubscriptionStatus(sub.status);
        if (!polarStatus) {
          console.warn(`[Webhook] subscription.uncanceled: unsupported Polar status "${sub.status}"`);
          break;
        }
        company.subscriptionStatus = polarStatus;
        company.cancelAtPeriodEnd  = false;
        if (sub.currentPeriodEnd) company.subscriptionEndDate = new Date(sub.currentPeriodEnd);
        await company.save();
        disconnectIfSubscriptionInactive(company);
        break;
      }

      case 'subscription.revoked': {
        const sub     = event.data;
        const meta    = sub.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;
        if (!companyId) break;
        const company = await Company.findById(companyId);
        if (!company) break;
        if (!isCurrentPolarSubscription(company, sub)) {
          console.warn(`[Webhook] subscription.revoked: event does not match the recorded subscription for ${companyId}`);
          break;
        }
        if (!resolveWebhookPlan(company, sub.productId, meta?.planId) &&
            !(company.polarSubscriptionId === sub.id && company.polarProductId === sub.productId)) {
          console.warn(`[Webhook] subscription.revoked: product does not match workspace type for ${companyId}`);
          break;
        }
        company.subscriptionStatus = 'expired';
        if (sub.currentPeriodEnd) company.subscriptionEndDate = new Date(sub.currentPeriodEnd);
        if (sub.productId) company.polarProductId = sub.productId;
        if (sub.customerId) company.polarCustomerId = sub.customerId;
        await company.save();
        disconnectCompanySockets(company._id.toString());
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ success: true, received: true });
  } catch (err: any) {
    await releasePolarWebhookDelivery(webhookId).catch((releaseError: unknown) => {
      console.error('[Webhook] Failed to release delivery claim after processing error.', {
        errorName: releaseError instanceof Error ? releaseError.name : 'UnknownError',
      });
    });
    console.error('[Webhook] Processing error:', err);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/subscription/plans
// Public endpoint — returns all plan configs (no secrets)
// ═══════════════════════════════════════════════════════════════════════════════
export const getPlans = async (_req: Request, res: Response): Promise<void> => {
  const plans = Object.values(PLANS).map((p) => ({
    id:           p.id,
    name:         p.name,
    priceMonthly: p.priceMonthly,
    priceDisplay: p.priceDisplay,
    description:  p.description,
    highlighted:  p.highlighted,
    badgeLabel:   p.badgeLabel,
    entitlements: p.entitlements,
    limits:       p.limits,
    features:     p.features,
  }));
  const educationPlans = await Promise.all(getEducationPlanPricing().map(async (plan) => ({
    ...plan,
    ...await getEducationCheckoutConfiguration(plan.id),
  })));
  res.json({ success: true, plans, educationPlans });
};
