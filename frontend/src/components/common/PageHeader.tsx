import { type LucideIcon } from 'lucide-react';
import { premiumIconClass } from '@/components/common/AppIcons';

interface PageHeaderProps {
  title:     string;
  subtitle?: string;
  icon?:     LucideIcon;
  /** Kept for existing call sites; the shared workspace palette now controls it. */
  iconColor?: string;
  /** Kept for existing call sites; header icons use the shared surface treatment. */
  iconBg?:    string;
  actions?:  React.ReactNode;
  badge?:    { label: string; color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' };
  className?: string;
  /** Kept for existing call sites; the shared workspace accent is used. */
  accentColor?: string;
  /** When true, wraps the header in the shared editorial header treatment. */
  hero?: boolean;
}

const badgeClasses: Record<string, string> = {
  indigo:  'badge badge-indigo',
  emerald: 'badge badge-emerald',
  amber:   'badge badge-amber',
  rose:    'badge badge-rose',
  blue:    'badge badge-blue',
  purple:  'badge badge-purple',
};

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  badge,
  className = '',
  hero = false,
}: PageHeaderProps) {
  const content = (
    <div className={`workspace-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${hero ? '' : className}`}>
      <div className="flex items-center gap-3 min-w-0">

        {Icon && (
          <div className="workspace-page-header-icon flex h-9 w-9 shrink-0 items-center justify-center">
            <Icon className={`${premiumIconClass} h-[1.125rem] w-[1.125rem]`} />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className={hero ? 'page-title-lg' : 'page-title'}>{title}</h1>
            {badge && (
              <span className={badgeClasses[badge.color ?? 'indigo']}>
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && <p className="page-subtitle mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );

  if (hero) {
    return (
      <div className={`page-hero ${className}`}>
        {content}
      </div>
    );
  }

  return content;
}
