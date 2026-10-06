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
import { AuthRequest } from '../middleware/auth';
import {
  PLANS,
  TRIAL_DAYS,
  PlanId,
  getPlan,
  getPolarProductId,
  validatePolarProductId,
  hasActiveAccess,
} from '../config/subscription';
import {
  getCompanySubscription,
  getCouponDefinition,
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

// ── Guard: must be owner or admin ─────────────────────────────────────────────
function isBillingAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
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
          planName:             sub.status === 'expired'
            ? sub.plan === 'free' ? 'Free Trial' : plan.name
            : sub.status === 'never_subscribed'
              ? 'No subscription'
              : plan.name,
          priceDisplay:         plan.priceDisplay,
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

    if (!planId || !PLANS[planId]) {
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

    const configError = validatePolarProductId(planId);
    if (configError) {
      console.error(`[Subscription] Configuration error: ${configError}`);
      res.status(500).json({ success: false, message: configError });
      return;
    }

    const polarProductId = getPolarProductId(planId);
    if (!polarProductId) {
      res.status(500).json({
        success: false,
        message: `Polar product ID not configured for plan "${planId}". Set POLAR_${planId.toUpperCase()}_PRODUCT_ID in your .env.`,
      });
      return;
    }

    const company = await Company.findById(companyId).select(
      'name subscriptionStatus subscriptionPlan isLifetime polarCustomerId polarSubscriptionId',
    );
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

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
    const polar     = getPolar();

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
      'pendingSubscriptionPlanEffectiveDate polarSubscriptionId cancelAtPeriodEnd isLifetime',
    );
    if (!company) { res.status(404).json({ success: false, message: 'Company not found.' }); return; }
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

    const rank: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };
    if (rank[planId] >= rank[company.subscriptionPlan]) {
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
      const productId = getPolarProductId(planId);
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
    const rawBody       = (req as any).rawBody as Buffer;
    const signedContent = `${webhookId}.${timestamp}.${rawBody.toString('utf8')}`;
    const signatures    = signature.split(' ');

    const expectedSig = crypto
      .createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
      .update(signedContent)
      .digest('base64');

    const verified = signatures.some((s) => {
      const sigValue = s.split(',')[1];
      return sigValue === expectedSig;
    });

    if (!verified) {
      console.warn('[Webhook] Signature verification failed');
      res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    const tsMs = parseInt(timestamp) * 1000;
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
  console.log(`[Webhook] Received: ${event.type}`);

  try {
    switch (event.type) {

      case 'order.created': {
        const order    = event.data;
        const meta     = order.metadata as Record<string, string> | undefined;
        const companyId = meta?.companyId;
        const planId   = (meta?.planId || 'starter') as PlanId;

        if (!companyId) {
          console.warn('[Webhook] order.created: no companyId in metadata');
          break;
        }

        const company = await Company.findById(companyId);
        if (!company) { console.warn('[Webhook] order.created: company not found', companyId); break; }

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
        const planId  = (meta?.planId || 'starter') as PlanId;

        if (!companyId) { console.warn('[Webhook] subscription.created: no companyId'); break; }

        const company = await Company.findById(companyId);
        if (!company) { console.warn('[Webhook] subscription.created: company not found'); break; }

        if (company.polarSubscriptionId === sub.id) { break; } // idempotent

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

        const productPlan = sub.productId
          ? (['starter', 'pro'] as const).find((candidate) => getPolarProductId(candidate) === sub.productId)
          : undefined;
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
        } else if (!company.pendingSubscriptionPlan && (meta?.planId === 'starter' || meta?.planId === 'pro')) {
          company.subscriptionPlan = meta.planId;
          company.plan = meta.planId;
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
    console.error('[Webhook] Processing error:', err);
    res.json({ success: false, error: err.message });
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
  res.json({ success: true, plans });
};
