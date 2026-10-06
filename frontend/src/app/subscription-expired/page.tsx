'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { ExpiredSubscriptionExperience } from '@/components/subscription/ExpiredSubscriptionExperience';
import { useAuthStore } from '@/store/useAuthStore';

export default function SubscriptionExpiredPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const subscription = useAuthStore((state) => state.subscription);
  const subscriptionLoading = useAuthStore((state) => state.subscriptionLoading);
  const subscriptionError = useAuthStore((state) => state.subscriptionError);
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const refreshSubscription = useAuthStore((state) => state.refreshSubscription);

  useEffect(() => {
    if (!user && isLoading) void fetchCurrentUser();
  }, [user, isLoading, fetchCurrentUser]);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user && !subscription) void refreshSubscription();
  }, [user, subscription, refreshSubscription]);

  useEffect(() => {
    if (subscription?.hasActiveAccess) router.replace('/tasks');
  }, [subscription, router]);

  if (isLoading || !user || subscriptionLoading || (!subscription && !subscriptionError)) {
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
    ? 'Payment needs attention'
    : subscription?.status === 'paused'
      ? 'Your subscription is paused'
      : subscription?.status === 'incomplete'
        ? 'Complete your subscription'
        : 'Your WorkGrind subscription has ended';
  const heading = subscriptionError
    ? 'Unable to verify your subscription'
    : neverSubscribed
      ? 'Choose a WorkGrind plan to get started'
      : inactiveTitle;
  const description = subscriptionError
    ? subscriptionError
    : neverSubscribed
      ? 'This workspace does not have a subscription yet. Choose a plan to access WorkGrind.'
      : expired || subscription?.status === 'cancelled'
        ? 'Your workspace data is safe. Renew your subscription to continue using WorkGrind.'
        : 'Your workspace data is safe. Resolve your billing status to restore WorkGrind access.';
  const primaryAction = neverSubscribed
    ? 'Choose a plan'
    : subscription?.status === 'unpaid' || subscription?.status === 'past_due'
      ? 'Resolve payment'
      : subscription?.status === 'paused'
        ? 'Resume subscription'
        : 'Renew subscription';

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
            {primaryAction} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/billing" className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold" style={{ borderColor: 'var(--wg-border)', color: 'var(--wg-text)' }}>
            View billing
          </Link>
        </div>
      </section>
    </main>
  );
}
