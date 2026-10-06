/**
 * (app)/loading.tsx
 *
 * Next.js App Router automatically wraps page.tsx in a <Suspense> boundary
 * and shows this component while the page is loading (during navigation and
 * on first load). This eliminates the 2–3 second "stuck on old page" feeling.
 *
 * This file must be a SERVER component (no 'use client') so Next.js can
 * stream it immediately without waiting for client JS to hydrate.
 */

export default function AppLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[88rem] w-full mx-auto overflow-x-hidden animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-xl bg-[var(--bg-hover,#f1f5f9)]" />
          <div className="h-3.5 w-72 rounded-lg bg-[var(--bg-hover,#f1f5f9)]" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-[var(--bg-hover,#f1f5f9)]" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ background: 'var(--bg-card,#fff)', borderColor: 'var(--border-color,#e2e8f0)' }}
          >
            <div className="h-3 w-24 rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
            <div className="h-7 w-16 rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
            <div className="h-2.5 w-32 rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
          </div>
        ))}
      </div>

      {/* Content skeleton — 3-column card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ background: 'var(--bg-card,#fff)', borderColor: 'var(--border-color,#e2e8f0)' }}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl shrink-0 bg-[var(--bg-hover,#f1f5f9)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
                <div className="h-2.5 w-3/4 rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
              </div>
            </div>
            <div className="h-2.5 w-full rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
            <div className="h-2.5 w-4/5 rounded-md bg-[var(--bg-hover,#f1f5f9)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
