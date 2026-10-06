'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
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
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export interface FocusItem {
  id: string;
  type: 'task' | 'meeting' | 'message';
  title: string;
  reason: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
  badge: string;
  meta?: Record<string, any>;
}

export interface DailyFocusData {
  _id: string;
  dateKey: string;
  summary: string;
  focusItems: FocusItem[];
  generatedBy: 'ai' | 'rules';
  isAllClear: boolean;
  totalUrgentCount: number;
}

interface DailyFocusCardProps {
  className?: string;
  onRefresh?: () => void;
}

export function DailyFocusCard({ className = '', onRefresh }: DailyFocusCardProps) {
  const { isAtLimit, refreshSubscription } = useAuthStore();
  const aiLimitReached = isAtLimit('aiRequests');
  const [data, setData] = useState<DailyFocusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyFocus = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const endpoint = forceRefresh ? '/daily-focus?refresh=true' : '/daily-focus';
      const res = await api.get(endpoint);

      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        if (forceRefresh) void refreshSubscription();
        if (onRefresh) onRefresh();
      } else {
        setError('Unable to load Daily Focus.');
      }
    } catch (err: any) {
      console.error('Daily focus load error:', err);
      setError(err?.response?.data?.message || 'Failed to sync Daily Focus');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDailyFocus(false);
  }, []);

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

  const items = data?.focusItems || [];
  const displayedItems = expanded ? items : items.slice(0, 5);

  if (loading) {
    return (
      <div className={`rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs animate-pulse ${className}`}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-44 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="h-8 w-20 bg-slate-100 rounded-xl" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-12 bg-slate-100 rounded-2xl" />
          <div className="h-12 bg-slate-100 rounded-2xl" />
          <div className="h-12 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-3xl border border-indigo-100/80 bg-gradient-to-b from-indigo-50/40 via-white to-white p-5 sm:p-6 shadow-sm shadow-indigo-100/50 transition-all ${className}`}
    >
      {/* ── CARD HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Today&apos;s Focus</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                <Sparkles className="h-3 w-3 text-blue-600" />
                <span>AI Prioritized</span>
              </span>
              {data?.generatedBy === 'ai' && (
                <span className="hidden sm:inline-block text-[10px] font-medium text-slate-400">
                  GPT-4o Ranked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified priority roadmap across tasks, deadlines, meetings, and team mentions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => fetchDailyFocus(true)}
            disabled={refreshing || aiLimitReached}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition-all"
            title="Refresh Daily Focus"
          >
            <RotateCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : aiLimitReached ? 'AI limit reached' : 'Refresh'}</span>
          </button>

          <Link
            href="/daily-focus"
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100/70 transition-all"
          >
            <span>Full View</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── AI SUMMARY CALLOUT ── */}
      {data?.summary && (
        <div className="mt-4 rounded-2xl bg-white border border-indigo-100 p-3.5 sm:p-4 flex items-start gap-3 shadow-xs">
          <div className="h-7 w-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
              {data.summary}
            </p>
            {data.totalUrgentCount > 0 && (
              <span className="inline-block mt-1 text-[11px] font-medium text-rose-600">
                ⚠️ {data.totalUrgentCount} item{data.totalUrgentCount > 1 ? 's require' : ' requires'} immediate action.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── RANKED FOCUS LIST ── */}
      <div className="mt-4 space-y-2.5">
        {data?.isAllClear || items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center">
            <div className="h-10 w-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">All clear for today! 🎉</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              You have no overdue deadlines, upcoming meetings, or urgent blockers right now. Take this opportunity to plan ahead or create new tasks.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <span>View All Tasks</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          displayedItems.map((item, idx) => (
            <Link
              key={item.id || idx}
              href={item.link}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs font-bold text-slate-400 w-4 text-center">
                    0{idx + 1}
                  </span>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                    {getItemIcon(item.type)}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/60">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-normal">
                    {item.reason}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityBadge(
                    item.priority
                  )}`}
                >
                  {item.priority}
                </span>

                <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* ── EXPAND / COLLAPSE IF MORE THAN 5 ITEMS ── */}
      {items.length > 5 && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {expanded ? (
              <>
                <span>Show top 5 only</span>
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Show all {items.length} focus items</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
