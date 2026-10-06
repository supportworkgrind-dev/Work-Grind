'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { Zap, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

/**
 * TrialBanner
 * Shows in the dashboard whenever the workspace subscription (canonical
 * state from /subscription/status) is:
 *   - trialing (with days countdown)
 *   - trial expiring soon (≤ 2 days)
 *   - access blocked (expired / cancelled-ended / unpaid / paused / incomplete)
 *
 * Dismissible for "trialing" state only (not for expired).
 */
export function TrialBanner() {
  const { subscription, trialDaysRemaining } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  // Canonical workspace subscription state from /subscription/status —
  // never the legacy per-user field, which can contradict the company state.
  const status = subscription?.status;

  // Nothing to show until the canonical state is loaded, or for states that
  // need no banner (active paid, lifetime, or genuinely never subscribed).
  if (!subscription || !status) return null;
  if (status === 'active' || status === 'lifetime' || status === 'none' || status === 'no_plan' || status === 'never_subscribed') return null;
  if (dismissed && status === 'trialing') return null;

  /* ── Access blocked: expired / cancelled-ended / unpaid / paused / incomplete ── */
  if (status !== 'trialing' && !subscription.hasActiveAccess) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-300/40 bg-rose-50 px-4 py-3 mb-6"
        role="alert"
      >
        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
        <p className="flex-1 text-[13px] font-semibold text-rose-700">
          {status === 'cancelled' ? 'Your subscription has been cancelled.' : 'Your subscription has expired.'}
          {' '}Premium features are currently disabled.
        </p>
        <Link href="/billing"
          className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors shrink-0">
          Resubscribe
        </Link>
      </div>
    );
  }

  /* ── Active access without a banner state (past_due grace, cancelled-but-active) ── */
  if (status !== 'trialing') return null;

  /* ── Trial expiring soon (≤ 2 days) ── */
  if (status === 'trialing' && trialDaysRemaining != null && trialDaysRemaining <= 2) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 mb-6"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="flex-1 text-[13px] font-semibold text-amber-800">
          {trialDaysRemaining === 0
            ? 'Your free trial ends today!'
            : `Your free trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}!`}
          {' '}Choose a plan to keep your access.
        </p>
        <Link href="/billing"
          className="rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors shrink-0">
          Choose a plan
        </Link>
        <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* ── Active trial ── */
  if (status === 'trialing') {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 mb-6"
        style={{
          borderColor: 'rgba(99,102,241,0.25)',
          background:  'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(59,130,246,0.05) 100%)',
        }}
        role="status"
      >
        <Zap className="h-4 w-4 text-indigo-500 shrink-0" />
        <p className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
            7-day free trial active.
          </span>
          {trialDaysRemaining != null && ` ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} remaining.`}
          {' '}
          <Link href="/billing" className="underline font-semibold" style={{ color: 'var(--accent)' }}>
            Choose a plan
          </Link>
        </p>
        <button onClick={() => setDismissed(true)} className="opacity-40 hover:opacity-70 transition-opacity" aria-label="Dismiss">
          <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    );
  }

  return null;
}
