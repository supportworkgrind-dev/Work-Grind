'use client';

import { getInitials } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Status = 'online' | 'away' | 'busy' | 'offline';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: Size;
  status?: Status;
  shape?: 'rounded' | 'circle';
  className?: string;
}

const sizeMap: Record<Size, { outer: string; text: string; dot: string; rounded: string }> = {
  xs: { outer: 'h-6  w-6',  text: 'text-[9px]',  dot: 'h-2   w-2   -bottom-0.5 -right-0.5', rounded: 'rounded-lg' },
  sm: { outer: 'h-7  w-7',  text: 'text-[10px]', dot: 'h-2   w-2   -bottom-0.5 -right-0.5', rounded: 'rounded-lg' },
  md: { outer: 'h-9  w-9',  text: 'text-xs',     dot: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5', rounded: 'rounded-xl' },
  lg: { outer: 'h-11 w-11', text: 'text-sm',     dot: 'h-3   w-3   -bottom-0.5 -right-0.5', rounded: 'rounded-xl' },
  xl: { outer: 'h-14 w-14', text: 'text-base',   dot: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5', rounded: 'rounded-2xl' },
};

const statusColorMap: Record<Status, string> = {
  online:  'bg-emerald-500',
  away:    'bg-amber-400',
  busy:    'bg-rose-500',
  offline: 'bg-slate-300',
};

export function Avatar({ name = '', src, size = 'md', status, shape = 'rounded', className = '' }: AvatarProps) {
  const s = sizeMap[size];
  const shapeClass = shape === 'circle' ? 'rounded-full' : s.rounded;

  return (
    <div className={`relative shrink-0 ${s.outer} ${className}`}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden font-semibold select-none ${shapeClass}`}
        style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className={s.text}>{getInitials(name || '?')}</span>
        )}
      </div>

      {status && (
        <span
          className={`absolute ${s.dot} rounded-full ring-2 ring-white ${statusColorMap[status]}`}
          title={status}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
