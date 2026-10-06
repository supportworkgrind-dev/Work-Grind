'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { BackButton } from '@/components/common/BackButton';
import {
  Sparkles,
  RotateCw,
  CheckSquare,
  Video,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  Clock,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Filter,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DailyFocusData, FocusItem } from '@/components/dashboard/DailyFocusCard';
import { formatDate } from '@/lib/utils';

export default function DailyFocusPage() {
  const { isAtLimit, refreshSubscription } = useAuthStore();
  const aiLimitReached = isAtLimit('aiRequests');
  const [data, setData] = useState<DailyFocusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'task' | 'meeting' | 'message'>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchFocus = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const endpoint = forceRefresh ? '/daily-focus?refresh=true' : '/daily-focus';
      const res = await api.get(endpoint);

      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        if (forceRefresh) void refreshSubscription();
      } else {
        setError('Unable to load Daily Focus.');
      }
    } catch (err: any) {
      console.error('Daily focus error:', err);
      setError(err?.response?.data?.message || 'Failed to sync Daily Focus');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFocus(false);
  }, []);

  const items = data?.focusItems || [];
  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const taskCount = items.filter((i) => i.type === 'task').length;
  const meetingCount = items.filter((i) => i.type === 'meeting').length;
  const messageCount = items.filter((i) => i.type === 'message').length;
  const urgentCount = items.filter((i) => i.priority === 'high').length;

  const getItemIcon = (type: FocusItem['type']) => {
    switch (type) {
      case 'meeting':
        return <Video className="h-4 w-4 text-emerald-600" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-purple-600" />;
      case 'task':
      default:
        return <CheckSquare className="h-4 w-4 text-blue-600" />;
    }
  };

  const getPriorityBadge = (priority: FocusItem['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Back Navigation */}
      <BackButton fallback="/dashboard" />

      {/* ── HEADER ── */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="workspace-chip mb-3" style={{ display: 'inline-flex' }}>
            <Sparkles className="h-3 w-3" />
            AI Signature Feature
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}
          >
            Daily Focus
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(new Date(), 'EEEE, MMMM d, yyyy')} • Synthesized by{' '}
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {data?.generatedBy === 'ai' ? 'Tavro AI' : 'Intelligent Workload Engine'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchFocus(true)}
            disabled={refreshing || aiLimitReached}
            className="btn-primary btn-interactive inline-flex items-center gap-2 h-9 px-4 text-xs sm:text-sm"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : aiLimitReached ? 'AI limit reached' : 'Re-calculate Priorities'}</span>
          </button>
          {aiLimitReached && <Link href="/billing" className="text-xs font-semibold text-indigo-600 underline">Upgrade AI limit</Link>}
        </div>
      </div>

      {/* ── STATS SUMMARY BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-tile card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Action Items</span>
            <div className="icon-tray-indigo p-2 rounded-xl">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{items.length}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Ranked by urgency</p>
        </div>

        <div className="stat-tile card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Urgent Blockers</span>
            <div className="icon-tray-rose p-2 rounded-xl">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: 'var(--error-text)' }}>{urgentCount}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Requires today&apos;s action</p>
        </div>

        <div className="stat-tile card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Today&apos;s Meetings</span>
            <div className="icon-tray-emerald p-2 rounded-xl">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: 'var(--success-text)' }}>{meetingCount}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Live conference rooms</p>
        </div>

        <div className="stat-tile card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Unread Mentions</span>
            <div className="icon-tray-violet p-2 rounded-xl">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: 'var(--accent-text)' }}>{messageCount}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Team chat threads</p>
        </div>
      </div>

      {/* ── AI SUMMARY BOX ── */}
      {data?.summary && (
        <div
          className="rounded-2xl border p-5 sm:p-6 surface-premium"
          style={{
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated, var(--bg-card)) 100%)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
              style={{
                background: 'var(--accent)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-on-accent)',
              }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Executive Daily Briefing</h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        {([
          { key: 'all',     label: `All Items (${items.length})` },
          { key: 'task',    label: `Tasks (${taskCount})` },
          { key: 'meeting', label: `Meetings (${meetingCount})` },
          { key: 'message', label: `Mentions (${messageCount})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filter === key ? 'text-[var(--text-on-accent)] shadow-xs' : 'hover:bg-[var(--bg-hover)]'
            }`}
            style={filter === key
              ? { background: 'var(--accent)' }
              : { color: 'var(--text-secondary)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── RANKED FOCUS LIST ── */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl skeleton-shimmer animate-pulse" />
          ))
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
            <div className="h-12 w-12 mx-auto rounded-2xl icon-tray-emerald flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {filter === 'all' ? 'No priority action items right now! 🎉' : `No ${filter} items found.`}
            </h3>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
              You are completely caught up in this category. Explore team channels or create a new task.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link href="/tasks" className="btn-primary h-9 px-4">
                <span>Go to Tasks</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <Link
              key={item.id || idx}
              href={item.link}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 card-hover surface transition-all"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div
                    className="p-2.5 rounded-xl border transition-all"
                    style={{
                      background: 'var(--bg-hover)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {getItemIcon(item.type)}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </h3>
                    {item.badge && (
                      <span className="tag">{item.badge}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Urgency:</span> {item.reason}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0 pt-3 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getPriorityBadge(item.priority)}`}>
                  {item.priority}
                </span>

                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                >
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* ── AI REASONING CRITERIA CARD ── */}
      <div className="rounded-2xl border p-5 surface" style={{ background: 'var(--bg-sunken, var(--bg-base))' }}>
        <h4 className="font-bold flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-primary)' }}>
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>How Daily Focus Prioritization Works</span>
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Tavro AI analyzes your active workspace in real time. Items are evaluated along a strict multi-tier hierarchy:
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}> Overdue Tasks (High)</span> →{' '}
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Upcoming Live Meetings (High)</span> →{' '}
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Today&apos;s Deadlines (High)</span> →{' '}
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Unread Mentions (Medium)</span> →{' '}
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>In-Progress Tasks (Medium/Low)</span>.
        </p>
      </div>
    </div>
  );
}
