'use client';

/**
 * AIStatusBadge
 *
 * A compact badge that shows whether the current AI response came from:
 *   • Local (on-device, Transformers.js)
 *   • Cloud (via WorkGrind backend — key stays server-side)
 *   • Fallback (rule-based, no AI model)
 *   • Processing (spinner while a request is in flight)
 *
 * Design:
 *   - Uses existing WorkGrind CSS variable design system (badge-* classes)
 *   - Respects prefers-reduced-motion
 *   - Zero dependencies outside lucide-react
 *   - Pure display component — no network calls
 *
 * USAGE:
 *   <AIStatusBadge provider="local"   feature="semantic_search" />
 *   <AIStatusBadge provider="gemini"  feature="ai_chat"         />
 *   <AIStatusBadge provider="loading" />
 *   <AIStatusBadge provider={null} />   ← renders nothing
 *
 * PRIVACY NOTE:
 *   This component only shows what provider category was used.
 *   It never renders API keys, model names, token counts, or prompt content.
 */

import { Zap, Cloud, Bot, RefreshCw, AlertTriangle } from 'lucide-react';

export type AIProvider = 'local' | 'gemini' | 'openai' | 'cloudflare' | 'fallback' | 'loading' | null;

interface AIStatusBadgeProps {
  /** Which provider handled the request. null = render nothing. */
  provider:   AIProvider;
  /** Optional feature label shown as a tooltip or small suffix. */
  feature?:   string;
  /** Size variant. Defaults to 'sm'. */
  size?:      'xs' | 'sm';
  /** Additional CSS classes */
  className?: string;
}

// ── Config per provider ───────────────────────────────────────────────────────

const CONFIG: Record<Exclude<AIProvider, null>, {
  label:   string;
  title:   string;
  Icon:    React.ComponentType<{ className?: string }>;
  badgeCls: string;
}> = {
  local: {
    label:    'Tavro AI',
    title:    'Tavro AI handled this response.',
    Icon:     Zap,
    badgeCls: 'badge badge-emerald',
  },
  gemini: {
    label:    'Tavro AI',
    title:    'Tavro AI handled this response.',
    Icon:     Cloud,
    badgeCls: 'badge badge-indigo',
  },
  openai: {
    label:    'Tavro AI',
    title:    'Tavro AI handled this response.',
    Icon:     Bot,
    badgeCls: 'badge badge-blue',
  },
  cloudflare: {
    label:    'Tavro AI',
    title:    'Tavro AI handled this response.',
    Icon:     Cloud,
    badgeCls: 'badge badge-indigo',
  },
  fallback: {
    label:    'Tavro AI',
    title:    'Tavro AI prepared this response using an alternate method.',
    Icon:     AlertTriangle,
    badgeCls: 'badge badge-amber',
  },
  loading: {
    label:    'Tavro AI thinking…',
    title:    'Tavro AI request is in progress.',
    Icon:     RefreshCw,
    badgeCls: 'badge badge-slate',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AIStatusBadge({ provider, feature, size = 'sm', className = '' }: AIStatusBadgeProps) {
  if (!provider) return null;

  const cfg  = CONFIG[provider];
  const iconSz = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const textSz = size === 'xs' ? 'text-[9px]'  : 'text-[10px]';
  const isLoading = provider === 'loading';
  const title = feature ? `${cfg.title} Feature: ${feature}` : cfg.title;

  return (
    <span
      className={`${cfg.badgeCls} inline-flex items-center gap-1 ${textSz} ${className}`}
      title={title}
      aria-label={`AI provider: ${cfg.label}${feature ? ` (${feature})` : ''}`}
    >
      <cfg.Icon
        className={`${iconSz} shrink-0 ${isLoading ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span>{cfg.label}</span>
    </span>
  );
}

export default AIStatusBadge;
