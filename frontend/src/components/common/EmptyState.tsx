'use client';

import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateAction {
  label:   string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon:          LucideIcon;
  title:         string;
  description:   string;
  /** Legacy single-action props */
  actionLabel?:  string;
  onAction?:     () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?:    () => void;
  /** Array-style actions (used by newer pages) */
  actions?:      EmptyStateAction[];
  className?:    string;
  compact?:      boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  actions,
  className = '',
  compact = false,
}: EmptyStateProps) {
  // Normalise both prop styles into one list
  const allActions: EmptyStateAction[] = [
    ...(actions ?? []),
    ...(actionLabel && onAction ? [{ label: actionLabel, onClick: onAction }] : []),
    ...(secondaryActionLabel && onSecondaryAction ? [{ label: secondaryActionLabel, onClick: onSecondaryAction }] : []),
  ];
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-colors
        ${compact ? 'p-8' : 'p-10 sm:p-14'}
        ${className}`}
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-base)' }}
    >
      {/* Icon badge */}
      <div
        className="relative mb-5 flex items-center justify-center rounded-2xl"
        style={{
          height: compact ? '3rem' : '3.5rem',
          width:  compact ? '3rem' : '3.5rem',
          background: 'var(--accent-subtle)',
          color:      'var(--accent-text)',
          boxShadow:  '0 0 0 8px var(--accent-subtle)',
        }}
      >
        <Icon
          className="stroke-[1.5]"
          style={{ height: compact ? '1.5rem' : '1.75rem', width: compact ? '1.5rem' : '1.75rem' }}
        />
      </div>

      <h3
        className={`font-bold ${compact ? 'text-sm' : 'text-sm sm:text-base'} mb-1.5`}
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      <p
        className={`leading-relaxed max-w-sm ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </p>

      {allActions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {allActions.map(({ label, onClick }, i) => (
            <button
              key={i}
              onClick={onClick}
              className={i === 0 ? 'btn-primary' : 'btn-secondary'}
              aria-label={label}
            >
              {i === 0 && <Plus className="h-3.5 w-3.5" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
