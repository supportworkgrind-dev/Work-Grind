import type { ReactNode } from 'react';

export type AnimatedAppArtProps = {
  className?: string;
  title?: string;
  children?: ReactNode;
};

export function AnimatedAppArt({ className, title, children }: AnimatedAppArtProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="animated-app-art-gradient" x1="8" x2="56" y1="8" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export const animatedAppArtMap = {} as const;
