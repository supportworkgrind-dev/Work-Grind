'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { SubscriptionInfo, PlanConfig } from '@/types';
import {
  CreditCard, CheckCircle2, AlertCircle, Clock, Zap, ArrowUpRight,
  RefreshCw, XCircle, Loader2, Star, Infinity, Tag, Lock,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    trialing:  { label: 'Trialing',     className: 'badge-blue'    },
    active:    { label: 'Active',      className: 'badge-emerald' },
    expired:   { label: 'Expired',     className: 'badge-rose'    },
    cancelled: { label: 'Cancelled · active until period end', className: 'badge-amber'   },
    past_due:  { label: 'Past Due',    className: 'badge-rose'    },
    unpaid:    { label: 'Unpaid',      className: 'badge-rose'    },
    paused:    { label: 'Paused',      className: 'badge-amber'   },
    incomplete:{ label: 'Incomplete',  className: 'badge-amber'   },
    lifetime:  { label: 'Lifetime',    className: 'badge-purple'  },
    none:      { label: 'No Subscription', className: 'badge-slate' },
    no_plan:   { label: 'No Subscription', className: 'badge-slate' },
    never_subscribed: { label: 'No Subscription', className: 'badge-slate' },
  };
  const s = map[status] ?? { label: status, className: 'badge-slate' };
  return <span className={`badge ${s.className} capitalize`}>{s.label}</span>;
}

