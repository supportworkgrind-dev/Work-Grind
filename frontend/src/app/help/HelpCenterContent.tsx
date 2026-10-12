'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { ArrowRight, BookOpen, Check, Copy, Search } from 'lucide-react';
import { HELP_ARTICLES, HELP_FAQS } from '@/lib/helpArticles';

const CATEGORIES = ['All guides', ...new Set(HELP_ARTICLES.map((article) => article.category))];
const POPULAR_SLUGS = ['getting-started', 'choose-the-right-workspace', 'roles-invitations-and-members', 'billing-and-subscriptions'];

export default function HelpCenterContent() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All guides');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return HELP_ARTICLES.filter((article) => {
      const inCategory = category === 'All guides' || article.category === category;
      if (!inCategory) return false;
      if (!normalized) return true;
      const searchable = [
        article.title,
        article.summary,
        article.category,
        ...article.audiences,
        ...article.keywords,
        ...article.symptoms,
        ...article.causes,
        ...article.steps,
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(normalized);
    });
  }, [category, query]);

  const copyReportInstructions = async () => {
    const report = [
      'WorkGrind error report',
      `Page URL: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
      'Error message: ',
      'Steps to reproduce:',
      '1. ',
      '2. ',
      'Expected result: ',
      'Actual result: ',
      '',
      'Do not include passwords, access tokens, verification codes, payment-card details, or private student/client records.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error('[Help Center] Could not copy the error report template.', error);
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-500">
          <Link href="/" className="hover:text-indigo-700">Home</Link><span className="px-2">/</span><span aria-current="page">Help Center</span>
        </nav>

        <header className="mb-8 rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50 p-6 shadow-sm sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            <BookOpen className="h-3.5 w-3.5" /> WorkGrind Help Center
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">How can we help?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Search practical setup and troubleshooting guides for Solo, Company, School / Academy, College, and University workspaces. Articles are public; application access still depends on sign-in and your permissions.
          </p>
          <label className="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Search help articles</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a feature, keyword, or error message…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              aria-label="Search help articles"
            />
            {query && <button type="button" onClick={() => setQuery('')} className="text-xs font-semibold text-indigo-700">Clear</button>}
          </label>
        </header>

        {!query && category === 'All guides' && (
          <section aria-labelledby="popular-heading" className="mb-8">
            <h2 id="popular-heading" className="mb-3 text-lg font-bold">Popular guides</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {POPULAR_SLUGS.map((slug) => {
                const article = HELP_ARTICLES.find((item) => item.slug === slug)!;
                return (
                  <Link key={slug} href={`/help/${slug}`} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
                    <span className="text-sm font-bold group-hover:text-indigo-700">{article.title}</span>
                    <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600">Read guide <ArrowRight className="h-3.5 w-3.5" /></span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="guides-heading">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 id="guides-heading" className="text-xl font-bold">Browse guides</h2>
              <p className="mt-1 text-sm text-slate-500" aria-live="polite">{results.length} {results.length === 1 ? 'guide' : 'guides'}{query ? ` matching “${query}”` : ''}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by category">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${category === item ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {results.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((article) => (
                <Link key={article.slug} href={`/help/${article.slug}`} className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">{article.category}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" aria-hidden="true" />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-slate-900 group-hover:text-indigo-700">{article.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-5 text-slate-600">{article.summary}</p>
                  <p className="mt-4 text-[11px] text-slate-500">{article.audiences.join(' · ')}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
              <p className="font-semibold">No guides found</p>
              <p className="mt-1 text-sm text-slate-500">Try another keyword or clear the category filter.</p>
              <button type="button" onClick={() => { setQuery(''); setCategory('All guides'); }} className="mt-4 text-sm font-semibold text-indigo-700">Clear search and filters</button>
            </div>
          )}
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h2 className="mb-3 text-xl font-bold">Frequently asked questions</h2>
            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">
              {HELP_FAQS.map((faq) => (
                <details key={faq.question} className="group py-4">
                  <summary className="cursor-pointer list-none pr-6 text-sm font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-3">{faq.question}<span className="text-lg text-indigo-600 transition group-open:rotate-45">+</span></span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <aside className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Still stuck?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Send support the page URL, exact error, browser, and steps to reproduce. Keep passwords, access tokens, payment details, and private records out of the report.</p>
            <button type="button" onClick={() => void copyReportInstructions()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Report template copied' : 'Copy error-report template'}
            </button>
            {copyFailed && (
              <div className="mt-3" role="alert">
                <p className="mb-2 text-xs text-amber-800">Clipboard access was unavailable. Copy this template manually:</p>
                <textarea readOnly value={`Page URL: ${typeof window === 'undefined' ? '' : window.location.href}\nError message:\nBrowser:\nSteps to reproduce:\n1.\n2.\nExpected result:\nActual result:\n\nDo not include passwords, access tokens, verification codes, payment-card details, or private student/client records.`} className="min-h-36 w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-700" aria-label="Error report template" />
              </div>
            )}
            <Link href="/contact?subject=Technical%20Support" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-slate-500">The public contact form does not require sign-in. For protected workspace actions, <Link href="/login?redirect=%2Fsupport" className="font-semibold text-indigo-700 hover:underline">sign in and return to support</Link>.</p>
          </aside>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
