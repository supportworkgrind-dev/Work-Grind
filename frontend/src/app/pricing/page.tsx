'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { PlanConfig } from '@/types';
import {
  CheckCircle2, XCircle, ArrowRight, Zap, Shield, Users,
  MessageSquare, Briefcase, Sparkles, Building2, Calendar,
  ChevronDown, ChevronUp, Loader2, Star,
} from 'lucide-react';

/* ── Plan card ─────────────────────────────────────────────────────────── */

function PricingCard({
  plan, authed, onSelect, loading,
}: {
  plan: PlanConfig;
  authed: boolean;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const isFree = plan.priceMonthly === 0;

  return (
    <div className={`relative flex flex-col rounded-3xl border p-7 transition-all duration-200
      ${plan.highlighted
        ? 'border-indigo-500 shadow-xl shadow-indigo-500/15 scale-[1.02]'
        : 'border-white/[0.08] hover:border-white/[0.15]'}
      bg-[#0d1117]`}
    >
      {plan.badgeLabel && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-[11px] font-bold text-white uppercase tracking-wider shadow-md">
          {plan.badgeLabel}
        </span>
      )}

      {/* Plan header */}
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          {plan.name}
        </p>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-4xl font-black text-white">
            {isFree ? 'Free' : `$${plan.priceMonthly / 100}`}
          </span>
          {!isFree && <span className="text-slate-400 text-sm">/month</span>}
        </div>
        {isFree && (
          <p className="text-[11px] font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 rounded-full px-2.5 py-0.5 inline-block">
            7-day free trial
          </p>
        )}
        <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">{plan.description}</p>
      </div>

      {/* CTA */}
      <div className="mb-6">
        {isFree ? (
          <Link
            href={authed ? '/billing' : '/signup'}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/[0.06] border border-white/[0.09] hover:bg-white/[0.10] text-white text-sm font-semibold py-3 transition-all"
          >
            {authed ? 'Manage Trial' : 'Start 7-Day Free Trial'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            onClick={() => onSelect(plan.id)}
            disabled={loading}
            className={`flex items-center justify-center gap-2 w-full rounded-xl text-white text-sm font-semibold py-3 transition-all
              ${plan.highlighted
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/25'
                : 'bg-white/[0.08] border border-white/[0.10] hover:bg-white/[0.12]'}
              disabled:opacity-60`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {authed ? `Upgrade to ${plan.name}` : `Get ${plan.name}`}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {plan.features.map((f) => (
          <li key={f.label}
            className={`flex items-center gap-2.5 text-[13px]
              ${f.included ? 'text-slate-200' : 'text-slate-600'}`}
          >
            {f.included
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              : <XCircle      className="h-4 w-4 text-slate-700  shrink-0" />
            }
            {f.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── FAQ item ──────────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'Does the free trial require a credit card?',
    a: 'No. Your 7-day free trial starts automatically when you create an account — no credit card required. You only need to add payment details when you choose a paid plan.',
  },
  {
    q: 'What happens when my trial expires?',
    a: 'After 7 days, workspace access requires an active paid subscription. Your workspace data is retained while access is restricted, and you can choose a paid plan from Billing to restore access.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Workspace owners and admins can start an upgrade from Billing through Polar checkout. A downgrade can be scheduled from Billing to take effect at the end of the current billing period.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'A workspace owner or admin can cancel an active subscription from Billing. Access remains through the current paid period. Cancellation does not itself issue a refund; see the Refund Policy and checkout terms.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Paid plan checkout and subscription events are handled through Polar. WorkGrind stores subscription state and provider identifiers needed to manage the workspace plan. Review the payment provider’s checkout information for payment-data handling details.',
  },
  {
    q: 'Can I get a refund?',
    a: 'WorkGrind does not provide an in-app refund workflow. Refund eligibility is subject to the checkout terms, the payment provider’s process, and applicable law. Read the Refund Policy for details.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.07]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-4 text-left text-[14px] font-semibold text-white hover:text-indigo-300 transition-colors"
      >
        {q}
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>
      {open && (
        <p className="pb-4 text-[13px] text-slate-400 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [plans,        setPlans]        = useState<PlanConfig[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [error,        setError]        = useState('');

  useEffect(() => {
    setMounted(true);

    (async () => {
      try {
        const res = await api.get('/subscription/plans');
        if (res.data.success) setPlans(res.data.plans);
      } catch { /* use empty */ }
      finally { setLoadingPlans(false); }
    })();
  }, []);

  const authReady = mounted && isAuthenticated;

  const handleSelect = async (planId: string) => {
    if (!isAuthenticated) {
      router.push(`/signup?plan=${planId}`);
      return;
    }
    setCheckoutPlan(planId); setError('');
    try {
      const res = await api.post('/subscription/checkout', { planId });
      if (res.data.success && res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setError(res.data.message || 'Failed to start checkout.');
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to start checkout. Please try again.');
    } finally { setCheckoutPlan(null); }
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-white">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-30 flex h-14 items-center justify-between px-6 border-b border-white/[0.06] bg-[#06080f]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 text-white font-bold text-lg tracking-tight">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-[11px] font-black">TF</div>
          WorkGrind
        </Link>
        <div className="flex items-center gap-3">
          {!mounted ? (
            <>
              <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-24 animate-pulse rounded-xl bg-indigo-500/20" />
            </>
          ) : authReady ? (
            <Link href="/dashboard" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
              Open Workspace
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm font-semibold transition-colors">
                Start free trial
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">

        {/* ── Hero ── */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-6">
            Simple, transparent pricing
          </span>
          <h1 className="text-[2.75rem] sm:text-5xl font-black tracking-tight leading-tight mb-4">
            Try it free for 7 days.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400">
              Scale when you're ready.
            </span>
          </h1>
          <p className="text-[15px] text-slate-400 max-w-xl mx-auto leading-relaxed">
            Every account starts with a full 7-day free trial with access to all features.
            Choose a paid plan before your trial ends to keep your access.
          </p>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="max-w-lg mx-auto mb-8 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <XCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {/* ── Plan cards ── */}
        {loadingPlans ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-20">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                authed={authReady}
                onSelect={handleSelect}
                loading={checkoutPlan === plan.id}
              />
            ))}
          </div>
        )}

        {/* ── Features strip ── */}
        <div className="rounded-3xl border border-white/[0.07] bg-[#0d1117] p-8 mb-20">
          <h2 className="text-lg font-bold text-center mb-8 text-white">Everything in one connected workspace</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { icon: Building2,    label: 'CRM & Pipeline',       desc: 'Contacts, companies, deals' },
              { icon: Users,        label: 'Team Management',       desc: 'Roles, workload, presence' },
              { icon: MessageSquare,label: 'Team Chat',             desc: 'Channels, DMs, threads' },
              { icon: Briefcase,    label: 'Projects & Tasks',      desc: 'Kanban, milestones, tracking' },
              { icon: Calendar,     label: 'Calendar & Meetings',   desc: 'Scheduling, video, notes' },
              { icon: Sparkles,     label: 'Tavro AI',               desc: 'Smart summaries & actions' },
              { icon: Shield,       label: 'Security & RBAC',       desc: 'Roles, audit logs, MFA' },
              { icon: Zap,          label: 'Real-time Updates',     desc: 'Live sync across your team' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <p className="text-[12px] font-bold text-white">{label}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8 text-white">Frequently asked questions</h2>
          <div className="divide-y divide-white/[0.07]">
            {FAQS.map((f) => <FaqItem key={f.q} {...f} />)}
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div className="mt-20 text-center">
          <p className="text-[13px] text-slate-500 mb-4">Still have questions?</p>
          <Link href="/contact"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Contact our team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
