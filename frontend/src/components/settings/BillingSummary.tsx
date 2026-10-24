'use client';

import Link from 'next/link';
import { AlertCircle, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { formatBytes, formatDate } from '@/lib/utils';
import { useI18n, useT, type Translator } from '@/lib/i18n';

function usageRow(
  t: Translator<'billing'>,
  label: string,
  used: number,
  limit: number | undefined,
  format: (value: number) => string = String,
) {
  const bounded = typeof limit === 'number' && Number.isFinite(limit) && limit > 0;
  const percent = bounded ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div key={label}>
      <div className="flex justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span>{bounded ? t('summary.usage.of', { used: format(used), limit: format(limit) }) : format(used)}</span>
      </div>
      {percent !== null && (
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${percent >= 90 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * Read-only plan summary from GET /subscription/status (the trusted billing
 * record). Plan changes, checkout, and cancellation stay on the Billing page.
 */
export function BillingSummary() {
  const subscription = useAuthStore((state) => state.subscription);
  const loading = useAuthStore((state) => state.subscriptionLoading);
  const error = useAuthStore((state) => state.subscriptionError);
  const refreshSubscription = useAuthStore((state) => state.refreshSubscription);
  const t = useT('billing');
  const tc = useT('common');
  const { tOptional } = useI18n();

  if (!subscription) {
    if (loading) return <p className="text-xs text-slate-400">{t('summary.loading')}</p>;
    return (
      <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
        <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error || t('summary.unavailable')}</span>
        <button type="button" onClick={() => void refreshSubscription()} className="font-semibold underline">{tc('actions.retry')}</button>
      </div>
    );
  }

  const { usage, limits } = subscription;
  const endDate = subscription.subscriptionEndDate ? formatDate(subscription.subscriptionEndDate) : '';
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">{t('summary.currentPlan')}</span>
          <h4 className="mt-0.5 text-xl font-extrabold text-slate-900">{subscription.planName}</h4>
          <p className="mt-1 text-xs text-slate-500">
            {subscription.priceDisplay}
            {subscription.status === 'trialing' && subscription.trialDaysRemaining !== null
              ? ` · ${t('summary.trialDaysLeft', { count: subscription.trialDaysRemaining })}`
              : ''}
            {subscription.subscriptionEndDate && !subscription.isLifetime
              ? ` · ${subscription.cancelAtPeriodEnd ? t('summary.ends', { date: endDate }) : t('summary.renews', { date: endDate })}`
              : ''}
            {subscription.isLifetime ? ` · ${t('summary.lifetime')}` : ''}
          </p>
        </div>
        <span className={`self-start rounded-xl px-3 py-1.5 text-xs font-bold ${subscription.hasActiveAccess ? 'bg-indigo-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
          {tOptional(`billing.summary.status.${subscription.status}`) ?? subscription.status}
        </span>
      </div>

      <div className="space-y-4">
        {usageRow(t, t('summary.usage.members'), usage.memberSlotsUsed ?? usage.members, limits.members)}
        {typeof usage.students === 'number' && usageRow(t, t('summary.usage.students'), usage.students, limits.students)}
        {usageRow(t, t('summary.usage.storage'), usage.storageBytes, limits.storage, (value) => formatBytes(value))}
        {usageRow(t, t('summary.usage.aiRequests'), usage.aiRequests, limits.aiRequests)}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500">{t('summary.manageHint')}</p>
        <Link href="/billing" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-semibold text-white hover:bg-indigo-500">
          <CreditCard className="h-3.5 w-3.5" />{t('summary.manage')}
        </Link>
      </div>
    </div>
  );
}
