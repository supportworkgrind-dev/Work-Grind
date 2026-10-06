'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { NotificationItem } from '@/types';
import { Bell, Check, Trash2, ArrowRight, MessageSquare, CheckSquare, Video, Briefcase, Sparkles } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import { BackButton } from '@/components/common/BackButton';
import { EmptyState } from '@/components/common/EmptyState';

const ICON_MAP: Record<string, React.ReactNode> = {
  message:       <MessageSquare className="h-4 w-4 text-purple-500" />,
  mention:       <MessageSquare className="h-4 w-4 text-purple-500" />,
  task_assigned: <CheckSquare   className="h-4 w-4 text-indigo-500" />,
  task_due:      <CheckSquare   className="h-4 w-4 text-amber-500"  />,
  task_updated:  <CheckSquare   className="h-4 w-4 text-indigo-500" />,
  meeting_invite:<Video         className="h-4 w-4 text-blue-500"   />,
  deal_update:   <Briefcase     className="h-4 w-4 text-emerald-500" />,
  project_update:<Briefcase     className="h-4 w-4 text-emerald-500"/>,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter,  setFilter]  = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const r = await api.get(filter === 'unread' ? '/notifications?unreadOnly=true' : '/notifications');
      if (r.data.success) setNotifications(r.data.notifications);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, [filter]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onNew = (n: NotificationItem) => {
      setNotifications((p) => {
        if (filter === 'unread' && n.isRead) return p;
        if (p.some((x) => x._id === n._id)) return p;
        return [n, ...p];
      });
    };
    s.on('notification:new', onNew);
    return () => { s.off('notification:new', onNew); };
  }, [filter]);

  const markAll  = async () => { try { await api.patch('/notifications/read-all'); setNotifications((p) => p.map((n) => ({ ...n, isRead: true }))); } catch { /* silent */ } };
  const markOne  = async (id: string) => { try { await api.patch(`/notifications/${id}/read`); setNotifications((p) => p.map((n) => n._id === id ? { ...n, isRead: true } : n)); } catch { /* silent */ } };
  const deleteOne = async (id: string) => { try { await api.delete(`/notifications/${id}`); setNotifications((p) => p.filter((n) => n._id !== id)); } catch { /* silent */ } };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <BackButton fallback="/dashboard" />

      {/* Header */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-tray-indigo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">Task updates, mentions, meeting invites, and project activity</p>
          </div>
        </div>
        <button onClick={markAll} className="btn-secondary h-9 px-4 shrink-0">
          <Check className="h-3.5 w-3.5" /><span>Mark all read</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
              filter === f ? 'text-[var(--text-on-accent)] shadow-xs' : 'theme-text-secondary hover:theme-bg-hover'
            }`}
            style={filter === f ? { background: 'var(--accent)' } : {}}
          >
            {f === 'all' ? 'All Notifications' : 'Unread Only'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="All caught up!" description="You have no notifications right now. Check back later." compact />
      ) : (
        <div className="surface rounded-2xl overflow-hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`flex items-start gap-3.5 p-4 sm:p-5 transition-colors ${
                !n.isRead ? 'notification-unread' : ''
              }`}
            >
              {/* Icon */}
              <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
                {ICON_MAP[n.type] ?? <Sparkles className="h-4 w-4 text-amber-500" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold theme-text-primary min-w-0">{n.title}</p>
                  <span className="text-[10px] theme-text-muted shrink-0">{formatTimeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs theme-text-secondary leading-relaxed break-words">{n.body}</p>
                {n.actionUrl && (
                  <Link href={n.actionUrl} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    View details <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {!n.isRead && (
                  <button onClick={() => markOne(n._id)} title="Mark as read"
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-indigo-50 hover:text-indigo-600 theme-text-muted">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => deleteOne(n._id)} title="Delete"
                  className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-rose-50 hover:text-rose-600 theme-text-muted">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
