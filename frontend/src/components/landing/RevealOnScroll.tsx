'use client';

import type { ReactNode } from 'react';
import { useInView } from '@/lib/useInView';

export function RevealOnScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [ref, visible] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className={`${visible ? 'scroll-reveal scroll-reveal--visible' : 'scroll-reveal'} ${className}`}>
      {children}
    </div>
  );
}