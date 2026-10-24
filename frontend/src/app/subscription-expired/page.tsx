'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { ExpiredSubscriptionExperience } from '@/components/subscription/ExpiredSubscriptionExperience';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionRevalidation } from '@/lib/useSubscriptionRevalidation';
import { useT } from '@/lib/i18n';

export default function SubscriptionExpiredPage() {
  const t = useT('billing');
  const router = useRouter();
  const pathname = usePathname();
  const pendingRedirect = useRef<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const subscription = useAuthStore((state) => state.subscription);
  const subscriptionLoading = useAuthStore((state) => state.subscriptionLoading);
  const subscriptionError = useAuthStore((state) => state.subscriptionError);
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const refreshSubscription = useAuthStore((state) => state.refreshSubscription);
  const redirectOnce = useCallback((destination: string) => {
    if (pathname === destination || pendingRedirect.current === destination) return;
    pendingRedirect.current = destination;
    router.replace(destination);
  }, [pathname, router]);

  useEffect(() => {
    if (!user && isLoading) void fetchCurrentUser();
  }, [user, isLoading, fetchCurrentUser]);

  useEffect(() => {
    if (!isLoading && !user) redirectOnce('/login');
  }, [isLoading, user, redirectOnce]);

  useEffect(() => {
    if (user && !subscription) void refreshSubscription();
  }, [user, subscription, refreshSubscription]);

  useEffect(() => {
    if (subscription?.hasActiveAccess) redirectOnce('/tasks');
  }, [subscription, redirectOnce]);

  // Access restored elsewhere (an administrator grant, a payment in another
  // tab) is picked up here without the member reloading.
  useSubscriptionRevalidation(user?._id, subscription?.hasActiveAccess === true);

  // Background re-checks keep the current screen; only the first load shows the loader.
  if (isLoading || !user || (!subscription && (subscriptionLoading || !subscriptionError))) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: 'var(--wg-bg, #f5f2e9)' }}>
        <ThemeAwareLogo size="md" surface="light" />
      </main>
    );
  }
  if (subscription?.status === 'expired' && subscription.hasActiveAccess === false) {
    return <ExpiredSubscriptionExperience />;
  }
  const neverSubscribed = subscription?.status === 'never_subscribed' ||
    subscription?.status === 'no_plan' ||
    subscription?.status === 'none';
  const expired = subscription?.status === 'expired';
  const inactiveTitle = subscription?.status === 'unpaid'
    ? t('expiredPage.titles.unpaid')
    : subscription?.status === 'paused'
      ? t('expiredPage.titles.paused')
      : subscription?.status === 'incomplete'
        ? t('expiredPage.titles.incomplete')
        : t('expiredPage.titles.ended');
  const heading = subscriptionError
    ? t('expiredPage.titles.unverified')
    : neverSubscribed
      ? t('expiredPage.titles.neverSubscribed')
      : inactiveTitle;
  const description = subscriptionError
    ? subscriptionError
    : neverSubscribed
      ? t('expiredPage.descriptions.neverSubscribed')
      : expired || subscription?.status === 'cancelled'
        ? t('expiredPage.descriptions.renew')
        : t('expiredPage.descriptions.resolve');
  const primaryAction = neverSubscribed
    ? t('expiredPage.actions.choosePlan')
    : subscription?.status === 'unpaid' || subscription?.status === 'past_due'
      ? t('expiredPage.actions.resolvePayment')
      : subscription?.status === 'paused'
        ? t('expiredPage.actions.resume')
        : t('expiredPage.actions.renew');

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: 'var(--wg-bg, #f5f2e9)' }}>
      <section className="w-full max-w-lg rounded-3xl border p-8 text-center shadow-sm sm:p-10" style={{ background: 'var(--wg-surface-elevated, #fff)', borderColor: 'var(--wg-border)' }}>
        <div className="mb-8 flex justify-center">
          <ThemeAwareLogo size="md" surface="light" />
        </div>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'color-mix(in srgb, var(--wg-theme-accent) 12%, transparent)', color: 'var(--wg-theme-accent)' }}>
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight" style={{ color: 'var(--wg-text)' }}>
          {heading}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6" style={{ color: 'var(--wg-text-secondary)' }}>
          {description}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/billing" className="theme-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">
            {primaryAction} <ArrowRight className="rtl-mirror h-4 w-4" />
          </Link>
          <Link href="/billing" className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold" style={{ borderColor: 'var(--wg-border)', color: 'var(--wg-text)' }}>
            {t('expiredPage.actions.viewBilling')}
          </Link>
        </div>
      </section>
    </main>
  );
}
