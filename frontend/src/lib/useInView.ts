'use client';

/**
 * useInView — SSR-safe IntersectionObserver hook for scroll-reveal.
 *
 * RULES:
 *   - Returns false on server (no window), true after element enters viewport.
 *   - Once visible, stays visible (no re-hiding on scroll-out).
 *   - Cleans up observer on unmount.
 *   - Safe with Next.js SSR + hydration: initial server render has inView=false
 *     but the element is still visible via CSS (the animation just doesn't play
 *     until entry — the fallback is full visibility, not hidden).
 *
 * USAGE:
 *   const [ref, inView] = useInView();
 *   <div ref={ref} className={inView ? 'scroll-reveal scroll-reveal--visible' : 'scroll-reveal'}>
 *     ...
 *   </div>
 */

import { useRef, useState, useEffect, RefObject } from 'react';

interface UseInViewOptions {
  /** Fraction of element visible before triggering (default: 0.08) */
  threshold?: number;
  /** Root margin — negative pulls trigger point up (default: '0px 0px -40px 0px') */
  rootMargin?: string;
  /** Trigger once only (default: true) */
  triggerOnce?: boolean;
}

export function useInView<T extends Element = HTMLDivElement>(
  options: UseInViewOptions = {}
): [RefObject<T>, boolean] {
  const {
    threshold  = 0.08,
    rootMargin = '0px 0px -40px 0px',
    triggerOnce = true,
  } = options;

  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver not available in very old environments — degrade gracefully
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.disconnect();
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return [ref as RefObject<T>, inView];
}

export default useInView;
