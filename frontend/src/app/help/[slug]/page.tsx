import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp, ListChecks, Stethoscope } from 'lucide-react';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { HELP_ARTICLES } from '@/lib/helpArticles';
import { HelpDestinationLink } from './HelpDestinationLink';

export function generateStaticParams() {
  return HELP_ARTICLES.map(({ slug }) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = HELP_ARTICLES.find((item) => item.slug === slug);
  if (!article) return { title: 'Help article not found | WorkGrind' };
  return {
    title: `${article.title} | WorkGrind Help`,
    description: article.summary,
    openGraph: { title: `${article.title} | WorkGrind Help`, description: article.summary, url: `/help/${article.slug}` },
  };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = HELP_ARTICLES.find((item) => item.slug === slug);
  if (!article) notFound();

  const related = HELP_ARTICLES
    .filter((item) => item.slug !== article.slug && (item.category === article.category || item.audiences.some((audience) => article.audiences.includes(audience))))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-7 text-sm text-slate-500">
          <Link href="/" className="hover:text-indigo-700">Home</Link><span className="px-2">/</span>
          <Link href="/help" className="hover:text-indigo-700">Help Center</Link><span className="px-2">/</span>
          <span aria-current="page" className="text-slate-700">{article.title}</span>
        </nav>

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 bg-gradient-to-br from-white to-indigo-50/70 p-6 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">{article.category}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">{article.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{article.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Relevant workspace types">
              {article.audiences.map((audience) => <span key={audience} className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-medium text-indigo-800">{audience}</span>)}
            </div>
          </header>

          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div className="space-y-8">
              <section aria-labelledby="symptoms-heading">
                <h2 id="symptoms-heading" className="flex items-center gap-2 text-lg font-bold"><Stethoscope className="h-5 w-5 text-indigo-600" />Symptoms</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{article.symptoms.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section aria-labelledby="causes-heading">
                <h2 id="causes-heading" className="flex items-center gap-2 text-lg font-bold"><CircleHelp className="h-5 w-5 text-indigo-600" />Likely causes</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{article.causes.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section aria-labelledby="steps-heading">
                <h2 id="steps-heading" className="flex items-center gap-2 text-lg font-bold"><ListChecks className="h-5 w-5 text-indigo-600" />Steps to try</h2>
                <ol className="mt-4 space-y-3">
                  {article.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" aria-labelledby="verify-heading">
                <h2 id="verify-heading" className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle2 className="h-5 w-5" />Verify the fix</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-900/80">{article.verify}</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="contact-heading">
                <h2 id="contact-heading" className="font-bold">When to contact support</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{article.contact}</p>
                <Link href="/contact?subject=Technical%20Support" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Contact WorkGrind support <ArrowRight className="h-4 w-4" /></Link>
              </section>
            </div>

            <aside className="space-y-6 lg:border-l lg:border-slate-100 lg:pl-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Related guides</h2>
                <ul className="mt-3 space-y-3">
                  {related.map((item) => <li key={item.slug}><Link href={`/help/${item.slug}`} className="group flex items-start gap-2 text-sm font-semibold text-slate-700 hover:text-indigo-700"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />{item.title}</Link></li>)}
                </ul>
              </div>
              {article.appPath && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <h2 className="text-sm font-bold">Open this area</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600">This application destination requires sign-in and may require an authorized workspace role.</p>
                  <HelpDestinationLink path={article.appPath} />
                </div>
              )}
              <Link href="/help" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-700"><ArrowLeft className="h-4 w-4" />All help guides</Link>
            </aside>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
