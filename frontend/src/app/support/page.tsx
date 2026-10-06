import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { ArrowRight, LifeBuoy } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Support | WorkGrind',
  description: 'Contact WorkGrind using the in-app support request form.',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            <LifeBuoy className="h-3.5 w-3.5" /> WorkGrind Support
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">How can we help?</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Submit a support request through the WorkGrind contact form. Include the page or feature involved and a description of the issue; do not include passwords, access tokens, or full payment-card details.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/contact?subject=Technical%20Support" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/help" className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Browse the Help Center
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
