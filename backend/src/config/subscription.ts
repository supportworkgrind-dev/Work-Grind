/**
 * WorkGrind Subscription Plan Configuration
 *
 * Single source of truth for all plan definitions.
 * Change prices, limits, or features here — they propagate everywhere.
 *
 * Polar Product IDs are read at call-time (not module load) so that
 * environment variables are always current.
 */

export type PlanId = 'free' | 'starter' | 'pro';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'none'
  | 'never_subscribed';

export interface PlanFeature {
  label: string;
  included: boolean;
}

export const PLAN_ENTITLEMENTS = {
  crm: true,
  tasksProjects: true,
  teamChat: true,
  meetingsCalendar: true,
  fileStorage: true,
  aiAssistant: true,
  prioritySupport: true,
  advancedAnalytics: true,
} as const;

export type EntitlementId = keyof typeof PLAN_ENTITLEMENTS;

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceMonthly: number;          // USD cents (0 = free/trial)
  priceDisplay: string;          // human-readable, e.g. "$9/mo"
  description: string;
  highlighted: boolean;          // show as recommended
  badgeLabel?: string;           // e.g. "Most Popular"
  entitlements: Record<keyof typeof PLAN_ENTITLEMENTS, boolean>;
  /** Resolved at call-time from process.env — never the empty-string default */
  polarProductId?: string;
  limits: {
    members:    number;          // -1 = unlimited
    storage:    number;          // bytes
    aiRequests: number;          // per month, -1 = unlimited
  };
  features: PlanFeature[];
}

export const TRIAL_DAYS = 7;

