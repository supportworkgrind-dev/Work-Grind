/**
 * WorkGrindLogo — "Upward W" brand mark
 *
 * DESIGN CONCEPT:
 *   A geometric W where the two inner peaks rise higher than the outer legs,
 *   forming an upward-flow shape that communicates:
 *     • W = Work / Workspace / team structure
 *     • Rising centre = Grind / progress / upward momentum
 *     • Connected strokes = collaboration / workflow
 *
 *   The left outer leg descends, the first valley rises, the centre peak
 *   is tallest (ambition), the second valley rises slightly less, and the
 *   right leg descends — all connected in one continuous stroke path.
 *
 * HYDRATION SAFETY:
 *   - No 'use client' — renders as a Server Component by default
 *   - No useId / useState / useEffect / window / Math.random
 *   - Logo colors come from semantic theme tokens
 *   - Safe to import from both Server and Client Components
 */

import React from 'react';

export type LogoSize  = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LogoTheme = 'light' | 'dark' | 'mono';

export interface WorkGrindLogoProps {
  size?:         LogoSize;
  showWordmark?: boolean;
  className?:    string;
  theme?:        LogoTheme | 'auto';
}

// ─── Size scales ──────────────────────────────────────────────────────────────
const ICON_PX:     Record<LogoSize, number> = { xs: 22, sm: 28, md: 36, lg: 48, xl: 64 };
const WORDMARK_PX: Record<LogoSize, number> = { xs: 11, sm: 14, md: 18, lg: 24, xl: 32 };
const GAP_PX:      Record<LogoSize, number> = { xs:  5, sm:  7, md:  9, lg: 11, xl: 15 };

// ─── WGMark: the W symbol ─────────────────────────────────────────────────────
//
// ViewBox 0 0 56 56. The W is drawn as a single polyline on a 56×56 grid.
//
// Points (x,y):
//   (4,46)   → left outer bottom
//   (15,16)  → left outer peak
//   (22,34)  → first valley
//   (28,8)   → centre peak  ← tallest point (the "Grind" rise)
//   (34,34)  → second valley
//   (41,16)  → right outer peak
//   (52,46)  → right outer bottom
//
// A small accent dot sits at the centre peak to draw the eye upward.
//
function WGMark({ px, theme }: { px: number; theme: LogoTheme | 'auto' }) {
  // Stroke weight scales with size for crispness at small sizes
  const sw = px <= 22 ? 3.8 : px <= 28 ? 3.4 : px <= 36 ? 3.0 : 2.6;
  // Accent dot radius
  const dr = px <= 22 ? 3.2 : px <= 28 ? 2.8 : 2.5;
  const markColor = theme === 'mono' ? 'currentColor' : 'var(--wg-logo-mark-color, currentColor)';
  const dotColor = theme === 'mono' ? 'currentColor' : 'var(--wg-logo-dot-color, currentColor)';

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* The W — single continuous polyline */}
      <polyline
        points="4,46 15,16 22,34 28,8 34,34 41,16 52,46"
        stroke={markColor}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Accent dot at centre peak — the "Grind" highlight */}
      <circle cx="28" cy="8" r={dr} fill={dotColor} />
    </svg>
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────
function WGWordmark({ size, theme }: { size: LogoSize; theme: LogoTheme | 'auto' }) {
  const px  = WORDMARK_PX[size];
  const wordColor = theme === 'mono'
    ? 'currentColor'
    : 'var(--wg-logo-word-color, currentColor)';
  const accentColor = theme === 'mono'
    ? 'currentColor'
    : 'var(--wg-logo-word-accent-color, currentColor)';

  return (
    <span
      aria-hidden="true"
      style={{
        display:    'inline-flex',
        alignItems: 'baseline',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        fontFamily: 'var(--font-plus-jakarta-sans)',
      }}
    >
      {/* "Work" — weight 700 */}
      <span style={{ fontSize: `${px}px`, fontWeight: 700, letterSpacing: '-0.03em', color: wordColor }}>
        Work
      </span>
      {/* "Grind" — weight 900, accent color */}
      <span style={{ fontSize: `${px}px`, fontWeight: 900, letterSpacing: '-0.04em', color: accentColor }}>
        Grind
      </span>
    </span>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function WorkGrindLogo({
  size         = 'md',
  showWordmark = true,
  className    = '',
  theme        = 'dark',
}: WorkGrindLogoProps) {
  return (
    <div
      className={`workgrind-logo logo-treatment-${theme} inline-flex items-center shrink-0 ${className}`}
      style={{ gap: `${GAP_PX[size]}px` }}
      role="img"
      aria-label="WorkGrind"
    >
      <WGMark px={ICON_PX[size]} theme={theme} />
      {showWordmark && <WGWordmark size={size} theme={theme} />}
    </div>
  );
}

export default WorkGrindLogo;
