'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { EducationPlanPricing, PlanConfig } from '@/types';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { getEducationPlanType, normalizeOrganizationType } from '@/lib/organizationAccess';

type DisplayPlan = {
  id: string;
  name: string;
  priceDisplay: string;
  description: string;
  highlighted: boolean;
  badgeLabel?: string;
  features: string[];
  checkoutError?: string;
};

type ApiErrorShape = { response?: { data?: { message?: string } } };

const ORGANIZATION_LABELS = { school: 'School', college: 'College', university: 'University' } as const;

export function ExpiredSubscriptionExperience({ showPlans = false }: { showPlans?: boolean }) {
  const subscription = useAuthStore((state) => state.subscription);
  const company = useAuthStore((state) => state.company);
  const user = useAuthStore((state) => state.user);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [educationPlans, setEducationPlans] = useState<EducationPlanPricing[]>([]);
  const [plansLoading, setPlansLoading] = useState(showPlans);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isOwnerAdmin = user?.role === 'owner' || user?.role === 'founder' || user?.role === 'admin';

  // The backend's stored organization type decides which Polar plans apply; never infer it from the name.
  const rawOrganizationType = subscription?.organizationType ?? company?.organizationType;
  const organizationType = normalizeOrganizationType(rawOrganizationType);
  const educationPlanType = getEducationPlanType(rawOrganizationType);

  useEffect(() => {
    if (!showPlans) return;

    let cancelled = false;
    api.get('/subscription/plans')
      .then((response) => {
        if (cancelled) return;
        if (response.data.success && Array.isArray(response.data.plans)) {
          setPlans(response.data.plans);
          setEducationPlans(Array.isArray(response.data.educationPlans) ? response.data.educationPlans : []);
          return;
        }
        setError(response.data.message || 'Could not load available plans. Please refresh and try again.');
      })
      .catch((loadError: unknown) => {
        console.error('Failed to load plans for expired subscription:', loadError);
        if (!cancelled) setError('Could not load available plans. Please refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showPlans]);

  const selectPlan = async (planId: string) => {
    setCheckoutPlan(planId);
    setError('');
    try {
      const response = await api.post('/subscription/checkout', { planId });
      if (response.data.success && response.data.checkoutUrl) {
        window.location.assign(response.data.checkoutUrl);
        return;
      }
      setError(response.data.message || 'Could not start checkout. Please try again.');
    } catch (checkoutError: unknown) {
      console.error('Failed to start subscription checkout:', checkoutError);
      setError((checkoutError as ApiErrorShape).response?.data?.message || 'Could not start checkout. Please try again.');
    } finally {
      setCheckoutPlan(null);
    }
  };

  const allowedPlanIds = subscription?.availablePlanIds;
  const isAllowed = (planId: string) => !allowedPlanIds || allowedPlanIds.some((id) => id === planId);
  let planUnavailableMessage = '';
  let displayPlans: DisplayPlan[] = [];
  if (!organizationType) {
    planUnavailableMessage = 'This workspace’s organization type is not recognized, so no plan can be matched. Please contact support.';
  } else if (educationPlanType) {
    const plan = educationPlans.find((candidate) => candidate.id === educationPlanType);
    if (!plan || !isAllowed(plan.id)) {
      planUnavailableMessage = `${ORGANIZATION_LABELS[educationPlanType]} plan pricing could not be loaded for this workspace. Refresh the page or contact support.`;
    } else {
      displayPlans = [{
        id: plan.id,
        name: plan.name,
        priceDisplay: plan.priceDisplay,
        description: plan.description,
        highlighted: true,
        features: [
          `Up to ${plan.limits.students.toLocaleString()} active students`,
          `Up to ${plan.limits.members.toLocaleString()} active staff and members`,
          `Up to ${plan.limits.pendingInvites.toLocaleString()} pending invitations`,
          'All WorkGrind workspace features',
        ],
        checkoutError: plan.checkoutAvailable
          ? undefined
          : plan.checkoutError || 'Checkout is not configured for this education plan.',
      }];
    }
  } else {
    displayPlans = plans
      .filter((plan) => (plan.id === 'starter' || plan.id === 'pro') && isAllowed(plan.id))
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceDisplay: plan.priceDisplay,
        description: plan.description,
        highlighted: plan.highlighted,
        badgeLabel: plan.badgeLabel,
        features: plan.features.filter((feature) => feature.included).slice(0, 4).map((feature) => feature.label),
      }));
  }

  const plansHref = showPlans ? '#expired-plans' : '/billing#expired-plans';
  const planName = subscription?.planName ||
    (educationPlanType
      ? `WorkGrind ${ORGANIZATION_LABELS[educationPlanType]}`
      : subscription?.plan === 'free' ? 'Free Trial' : subscription?.plan === 'pro' ? 'Pro' : 'Starter');
  const endDate = subscription?.subscriptionEndDate ?? subscription?.trialEndDate;

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10"
      style={{ background: 'var(--wg-bg, #f5f2e9)' }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
        <Link href="/billing" aria-label="WorkGrind billing" className="mb-8 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          <ThemeAwareLogo size="md" surface="light" />
        </Link>

        <section className="w-full max-w-2xl rounded-3xl border p-6 text-center shadow-xl shadow-slate-900/5 sm:p-10"
          style={{ background: 'var(--wg-surface-elevated, #fff)', borderColor: 'var(--wg-border)' }}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--wg-theme-accent) 12%, transparent)', color: 'var(--wg-theme-accent)' }}>
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--wg-theme-accent)' }}>
            Workspace access
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: 'var(--wg-text)' }}>
            Your WorkGrind subscription has ended
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 sm:text-base" style={{ color: 'var(--wg-text-secondary)' }}>
            Your workspace data is safe. Renew your subscription to continue using WorkGrind.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={plansHref}
              className="theme-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">
              Renew subscription <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={showPlans ? '/billing#expired-plans' : '/billing'}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold"
              style={{ borderColor: 'var(--wg-border)', color: 'var(--wg-text)' }}>
              View billing
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border p-5 text-left sm:p-6"
            style={{ borderColor: 'var(--wg-border)', background: 'color-mix(in srgb, var(--wg-bg, #f5f2e9) 55%, white)' }}>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--wg-text-muted)' }}>
              {company?.name || 'WorkGrind workspace'}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              <div>
                <dt className="text-xs" style={{ color: 'var(--wg-text-secondary)' }}>Plan</dt>
                <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--wg-text)' }}>{planName}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--wg-text-secondary)' }}>Status</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: '#be123c' }}>
                  <span className="h-2 w-2 rounded-full bg-rose-500" />Expired
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--wg-text-secondary)' }}>Price</dt>
                <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--wg-text)' }}>
                  {subscription?.priceDisplay || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--wg-text-secondary)' }}>End date</dt>
                <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--wg-text)' }}>
                  {endDate ? formatDate(endDate, 'MMM d, yyyy') : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {showPlans && (
          <section id="expired-plans" className="w-full scroll-mt-6 py-8 sm:py-10" aria-labelledby="expired-plans-heading">
            <div className="mb-5 text-center">
              <h2 id="expired-plans-heading" className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: 'var(--wg-text)' }}>
                Choose a plan to restore your workspace
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--wg-text-secondary)' }}>
                Your data is ready when you are.
              </p>
            </div>
            {error && (
              <p role="alert" className="mx-auto mb-4 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}
            {plansLoading ? (
              <div className="flex justify-center py-8" aria-label="Loading plans">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--wg-theme-accent)' }} />
              </div>
            ) : planUnavailableMessage ? (
              !error && (
                <p role="alert" className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
                  {planUnavailableMessage}
                </p>
              )
            ) : displayPlans.length > 0 ? (
              <div className={displayPlans.length === 1 ? 'mx-auto grid w-full max-w-md grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4 md:grid-cols-2'}>
                {displayPlans.map((plan) => (
                  <article key={plan.id} className="flex flex-col rounded-2xl border p-5 shadow-sm sm:p-6"
                    style={{ background: 'var(--wg-surface-elevated, #fff)', borderColor: plan.highlighted ? 'var(--wg-theme-accent)' : 'var(--wg-border)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--wg-text-secondary)' }}>{plan.name}</p>
                        <p className="mt-2 text-3xl font-black tracking-tight" style={{ color: 'var(--wg-text)' }}>{plan.priceDisplay}</p>
                      </div>
                      {plan.highlighted && (
                        <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: 'color-mix(in srgb, var(--wg-theme-accent) 12%, transparent)', color: 'var(--wg-theme-accent)' }}>
                          {plan.badgeLabel || 'Popular'}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-5" style={{ color: 'var(--wg-text-secondary)' }}>{plan.description}</p>
                    <ul className="mt-5 flex-1 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: 'var(--wg-text-secondary)' }}>
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.checkoutError ? (
                      <p role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                        {plan.checkoutError}
                      </p>
                    ) : isOwnerAdmin ? (
                      <button type="button" onClick={() => void selectPlan(plan.id)} disabled={checkoutPlan !== null}
                        className="theme-primary-action mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                        {checkoutPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {checkoutPlan === plan.id ? 'Starting checkout…' : `Choose ${plan.name}`}
                      </button>
                    ) : (
                      <p className="mt-6 text-center text-sm font-medium" style={{ color: 'var(--wg-text-secondary)' }}>
                        Contact your workspace admin to renew.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              !error && <p className="py-8 text-center text-sm" style={{ color: 'var(--wg-text-secondary)' }}>No paid plans are currently available.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
