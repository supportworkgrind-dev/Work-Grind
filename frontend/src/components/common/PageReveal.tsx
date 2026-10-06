'use client';

/**
 * PageReveal — SSR-safe page and section reveal system.
 *
 * DESIGN:
 *   - CSS-only animation: opacity 0→1 + translateY(10px)→0
 *   - Staggered children via --reveal-delay CSS custom property
 *   - Zero JavaScript timers — no fake delays
 *   - prefers-reduced-motion: skips all transforms/opacity animations
 *   - No hydration mismatch: initial render is visible (opacity:1, no JS needed)
 *     The animation plays purely via CSS on mount, not via a mounted-state toggle.
 *
 * USAGE:
 *   // Page-level reveal (wraps entire page content)
 *   <PageReveal>
 *     <YourPageContent />
 *   </PageReveal>
 *
 *   // Staggered section reveal (each child animates with delay)
 *   <StaggerReveal>
 *     <Section1 />
 *     <Section2 />
 *     <Section3 />
 *   </StaggerReveal>
 *
 *   // Individual element reveal
 *   <RevealItem delay={1}>  {/* delay index 0–7 *}
 *     <Card />
 *   </RevealItem>
 */

import React from 'react';

interface PageRevealProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageReveal: wraps an entire page's content in a fast fade-in.
 * Duration: 300ms. Uses CSS animation class — no JS state toggle.
 */
export function PageReveal({ children, className = '' }: PageRevealProps) {
  return (
    <div className={`page-reveal ${className}`}>
      {children}
    </div>
  );
}

interface StaggerRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger step in ms between children (default 60ms) */
  step?: number;
}

/**
 * StaggerReveal: wraps a group of siblings and reveals them with a stagger.
 * Each direct child gets an incremental --reveal-delay variable.
 */
export function StaggerReveal({ children, className = '', step = 60 }: StaggerRevealProps) {
  const items = React.Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <div
          key={i}
          className="reveal-item"
          style={{ '--reveal-delay': `${i * step}ms` } as React.CSSProperties}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

interface RevealItemProps {
  children: React.ReactNode;
  className?: string;
  /** Delay index 0–7 (multiplied by 60ms internally) */
  delay?: number;
  /** Or provide exact ms delay */
  delayMs?: number;
}

/**
 * RevealItem: wraps a single element with a staggered reveal.
 */
export function RevealItem({ children, className = '', delay = 0, delayMs }: RevealItemProps) {
  const ms = delayMs !== undefined ? delayMs : delay * 60;
  return (
    <div
      className={`reveal-item ${className}`}
      style={{ '--reveal-delay': `${ms}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default PageReveal;
