/**
 * LoadingSkeleton — reusable shimmer loading placeholders.
 * Use these instead of spinners wherever page content loads.
 */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 p-5 space-y-3 ${className}`}
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-9 w-9 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-3 w-1/2" />
          <SkeletonLine className="h-2.5 w-3/4" />
        </div>
      </div>
      <SkeletonLine className="h-2.5 w-full" />
      <SkeletonLine className="h-2.5 w-4/5" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const widths = [60, 80, 70, 90, 65, 75];
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
      <div className="border-b px-4 py-3 flex gap-4" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-base)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-2.5 rounded-md" style={{ width: `${widths[i % widths.length]}px` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b px-4 py-4 flex gap-4 items-center" style={{ borderColor: 'var(--border-subtle)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton-shimmer h-3 rounded-md" style={{ width: `${widths[(r + c) % widths.length]}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11', xl: 'h-14 w-14' }[size];
  return <div className={`skeleton-shimmer rounded-xl shrink-0 ${sz}`} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-3/4', 'w-2/3', 'w-5/6'];
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

/** Full-page skeleton for large data pages */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-3 w-72" />
        </div>
        <SkeletonLine className="h-9 w-28 rounded-xl" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="h-7 w-16" />
            <SkeletonLine className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      {/* Content cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
