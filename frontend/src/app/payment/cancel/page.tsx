import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { ArrowLeft, CreditCard, XCircle } from 'lucide-react';

export const metadata: Metadata = { title: 'Checkout Canceled | WorkGrind' };

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
            <XCircle className="h-7 w-7" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">WorkGrind Billing</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Checkout was not completed</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            This page does not determine whether a charge was made or whether a subscription changed. Review the current status on Billing before starting another checkout.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/billing" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
              <CreditCard className="h-4 w-4" />Review Billing
            </Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />Back to dashboard
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
