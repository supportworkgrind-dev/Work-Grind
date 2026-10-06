import type { ReactNode } from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}

export function LegalDocumentPage({ document, children }: { document: LegalDocument; children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <header className="mb-8 border-b border-slate-100 pb-6">
            <Link href="/" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              WorkGrind
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{document.summary}</p>
            <p className="mt-4 text-xs text-slate-500">Last updated: {document.updated}</p>
          </header>

          <div className="space-y-7 text-sm leading-7 text-slate-600">
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-2 text-lg font-bold leading-6 text-slate-900">{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph} className="mb-2 last:mb-0">{paragraph}</p>)}
                {section.bullets && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {section.bullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {children}

          <div className="mt-9 border-t border-slate-100 pt-5 text-sm text-slate-600">
            Questions about this document? Use the WorkGrind <Link href="/contact" className="font-semibold text-indigo-600 hover:underline">contact form</Link>.
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
