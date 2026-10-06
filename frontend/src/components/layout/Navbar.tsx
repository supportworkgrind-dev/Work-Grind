'use client';

import { useState, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { NotificationItem } from '@/types';
import {
  Search,
  Plus,
  Bell,
  Menu,
  CheckSquare,
  Briefcase,
  Video,
  Hash,
  ChevronDown,
  Check,
  Sparkles,
  WifiOff,
  RotateCw,
  X,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { formatTimeAgo, getInitials } from '@/lib/utils';
import { useSyncStore } from '@/store/useSyncStore';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';

const notifIcons: Record<string, React.ReactNode> = {
  message:       <MessageSquare className="h-4 w-4 theme-text-secondary" />,
  mention:       <MessageSquare className="h-4 w-4 theme-text-secondary" />,
  task_assigned: <CheckSquare   className="h-4 w-4 theme-text-secondary" />,
  task_due:      <CheckSquare   className="h-4 w-4 theme-text-secondary" />,
  task_updated:  <CheckSquare   className="h-4 w-4 theme-text-secondary" />,
  meeting_invite:<Video         className="h-4 w-4 theme-text-secondary" />,
  project_update:<Briefcase     className="h-4 w-4 theme-text-secondary" />,
};

export const Navbar = memo(function Navbar() {
  const user           = useAuthStore((s) => s.user);
  const { toggleSidebar, setSearchOpen, openCreateModal } = useAppStore();
  const { isOnline, pendingCount, isSyncing } = useSyncStore();

  const [showCreate,       setShowCreate]       = useState(false);
  const [showNotifs,       setShowNotifs]       = useState(false);
  const [notifications,    setNotifications]    = useState<NotificationItem[]>([]);
  const [unreadCount,      setUnreadCount]      = useState(0);
  const [activeLiveMeeting,setActiveLiveMeeting]= useState<any | null>(null);

  const notifsRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  /* ── Data fetching ── */
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (res.data.success) {
          setNotifications(res.data.notifications.slice(0, 12));
          setUnreadCount(res.data.unreadCount ?? 0);
        }
      } catch { /* silent */ }
    };

    const fetchLiveMeeting = async () => {
      try {
        const res = await api.get('/meetings/active');
        if (res.data.success && res.data.meetings?.length > 0) {
          setActiveLiveMeeting(res.data.meetings[0]);
        }
      } catch { /* silent */ }
    };

    fetchNotifications();
    fetchLiveMeeting();

    const socket = getSocket();
    if (!socket) return;

    const onNewNotif = (n: NotificationItem) => {
      setNotifications((p) => [n, ...p].slice(0, 12));
      setUnreadCount((c) => c + 1);
    };
    const onMeetingStart = ({ meeting }: any) => setActiveLiveMeeting(meeting);
    const onMeetingEnd   = ({ meetingLink }: any) =>
      setActiveLiveMeeting((p: any) => p?.meetingLink === meetingLink ? null : p);

    socket.on('notification:new', onNewNotif);
    socket.on('meeting:started',  onMeetingStart);
    socket.on('meeting:ended',    onMeetingEnd);

    return () => {
      socket.off('notification:new', onNewNotif);
      socket.off('meeting:started',  onMeetingStart);
      socket.off('meeting:ended',    onMeetingEnd);
    };
  }, [user]);

  /* ── Close popups on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (createRef.current && !createRef.current.contains(e.target as Node)) setShowCreate(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const isOwnerAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  return (
    <header
      className="workspace-navbar sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b theme-border theme-bg-navbar px-4 sm:px-6"
    >
      {/* ── LEFT ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Sidebar toggle */}
        <button
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="rounded-xl p-2 theme-text-secondary hover:theme-bg-hover transition-colors focus-ring shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/dashboard" aria-label="WorkGrind home" className="shrink-0">
          <span className="hidden sm:block">
            <ThemeAwareLogo size="sm" />
          </span>
          <span className="sm:hidden">
            <ThemeAwareLogo size="sm" showWordmark={false} />
          </span>
        </Link>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Open search (Ctrl+K)"
          className="navbar-search flex h-10 items-center gap-2 rounded-xl border theme-border theme-bg-input
                     px-3 text-xs theme-text-muted hover:theme-bg-hover
                     transition-all duration-150 shadow-xs
                     w-28 sm:w-44 md:w-64 lg:w-80"
        >
          <Search className="h-3.5 w-3.5 shrink-0 theme-text-muted" />
          <span className="hidden xs:inline flex-1 text-left">Search anything...</span>
          <kbd
            className="hidden sm:inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', background: 'var(--bg-base)' }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── CENTER: Live Meeting Pill ── */}
      {activeLiveMeeting && (
        <Link
          href={`/meetings?join=${activeLiveMeeting.meetingLink}`}
          className="hidden md:flex items-center gap-2 rounded-xl border border-rose-400/30
                     bg-rose-500/8 px-3 py-1.5 text-xs font-semibold text-rose-600
                     hover:bg-rose-500/15 transition-all max-w-[260px]"
        >
          {/* Pulse dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <span className="truncate">Live: {activeLiveMeeting.title}</span>
          <span className="shrink-0 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] text-white font-bold">
            Join
          </span>
        </Link>
      )}

      {/* ── RIGHT ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Sync / offline indicator */}
        <div className="hidden sm:flex items-center">
          {isSyncing ? (
            <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200/60 bg-blue-50">
              <RotateCw className="h-3 w-3 animate-spin" />
              <span>Syncing</span>
            </div>
          ) : !isOnline ? (
            <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200/60 bg-amber-50">
              <WifiOff className="h-3 w-3" />
              <span>Offline{pendingCount > 0 ? ` · ${pendingCount}` : ''}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-medium hidden lg:inline theme-text-muted">Online</span>
            </div>
          )}
        </div>

        {/* ── Create button ── */}
        <div className="relative" ref={createRef}>
          <button
            onClick={() => setShowCreate((p) => !p)}
            aria-expanded={showCreate}
            aria-haspopup="menu"
            className="btn-primary h-9 px-3 sm:px-3.5 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">New</span>
            <ChevronDown className={`h-3 w-3 opacity-70 transition-transform duration-150 ${showCreate ? 'rotate-180' : ''}`} />
          </button>

          {showCreate && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-2xl border p-1.5 shadow-float z-50 animate-scale-in"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              role="menu"
            >
              <p className="section-label px-3 pt-1.5 pb-1">Create new</p>

              {isOwnerAdmin && (
                <>
                  <MenuAction
                    icon={<CheckSquare className="h-4 w-4 theme-text-secondary" />}
                    label="Task"
                    onClick={() => { openCreateModal('task'); setShowCreate(false); }}
                  />
                  <MenuAction
                    icon={<Briefcase className="h-4 w-4 theme-text-secondary" />}
                    label="Project"
                    onClick={() => { openCreateModal('project'); setShowCreate(false); }}
                  />
                  <MenuAction
                    icon={<Hash className="h-4 w-4 theme-text-secondary" />}
                    label="Channel"
                    onClick={() => { openCreateModal('channel'); setShowCreate(false); }}
                  />
                </>
              )}
              <MenuAction
                icon={<Video className="h-4 w-4 theme-text-secondary" />}
                label="Meeting"
                onClick={() => { openCreateModal('meeting'); setShowCreate(false); }}
              />
            </div>
          )}
        </div>

        {/* ── Notifications ── */}
        <div className="relative" ref={notifsRef}>
          <button
            onClick={() => setShowNotifs((p) => !p)}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={showNotifs}
            className="relative rounded-xl p-2 theme-text-secondary hover:theme-bg-hover transition-colors focus-ring"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center
                           rounded-full bg-rose-500 text-[9px] font-bold text-white
                           ring-2"
                style={{ '--tw-ring-color': 'var(--bg-navbar)' } as React.CSSProperties}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border shadow-float z-50 overflow-hidden animate-scale-in"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              role="dialog"
              aria-label="Notifications"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold theme-text-primary">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge badge-rose">{unreadCount}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Read all</span>
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="rounded-lg p-1 hover:theme-bg-hover transition-colors theme-text-muted">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[20rem] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="mx-auto h-8 w-8 theme-text-muted mb-2 opacity-40" />
                    <p className="text-xs theme-text-muted">You're all caught up</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      className="flex items-start gap-3 px-4 py-3.5 transition-colors"
                      style={{
                        background: !n.isRead ? 'var(--bg-active)' : 'transparent',
                      }}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                        {notifIcons[n.type] ?? <Sparkles className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[12px] font-semibold theme-text-primary min-w-0 truncate flex-1">{n.title}</p>
                          <span className="text-[10px] theme-text-muted shrink-0">{formatTimeAgo(n.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] theme-text-secondary break-words leading-relaxed">{n.body}</p>
                      </div>
                      {!n.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5" style={{ background: 'var(--accent)' }} />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-2.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
                <Link
                  href="/notifications"
                  onClick={() => setShowNotifs(false)}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-1 transition-colors"
                >
                  View all notifications
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── User Avatar ── */}
        <Link
          href="/settings"
          aria-label="Account settings"
          className="flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden text-xs font-bold
                     transition-all hover:ring-2 focus-ring shrink-0"
          style={{
            background: 'var(--accent-subtle)',
            color: 'var(--accent-text)',
            '--tw-ring-color': 'var(--accent)',
          } as React.CSSProperties}
        >
          {user?.avatar
            ? <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
            : <span>{getInitials(user?.fullName || 'U')}</span>
          }
        </Link>
      </div>
    </header>
  );
});

/* ── Small internal helper ── */
function MenuAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-100 hover:theme-bg-hover"
      style={{ color: 'var(--text-secondary)' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
