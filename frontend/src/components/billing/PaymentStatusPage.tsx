'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { renderRich, useI18n, useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/useAuthStore';

type PaymentMode = 'success' | 'pending' | 'failed';
type SubscriptionSnapshot = {
  status: string;
  plan: string;
  planName: string;
};

// Plan names are product names and read the same in every language.
const planNames: Record<string, string> = { starter: 'Starter', pro: 'Pro' };

export function PaymentStatusPage({ mode }: { mode: PaymentMode }) {
  const params = useSearchParams();
  const expectedPlan = params.get('plan') ?? '';
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const t = useT('billing');
  const { lang, tOptional } = useI18n();

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/subscription/status');
      if (!response.data?.success || !response.data.subscription) {
        throw new Error(response.data?.message || t('payment.errors.notReturned'));
      }
      const snapshot = response.data.subscription as SubscriptionSnapshot;
      setSubscription(snapshot);
      if (
        ['active', 'lifetime'].includes(snapshot.status) &&
        (!expectedPlan || snapshot.plan === expectedPlan)
      ) {
        await fetchCurrentUser();
      }
    } catch (requestError: unknown) {
      const fallback = t('payment.errors.unreadable');
      const message = (requestError as { isAxiosError?: boolean } | null)?.isAxiosError
        ? describeApiError(requestError, fallback).message
        : requestError instanceof Error ? requestError.message : '';
      setError(message || fallback);
      setSubscription(null);
    } finally {
      setAttempt((current) => current + 1);
      setLoading(false);
    }
  }, [expectedPlan, fetchCurrentUser, t]);

  const active = !!subscription &&
    ['active', 'lifetime'].includes(subscription.status) &&
    (!expectedPlan || subscription.plan === expectedPlan);
  const isPastDue = subscription?.status === 'past_due';

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (mode === 'failed' || loading || active || attempt >= 8) return;
    const timer = window.setTimeout(() => void refreshStatus(), 2500);
    return () => window.clearTimeout(timer);
  }, [active, attempt, loading, mode, refreshStatus]);

  const title = loading
    ? t('payment.titles.checking')
    : error
      ? t('payment.titles.unavailable')
      : mode === 'success'
        ? active ? t('payment.titles.active') : t('payment.titles.notConfirmed')
        : mode === 'pending'
          ? active ? t('payment.titles.active') : t('payment.titles.updateNotConfirmed')
          : isPastDue ? t('payment.titles.needsAttention') : t('payment.titles.paymentNotConfirmed');
  const message = error
    ? error
    : mode === 'failed' && !isPastDue
      ? t('payment.messages.noFailedState')
      : active
        ? t('payment.messages.confirmedActive', { plan: subscription.planName || planNames[subscription.plan] || subscription.plan })
        : mode === 'failed'
          ? t('payment.messages.pastDue')
          : expectedPlan
            ? t('payment.messages.notConfirmedPlan', { plan: planNames[expectedPlan] || expectedPlan })
            : t('payment.messages.notConfirmedAny');
  // English shows the status exactly as the API sends it; other languages show its label.
  const statusLabel = (status: string) =>
    lang === 'en' ? status : tOptional(`billing.statusNames.${status}`) ?? status;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <div className={`mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full ${
            active ? 'bg-emerald-50 text-emerald-600' : isPastDue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {loading
              ? <Loader2 className="h-7 w-7 animate-spin" />
              : active
                ? <CheckCircle2 className="h-7 w-7" />
                : isPastDue
                  ? <AlertCircle className="h-7 w-7" />
                  : <Clock3 className="h-7 w-7" />}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">{t('payment.eyebrow')}</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">{message}</p>
          {subscription && (
            <p className="mt-4 text-xs text-slate-500">
              {renderRich(
                t('payment.currentState', { status: statusLabel(subscription.status), plan: subscription.planName || subscription.plan }),
                {
                  status: (chunk) => <span className="font-semibold capitalize">{chunk}</span>,
                  plan: (chunk) => <span className="font-semibold">{chunk}</span>,
                },
              )}
            </p>
          )}
          {!active && !isPastDue && !error && !loading && mode !== 'failed' && attempt < 8 && (
            <p className="mt-2 text-xs text-slate-500">{t('payment.autoCheck')}</p>
          )}
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => void refreshStatus()} disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {t('payment.refresh')}
            </button>
            <Link href="/billing" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
              {t('payment.openBilling')} <ArrowRight className="rtl-mirror h-4 w-4" />
            </Link>
          </div>
          {attempt >= 8 && !active && mode !== 'failed' && (
            <p className="mt-5 text-xs text-slate-500">{t('payment.unconfirmed')}</p>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