function PlanCard({
  plan, current, currentPlan, hasActiveAccess, trialUnavailable, pending, blocked, onSelect, loading, isOwnerAdmin,
}: {
  plan: PlanConfig;
  current: boolean;
  currentPlan?: string;
  hasActiveAccess: boolean;
  trialUnavailable: boolean;
  pending: boolean;
  blocked: boolean;
  onSelect: (id: string) => void;
  loading: boolean;
  isOwnerAdmin: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-150
      ${current ? 'border-indigo-500 shadow-md shadow-indigo-500/10' : 'hover:border-indigo-400/50'}`}
      style={{ borderColor: current ? 'var(--accent)' : 'var(--border-color)', background: 'var(--bg-card)' }}
    >
      {plan.badgeLabel && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
          {plan.badgeLabel}
        </span>
      )}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{plan.name}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {plan.priceMonthly === 0 ? 'Free' : `$${plan.priceMonthly / 100}`}
          </span>
          {plan.priceMonthly > 0 && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>}
        </div>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{plan.description}</p>
      </div>
      <ul className="space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f.label} className="flex items-center gap-2 text-[12px]"
            style={{ color: f.included ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {f.included
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              : <XCircle      className="h-3.5 w-3.5 shrink-0 opacity-30" />}
            {f.label}
          </li>
        ))}
      </ul>
      {current ? (
        <div className="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-semibold"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-subtle)' }}>
          <CheckCircle2 className="h-3.5 w-3.5" />Current plan
        </div>
      ) : pending ? (
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2 text-[12px] font-semibold text-amber-700">
          <Clock className="h-3.5 w-3.5" />Downgrade scheduled
        </div>
      ) : blocked ? (
        <p className="text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {currentPlan && PLAN_RANK[plan.id] < PLAN_RANK[currentPlan]
            ? 'Resolve the scheduled subscription change first'
            : 'A subscription change is already scheduled'}
        </p>
      ) : plan.id === 'free' ? (
        <p className="text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {trialUnavailable ? '7-day trial has ended' : 'Available as a 7-day trial'}
        </p>
      ) : (
        isOwnerAdmin ? (
          <button disabled={loading} onClick={() => onSelect(plan.id)} className="btn-primary h-9 w-full justify-center">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {hasActiveAccess && currentPlan && PLAN_RANK[plan.id] < PLAN_RANK[currentPlan] ? 'Downgrade to ' : 'Upgrade to '}{plan.name}
          </button>
        ) : (
          <p className="text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <Lock className="inline h-3 w-3 mr-1" />Contact your workspace admin to upgrade
          </p>
        )
      )}
    </div>
  );
}

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2 };

/* ═══════════════════════════════════════════════════════════════════════ */

export default function BillingPage() {
  const { user, company, fetchCurrentUser, refreshSubscription } = useAuthStore();

  const [sub,          setSub]          = useState<SubscriptionInfo | null>(null);
  const [plans,        setPlans]        = useState<PlanConfig[]>([]);
  const [loadingSub,   setLoadingSub]   = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [couponCode,   setCouponCode]   = useState('');
  const [couponLoading,setCouponLoading]= useState(false);

  const isOwnerAdmin = user?.role === 'owner' || user?.role === 'admin';

  const loadData = useCallback(async () => {
    setLoadingSub(true);
    try {
      const [subRes, planRes] = await Promise.all([
        api.get('/subscription/status'),
        api.get('/subscription/plans'),
      ]);
      if (subRes.data.success) {
        setSub(subRes.data.subscription);
        void refreshSubscription();
      }
      if (planRes.data.success) setPlans(planRes.data.plans);
    } catch (error) {
      console.error('Failed to load subscription billing data:', error);
      setError('Could not load the current subscription state. Refresh the page or try again.');
    }
    finally { setLoadingSub(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpgrade = async (planId: string) => {
    setCheckoutPlan(planId); setError(''); setSuccess('');
    try {
      if (sub?.status === 'active' && PLAN_RANK[planId] < PLAN_RANK[sub.plan]) {
        const response = await api.post('/subscription/change-plan', { planId });
        if (response.data.success) {
          setSuccess(response.data.message);
          await loadData();
          await fetchCurrentUser();
        } else {
          setError(response.data.message || 'Could not schedule this plan change.');
        }
        return;
      }
      const res = await api.post('/subscription/checkout', { planId });
      if (res.data.success && res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setError(res.data.message || 'Failed to create checkout session.');
      }
    } catch (e: any) { setError(e.response?.data?.message || 'Failed to create checkout session.'); }
    finally { setCheckoutPlan(null); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your workspace subscription? All members will keep access until the billing period ends.')) return;
    setCancelling(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/subscription/cancel');
      if (res.data.success) {
        setSuccess("Subscription cancelled. Your workspace keeps access until the billing period ends.");
        await loadData(); await fetchCurrentUser();
      } else { setError(res.data.message); }
    } catch (e: any) { setError(e.response?.data?.message || 'Cancellation failed.'); }
    finally { setCancelling(false); }
  };

  const handleReactivate = async () => {
    setReactivating(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/subscription/reactivate');
      if (res.data.success) {
        setSuccess('Subscription reactivated!');
        await loadData(); await fetchCurrentUser();
      } else { setError(res.data.message); }
    } catch (e: any) { setError(e.response?.data?.message || 'Reactivation failed.'); }
    finally { setReactivating(false); }
  };

  const handleCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/subscription/coupon', { code: couponCode.trim() });
      if (res.data.success) {
        setSuccess(res.data.message);
        setCouponCode('');
        await loadData(); await fetchCurrentUser();
      } else { setError(res.data.message); }
    } catch (e: any) { setError(e.response?.data?.message || 'Coupon redemption failed.'); }
    finally { setCouponLoading(false); }
  };

  if (loadingSub) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const isTrialing  = sub?.status === 'trialing';
  const isPastDue   = sub?.status === 'past_due' && sub.hasActiveAccess;
  const isCancelledActive = sub?.status === 'cancelled' && sub.hasActiveAccess;
  const isActive    = sub?.status === 'active' || (
    sub?.status === 'cancelled' &&
    !!sub.cancelAtPeriodEnd &&
    !!sub.subscriptionEndDate &&
    new Date(sub.subscriptionEndDate).getTime() > Date.now()
  );
  const isLifetime  = sub?.status === 'lifetime' || sub?.isLifetime;
  const isExpiredOrCancelled = Boolean(
    sub && ['expired', 'unpaid', 'paused', 'incomplete'].includes(sub.status),
  ) || Boolean(sub?.status === 'cancelled' && !sub.hasActiveAccess);
  const displayPlanName = sub?.status === 'no_plan' || sub?.status === 'none' || sub?.status === 'never_subscribed'
      ? 'No subscription'
      : sub?.status === 'trialing'
        ? 'Free Trial'
        : sub?.planName;
  const displayEndDate = sub?.status === 'expired'
    ? sub.subscriptionEndDate ?? sub.trialEndDate
    : isTrialing
      ? sub?.trialEndDate
      : sub?.subscriptionEndDate;
  const subscriptionChangeBlocked = Boolean(
    sub?.hasActiveAccess && (sub.pendingSubscriptionPlan || sub.cancelAtPeriodEnd),
  );

  return (
    <div className="space-y-8 pb-10 max-w-4xl">

      {/* Header */}
      <div className="page-hero-sm">
        <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--accent)' }}>Billing</p>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Workspace Subscription
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your workspace pays once — all members share the subscription automatically.
          {!isOwnerAdmin && <span className="ml-1 font-semibold">Only workspace owners and admins can manage billing.</span>}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
        </div>
      )}

      {/* Lifetime banner */}
      {isLifetime && (
        <div className="rounded-2xl border border-purple-400/30 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.06) 100%)' }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100">
            <Infinity className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Lifetime Pro Access</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Your workspace has permanent Pro access. All current and future members are covered.
            </p>
          </div>
          <span className="badge badge-purple text-sm font-bold px-3 py-1">Forever ♾️</span>
        </div>
      )}

      {/* Trial banner */}
      {isTrialing && !isLifetime && (
        <div className="rounded-2xl border border-indigo-400/30 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(59,130,246,0.06) 100%)' }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100">
            <Zap className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Workspace 7-day free trial active</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {sub?.trialDaysRemaining != null && sub.trialDaysRemaining > 0
                ? `${sub.trialDaysRemaining} day${sub.trialDaysRemaining !== 1 ? 's' : ''} remaining — choose a plan for your workspace.`
                : 'Trial ends today. Choose a plan to keep your team\'s access.'}
            </p>
          </div>
          {isOwnerAdmin && (
            <Link href="/pricing" className="btn-primary h-9 px-5 shrink-0 flex items-center gap-2">
              <Star className="h-3.5 w-3.5" />Choose a plan
            </Link>
          )}
        </div>
      )}

      {/* Coupon free period banner */}
      {sub?.coupon?.type === 'three_months_free' && sub.coupon.freeUntil && (
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 p-4 flex items-center gap-3">
          <Tag className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">
            <span className="font-bold">Coupon {sub.coupon.code} applied</span> — free access until{' '}
            {formatDate(sub.coupon.freeUntil, 'MMM d, yyyy')}. Normal billing resumes automatically after that.
          </p>
        </div>
      )}

      {/* Expired banner */}
      {isPastDue && (
        <div className="rounded-2xl border border-amber-300/50 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-bold">Payment is past due</p>
          <p className="mt-1 text-xs">WorkGrind access remains available while Polar reports the subscription as past due.</p>
        </div>
      )}
      {isExpiredOrCancelled && !isLifetime && (
        <div className="rounded-2xl border border-rose-300/40 bg-rose-50 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-700">
              {sub?.status === 'cancelled'
                ? 'Workspace subscription cancelled'
                : sub?.status === 'expired'
                  ? 'Workspace subscription expired'
                : sub?.status === 'unpaid'
                  ? 'Payment is unpaid'
                  : sub?.status === 'paused'
                    ? 'Workspace subscription paused'
                    : sub?.status === 'incomplete'
                      ? 'Workspace subscription is incomplete'
                      : 'Workspace subscription inactive'}
            </p>
            <p className="text-xs text-rose-600 mt-0.5">Workspace access is paused for all members until a subscription becomes active.</p>
          </div>
          {isOwnerAdmin && <Link href="/billing#plans" className="btn-primary h-9 px-5 shrink-0">Resubscribe</Link>}
        </div>
      )}

      {sub?.pendingSubscriptionPlan && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">
            Plan change scheduled: {plans.find((plan) => plan.id === sub.pendingSubscriptionPlan)?.name ?? sub.pendingSubscriptionPlan}
          </p>
          <p className="mt-1 text-xs">
            It takes effect at the end of the current billing period
            {sub.pendingSubscriptionPlanEffectiveDate ? ` (${formatDate(sub.pendingSubscriptionPlanEffectiveDate, 'MMM d, yyyy')})` : ''}.
          </p>
        </div>
      )}

      {/* Current plan card */}
      {!isLifetime && (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Workspace Plan</h2>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {company?.name || 'Your workspace'} · shared by all members
                </p>
              </div>
            </div>
            <button onClick={loadData} className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Plan</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{displayPlanName ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Status</p>
              {sub ? <StatusBadge status={sub.status} /> : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Price</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {sub?.priceDisplay ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                {isTrialing ? 'Trial ends' : isCancelledActive ? 'Access until' : isActive ? 'Next billing' : 'End date'}
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {displayEndDate ? formatDate(displayEndDate, 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>

          {isTrialing && sub?.trialDaysRemaining != null && (
            <div className="px-5 pb-5">
              <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Trial progress</span>
                <span className="font-semibold">{sub.trialDaysRemaining} / 7 days remaining</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
                <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.round((sub.trialDaysRemaining / 7) * 100)}%` }} />
              </div>
            </div>
          )}

          {sub?.cancelAtPeriodEnd && isActive && (
            <div className="px-5 pb-4 flex items-center justify-between gap-3">
              <p className="text-[12px] text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Cancels on {sub.subscriptionEndDate ? formatDate(sub.subscriptionEndDate, 'MMM d, yyyy') : 'period end'}
              </p>
              {isOwnerAdmin && (
                <button onClick={handleReactivate} disabled={reactivating} className="btn-secondary h-8 px-3 text-[12px]">
                  {reactivating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Keep subscription
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plan selection — owner/admin only */}
      {!isLifetime && (
        <div id="plans">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {isActive || isPastDue ? 'Change Plan' : 'Choose a Plan'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={sub?.plan === plan.id && Boolean(sub.hasActiveAccess)}
                currentPlan={sub?.plan}
                hasActiveAccess={Boolean(sub?.hasActiveAccess)}
                trialUnavailable={Boolean(sub?.trialStartDate || sub?.trialEndDate || sub?.status === 'expired')}
                pending={sub?.pendingSubscriptionPlan === plan.id}
                blocked={subscriptionChangeBlocked}
                onSelect={handleUpgrade}
                loading={checkoutPlan === plan.id}
                isOwnerAdmin={isOwnerAdmin}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
            Payments processed securely by Polar. No card stored on our servers.
            Your workspace pays once — all members are covered.
          </p>
        </div>
      )}

      {/* Coupon section — owner/admin only */}
      {isOwnerAdmin && !isLifetime && !sub?.coupon && (
        <div className="surface rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            <Tag className="inline h-4 w-4 mr-1.5" />Redeem a Coupon
          </h3>
          <p className="text-[12px] mb-4" style={{ color: 'var(--text-secondary)' }}>
            Apply a coupon code to your workspace to unlock discounts or special offers.
          </p>
          <form onSubmit={handleCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="input-field flex-1 h-9 text-sm uppercase"
            />
            <button type="submit" disabled={couponLoading || !couponCode.trim()} className="btn-primary h-9 px-4 shrink-0">
              {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
            </button>
          </form>
        </div>
      )}

      {/* Cancel zone — owner/admin only */}
      {isOwnerAdmin && isActive && !sub?.cancelAtPeriodEnd && !isLifetime && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Cancel Workspace Subscription</h3>
          <p className="text-[12px] mb-4" style={{ color: 'var(--text-secondary)' }}>
            All workspace members will keep access until the end of the current billing period.
          </p>
          <button onClick={handleCancel} disabled={cancelling}
            className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50">
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Cancel subscription
          </button>
        </div>
      )}
    </div>
  );
}
