import { type LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label:     string;
  value:     string | number;
  sub?:      string;
  icon:      LucideIcon;
  /** Legacy visual props retained for existing call sites; the shared theme owns their appearance. */
  iconBg?:   string;
  iconColor?: string;
  trend?:    { value: number; positive?: boolean };
  className?: string;
  /** Legacy visual prop retained for existing call sites; accents come from the shared theme. */
  accentColor?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  className = '',
}: StatCardProps) {
  return (
    <div className={`stat-card-premium ${className}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="stat-label mb-2 truncate">{label}</p>
          <p className="stat-value">{value}</p>

          {/* Trend + sub on same row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {sub && <span className="stat-sub">{sub}</span>}
            {trend !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                  trend.positive !== false && trend.value >= 0
                    ? 'text-emerald-600'
                    : 'text-rose-500'
                }`}
              >
                {trend.positive !== false && trend.value >= 0
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />
                }
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
        </div>

        {/* Icon tray */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border-l border-[var(--border-color)] pl-3 text-[var(--accent)]">
          <Icon className="h-[1.125rem] w-[1.125rem]" />
        </div>
      </div>
    </div>
  );
}
