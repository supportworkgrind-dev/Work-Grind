'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BookOpen, KeyRound } from 'lucide-react';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';

export function DeveloperShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="theme-scope theme-bg-base min-h-screen">
      <header className="sticky top-0 z-40 border-b theme-border theme-bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link href="/dashboard" aria-label="WorkGrind dashboard">
              <ThemeAwareLogo size="sm" surface="auto" />
            </Link>
            <span className="hidden h-8 w-px bg-[var(--border-color)] sm:block" aria-hidden="true" />
            <nav aria-label="Developer section" className="flex h-16 items-center gap-1">
              <Link
                href="/developer"
                aria-current={pathname === '/developer' ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                  pathname === '/developer' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'theme-text-secondary hover:theme-bg-hover'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>API Keys</span>
              </Link>
              <Link
                href="/developer/docs"
                aria-current={pathname === '/developer/docs' ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                  pathname === '/developer/docs' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'theme-text-secondary hover:theme-bg-hover'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>API Docs</span>
              </Link>
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border theme-border px-3 text-sm font-semibold theme-text-secondary hover:theme-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Workspace</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