// ── Static plan definitions (no env vars here) ────────────────────────────────
// Polar Product IDs are injected by getPlan() / getPolarProductId() at call-time.
const STATIC_PLANS: Omit<PlanConfig, 'polarProductId' | 'entitlements'>[] = [
  {
    id: 'free',
    name: 'Free Trial',
    priceMonthly: 0,
    priceDisplay: '$0',
    description: `${TRIAL_DAYS}-day full-access trial. A paid subscription is required after the trial ends.`,
    highlighted: false,
    limits: {
      members:    5,
      storage:    1 * 1024 * 1024 * 1024,   // 1 GB
      aiRequests: 50,
    },
    features: [
      { label: 'CRM (contacts, companies, deals)',  included: true },
      { label: 'Tasks & Projects',                  included: true },
      { label: 'Team Chat',                         included: true },
      { label: 'Meetings & Calendar',               included: true },
      { label: 'File Storage (1 GB)',               included: true },
      { label: 'AI Assistant (50 req/mo)',          included: true },
      { label: 'Up to 5 members',                   included: true },
      { label: 'Priority Support',                  included: true },
      { label: 'Advanced Analytics',                included: true },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 900,           // $9.00
    priceDisplay: '$9/mo',
    description: 'Everything you need for a small team or solo professional.',
    highlighted: false,
    limits: {
      members:    20,
      storage:    10 * 1024 * 1024 * 1024,  // 10 GB
      aiRequests: 200,
    },
    features: [
      { label: 'CRM (contacts, companies, deals)',  included: true  },
      { label: 'Tasks & Projects',                  included: true  },
      { label: 'Team Chat',                         included: true  },
      { label: 'Meetings & Calendar',               included: true  },
      { label: 'File Storage (10 GB)',              included: true  },
      { label: 'AI Assistant (200 req/mo)',         included: true  },
      { label: 'Up to 20 members',                  included: true  },
      { label: 'Priority Support',                  included: true },
      { label: 'Advanced Analytics',                included: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 1900,          // $19.00
    priceDisplay: '$19/mo',
    description: 'All features, unlimited members, priority support.',
    highlighted: true,
    badgeLabel: 'Most Popular',
    limits: {
      members:    -1,
      storage:    100 * 1024 * 1024 * 1024, // 100 GB
      aiRequests: -1,
    },
    features: [
      { label: 'CRM (contacts, companies, deals)',  included: true },
      { label: 'Tasks & Projects',                  included: true },
      { label: 'Team Chat',                         included: true },
      { label: 'Meetings & Calendar',               included: true },
      { label: 'File Storage (100 GB)',             included: true },
      { label: 'AI Assistant (unlimited)',          included: true },
      { label: 'Unlimited members',                 included: true },
      { label: 'Priority Support',                  included: true },
      { label: 'Advanced Analytics',                included: true },
    ],
  },
];

/** Environment variable names for each paid plan's Polar Product ID. */
const POLAR_PRODUCT_ID_ENV: Partial<Record<PlanId, string>> = {
  starter: 'POLAR_STARTER_PRODUCT_ID',
  pro:     'POLAR_PRO_PRODUCT_ID',
};

/**
 * Read the Polar Product ID for a paid plan from the environment at call-time.
 * Returns undefined for the free plan (no Polar product needed).
 * Returns an empty string if the env var is not set — callers must validate.
 */
export function getPolarProductId(planId: PlanId): string | undefined {
  const envKey = POLAR_PRODUCT_ID_ENV[planId];
  if (!envKey) return undefined;          // free plan — no product ID needed
  return process.env[envKey]?.trim() || '';
}

/**
 * Validate that a paid plan has its Polar Product ID configured.
 * Returns a descriptive error string, or null if configured correctly.
 */
export function validatePolarProductId(planId: PlanId): string | null {
  if (planId === 'free') return null;
  const envKey = POLAR_PRODUCT_ID_ENV[planId];
  if (!envKey) return null;
  const value = process.env[envKey]?.trim();
  if (!value) {
    return (
      `Polar Product ID not configured for the "${planId}" plan. ` +
      `Set ${envKey} in your backend .env file. ` +
      `Copy the Product ID from your Polar dashboard → Products.`
    );
  }
  return null;
}

/**
 * Log whether each paid plan's Polar Product ID is configured.
 * Only reports presence/absence — never prints the actual ID value.
 * Call this once at server startup after dotenv has been loaded.
 */
export function logPolarConfig(): void {
  const paidPlans: PlanId[] = ['starter', 'pro'];
  for (const planId of paidPlans) {
    const envKey = POLAR_PRODUCT_ID_ENV[planId]!;
    const value  = process.env[envKey]?.trim();
    if (value) {
      console.log(`✅ Polar: ${envKey} is configured (${planId} plan checkout enabled)`);
    } else {
      console.warn(`⚠️  Polar: ${envKey} is NOT set — ${planId} plan checkout will return a 500 error until configured`);
    }
  }
  const env = process.env.POLAR_ENVIRONMENT || 'sandbox';
  console.log(`ℹ️  Polar: running in ${env.toUpperCase()} mode`);
}

/**
 * Returns the full plan config for an ID, injecting the Polar Product ID
 * from the environment at call-time.
 */
export function getPlan(id: PlanId | string): PlanConfig {
  const base = STATIC_PLANS.find((p) => p.id === id) ?? STATIC_PLANS.find((p) => p.id === 'free')!;
  return {
    ...base,
    entitlements: PLAN_ENTITLEMENTS,
    polarProductId: getPolarProductId(base.id as PlanId),
  };
}

/** Stable PLANS record — Polar IDs injected at call-time via getPlan(). */
export const PLANS: Record<PlanId, PlanConfig> = Object.fromEntries(
  STATIC_PLANS.map((p) => [p.id, getPlan(p.id as PlanId)])
) as Record<PlanId, PlanConfig>;

/** Resolves access from the provider status and its effective period end. */
export function hasActiveAccess(
  status: SubscriptionStatus | string,
  subscriptionEndDate?: Date,
  trialEndDate?: Date,
): boolean {
  const now = Date.now();
  if (status === 'lifetime') return true;
  if (status === 'trialing') return Boolean(trialEndDate && trialEndDate.getTime() > now);
  if (status === 'active') {
    return !subscriptionEndDate || subscriptionEndDate.getTime() > now;
  }
  if (status === 'past_due') return true;
  if (status === 'cancelled') {
    return Boolean(subscriptionEndDate && subscriptionEndDate.getTime() > now);
  }
  return false;
}

export function resolveEffectivePlanId(
  status: SubscriptionStatus | string,
  purchasedPlan: PlanId | string,
  isLifetime = false,
  subscriptionEndDate?: Date,
): PlanId {
  if (isLifetime || status === 'lifetime') return 'pro';
  if (status === 'trialing') return 'free';
  if (status === 'expired' && (purchasedPlan === 'starter' || purchasedPlan === 'pro')) {
    return purchasedPlan;
  }
  const paidThrough = status === 'past_due' ||
    (status === 'cancelled' && subscriptionEndDate && subscriptionEndDate.getTime() > Date.now());
  if ((status === 'active' || paidThrough) && (purchasedPlan === 'starter' || purchasedPlan === 'pro')) {
    return purchasedPlan;
  }
  if (status === 'unpaid' || status === 'paused' || status === 'incomplete') {
    if (purchasedPlan === 'starter' || purchasedPlan === 'pro') return purchasedPlan;
  }
  return 'free';
}
