'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { Task, Project, Meeting, Message, CrmPipelineStats, DealStage } from '@/types';
import { DailyFocusCard } from '@/components/dashboard/DailyFocusCard';
import { TrialBanner } from '@/components/subscription/TrialBanner';
import { StatCard } from '@/components/common/StatCard';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonLine } from '@/components/common/LoadingSkeleton';
import {
  CheckSquare, Briefcase, Video, Clock, Plus, ArrowRight,
  CheckCircle2, AlertCircle, AlertTriangle, MessageSquare,
  Calendar as CalendarIcon, Activity, Flame,
  Building2, TrendingUp, DollarSign, Users,
} from 'lucide-react';
import { formatDate, formatTimeAgo, getInitials } from '@/lib/utils';

const PIPELINE_STAGES: { key: DealStage; label: string; color: string; bar: string }[] = [
  { key: 'new_lead',    label: 'New Lead',    color: 'text-slate-500',   bar: 'bg-slate-400'   },
  { key: 'qualified',   label: 'Qualified',   color: 'text-blue-600',    bar: 'bg-blue-500'    },
  { key: 'proposal',    label: 'Proposal',    color: 'text-violet-600',  bar: 'bg-violet-500'  },
  { key: 'negotiation', label: 'Negotiation', color: 'text-amber-600',   bar: 'bg-amber-500'   },
  { key: 'won',         label: 'Won',         color: 'text-emerald-700', bar: 'bg-emerald-500' },
];

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/* ─── Dashboard skeleton — exactly mirrors the real layout to prevent shift ─── */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <SkeletonLine className="h-3 w-40" />
          <SkeletonLine className="h-8 w-72" />
          <SkeletonLine className="h-3 w-56 mt-1" />
        </div>
        <div className="flex gap-2">
          <SkeletonLine className="h-9 w-24 rounded-xl" />
          <SkeletonLine className="h-9 w-28 rounded-xl" />
          <SkeletonLine className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* KPI grid — matches grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 */}
      <div className="skeleton-kpi-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
          >
            <div className="flex items-center gap-3">
              <SkeletonLine className="h-10 w-10 rounded-xl shrink-0" />
              <SkeletonLine className="h-3 w-20" />
            </div>
            <SkeletonLine className="h-7 w-14" />
            <SkeletonLine className="h-2.5 w-28" />
          </div>
        ))}
      </div>

      {/* Daily Focus placeholder */}
      <div
        className="rounded-2xl border p-5 space-y-3 h-28"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-4/5" />
      </div>

      {/* Main 3-col grid — matches lg:grid-cols-3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2-col */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tasks card */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <SkeletonLine className="h-8 w-8 rounded-xl" />
                <SkeletonLine className="h-3.5 w-20" />
              </div>
              <SkeletonLine className="h-3 w-16" />
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <SkeletonLine className="h-2 w-2 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonLine className="h-3 w-3/5" />
                    <SkeletonLine className="h-2.5 w-2/5" />
                  </div>
                  <SkeletonLine className="h-5 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Projects card */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <SkeletonLine className="h-8 w-8 rounded-xl" />
                <SkeletonLine className="h-3.5 w-28" />
              </div>
              <SkeletonLine className="h-3 w-20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
                  <div className="flex items-center gap-2">
                    <SkeletonLine className="h-3 w-3 rounded-full shrink-0" />
                    <SkeletonLine className="h-3.5 w-32" />
                  </div>
                  <SkeletonLine className="h-2.5 w-full" />
                  <SkeletonLine className="h-2.5 w-4/5" />
                  <SkeletonLine className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-6">
          {/* Meetings */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <SkeletonLine className="h-8 w-8 rounded-xl" />
                <SkeletonLine className="h-3.5 w-20" />
              </div>
              <SkeletonLine className="h-7 w-7 rounded-lg" />
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 space-y-2">
                  <div className="flex justify-between gap-2">
                    <SkeletonLine className="h-3.5 w-3/5" />
                    <SkeletonLine className="h-5 w-14 rounded-lg" />
                  </div>
                  <SkeletonLine className="h-2.5 w-2/5" />
                </div>
              ))}
            </div>
          </div>

          {/* Pulse */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <SkeletonLine className="h-8 w-8 rounded-xl" />
                <SkeletonLine className="h-3.5 w-32" />
              </div>
              <SkeletonLine className="h-3 w-16" />
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-5 py-3">
                  <SkeletonLine className="h-7 w-7 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonLine className="h-3 w-1/3" />
                    <SkeletonLine className="h-2.5 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user, company } = useAuthStore();
  const { openCreateModal } = useAppStore();

  const [stats, setStats]             = useState({ totalTasks: 0, completedTasks: 0, pendingTasks: 0, activeProjects: 0, upcomingMeetings: 0 });
  const [myTasks, setMyTasks]         = useState<Task[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [meetings, setMeetings]       = useState<Meeting[]>([]);
  const [recentMessages, setMessages] = useState<Message[]>([]);
  const [crmStats, setCrmStats]       = useState<CrmPipelineStats | null>(null);
  const [loading, setLoading]         = useState(true);

  const isOwnerAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [statsRes, tasksRes, projRes, meetRes, msgRes, crmRes] = await Promise.all([
          api.get('/companies/stats'),
          api.get('/tasks/my?limit=8'),
          api.get('/projects?limit=4'),
          api.get('/meetings?limit=4'),
          api.get('/messages?limit=5'),
          api.get('/crm/stats').catch(() => null),
        ]);
        if (statsRes.data.success) setStats({
          ...statsRes.data.stats,
          upcomingMeetings: meetRes.data.meetings?.filter((m: any) => m.status === 'scheduled' || m.status === 'active').length ?? 0,
        });
        if (tasksRes.data.success) setMyTasks(tasksRes.data.tasks);
        if (projRes.data.success)  setProjects(projRes.data.projects);
        if (meetRes.data.success)  setMeetings(meetRes.data.meetings);
        if (msgRes.data.success)   setMessages(msgRes.data.messages);
        if (crmRes?.data?.success) setCrmStats(crmRes.data.stats);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Helpers ── */
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  const urgentTasks = myTasks
    .filter((t) => t.status !== 'completed' && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 3);

  const getDeadlineBadge = (dueDate?: Date | string) => {
    if (!dueDate) return null;
    const diff = (new Date(dueDate).getTime() - Date.now()) / 3_600_000;
    if (diff < 0)   return <span className="badge badge-rose"><AlertCircle className="h-2.5 w-2.5" />Overdue</span>;
    if (diff <= 24) return <span className="badge badge-amber"><Flame      className="h-2.5 w-2.5" />Due today</span>;
    if (diff <= 48) return <span className="badge badge-amber"><Clock       className="h-2.5 w-2.5" />Tomorrow</span>;
    return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Due {formatDate(dueDate, 'MMM d')}</span>;
  };

  const taskStatusStyle = (s: string) => {
    if (s === 'completed')   return 'badge badge-emerald';
    if (s === 'in_progress') return 'badge badge-blue';
    if (s === 'review')      return 'badge badge-purple';
    return 'badge badge-slate';
  };

  /* Show skeleton while loading — matches real layout exactly to prevent shift */
  if (loading) return <DashboardSkeleton />;

  return (
    /* page-reveal: fast fade+translateY on mount, 280ms, no JS state */
    <div className="page-reveal space-y-8 pb-8">

      {/* Trial / subscription status banner */}
      <TrialBanner />

      {/* ═══ HEADER ═══ */}
      <div className="reveal-item page-hero-sm" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
              {formatDate(new Date(), 'EEEE, MMMM d')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {getGreeting()}, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest mt-0.5 mb-0.5" style={{ color: 'var(--accent)' }}>Overview</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Here's what's happening in{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {company?.name ?? 'your workspace'}
              </span>
              {user?.role && (
                <span className="ml-2 badge badge-indigo capitalize">{user.role}</span>
              )}
            </p>
          </div>

          {isOwnerAdmin && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <button onClick={() => openCreateModal('task')} className="btn-primary btn-interactive h-9 px-4">
                <Plus className="h-3.5 w-3.5" /><span>New Task</span>
              </button>
              <button onClick={() => openCreateModal('project')} className="btn-secondary btn-interactive h-9 px-4">
                <Briefcase className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} /><span>New Project</span>
              </button>
              <button onClick={() => openCreateModal('meeting')} className="btn-secondary btn-interactive h-9 px-4">
                <Video className="h-3.5 w-3.5 text-blue-500" /><span>Meeting</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STAT CARDS ═══ */}
      {/* stagger-grid: each card scales+fades in with 50ms stagger */}
      <div
        className="overview-metrics stagger-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4"
        style={{ '--reveal-delay': '40ms' } as React.CSSProperties}
      >
        <StatCard label="Total Tasks"    value={stats.totalTasks}       sub="Across workspace"  icon={CheckSquare}  iconBg="bg-indigo-50"  iconColor="text-indigo-600"  accentColor="#6366f1" />
        <StatCard label="Completed"      value={stats.completedTasks}   sub="Delivered"          icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" accentColor="#10b981" />
        <StatCard label="In Progress"    value={stats.pendingTasks}     sub="Active tasks"       icon={Clock}        iconBg="bg-amber-50"   iconColor="text-amber-600"   accentColor="#f59e0b" />
        <StatCard label="Live Projects"  value={stats.activeProjects}   sub="Active roadmaps"   icon={Briefcase}    iconBg="bg-violet-50"  iconColor="text-violet-600"  accentColor="#8b5cf6" />
        <StatCard label="Meetings"       value={stats.upcomingMeetings} sub="Upcoming / active" icon={Video}        iconBg="bg-blue-50"    iconColor="text-blue-600"    accentColor="#3b82f6" className="col-span-2 sm:col-span-1" />
      </div>

      {/* ═══ URGENT DEADLINES BANNER ═══ */}
      {urgentTasks.length > 0 && (
        <div
          className="reveal-item banner-urgency"
          style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--warning-text)' }} />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Deadlines requiring attention
              </h3>
            </div>
            <Link href="/tasks" className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {urgentTasks.map((t) => (
              <div key={t._id} className="surface-interactive surface rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold theme-text-muted truncate">
                    {t.projectId?.name ?? 'No project'}
                  </span>
                  {getDeadlineBadge(t.dueDate)}
                </div>
                <p className="text-xs font-semibold theme-text-primary line-clamp-2">{t.title}</p>
                <div className="flex items-center justify-between text-[10px] theme-text-muted pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="capitalize">{t.status.replace('_', ' ')}</span>
                  <span className="font-semibold capitalize badge badge-amber">{t.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ AI DAILY FOCUS ═══ */}
      <div className="reveal-item" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
        <DailyFocusCard />
      </div>

      {/* ═══ MAIN 3-COL GRID ═══ */}
      {/* stagger-children: each top-level child animates in sequence */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* LEFT 2 cols */}
        <div className="stagger-children space-y-6 lg:col-span-2">

          {/* ── My Priority Tasks ── */}
          <div className="surface surface-interactive rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">My Tasks</h3>
              </div>
              <Link href="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                All tasks <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {myTasks.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={CheckSquare} title="No tasks assigned" description="Create a task or ask your manager to assign one." compact />
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {myTasks.slice(0, 6).map((task) => (
                  <div key={task._id} className="table-row-hover flex items-center gap-3 px-5 py-3.5 transition-colors">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${
                      task.priority === 'urgent' ? 'bg-rose-500' :
                      task.priority === 'high'   ? 'bg-amber-500' : 'bg-indigo-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold theme-text-primary truncate">{task.title}</p>
                      <p className="text-[11px] theme-text-muted truncate">
                        {task.projectId?.name && <span>{task.projectId.name} · </span>}
                        {task.dueDate ? `Due ${formatDate(task.dueDate, 'MMM d')}` : 'No due date'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getDeadlineBadge(task.dueDate)}
                      <span className={taskStatusStyle(task.status)}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Active Projects ── */}
          <div className="surface surface-interactive rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-violet-600" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">Active Projects</h3>
              </div>
              <Link href="/projects" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                All projects <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Briefcase} title="No active projects" description="Start a project to track milestones and team progress." compact />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                {projects.map((proj) => (
                  <Link
                    key={proj._id}
                    href="/projects"
                    className="group surface-interactive rounded-xl border p-4 flex flex-col gap-3 transition-all duration-150"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: proj.color ?? '#294a38' }} />
                      <p className="text-[13px] font-bold theme-text-primary truncate group-hover:text-indigo-600 transition-colors">
                        {proj.name}
                      </p>
                    </div>
                    {proj.description && (
                      <p className="text-[11px] theme-text-secondary line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-[11px] theme-text-muted mb-1.5">
                        <span>Progress</span>
                        <span className="font-semibold theme-text-secondary">{proj.progress ?? 0}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${proj.progress ?? 0}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT col */}
        <div className="stagger-children space-y-6">

          {/* ── Upcoming Meetings ── */}
          <div className="surface surface-interactive rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Video className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">Meetings</h3>
              </div>
              <button onClick={() => openCreateModal('meeting')} className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="Schedule meeting">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {meetings.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Video} title="No meetings scheduled" description="Schedule a meeting with your team." compact />
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {meetings.slice(0, 4).map((m) => (
                  <div key={m._id} className="table-row-hover px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold theme-text-primary truncate">{m.title}</p>
                      <span className={`badge shrink-0 ${m.status === 'active' ? 'badge-rose' : 'badge-slate'}`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] theme-text-muted flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {m.scheduledAt ? formatDate(m.scheduledAt, 'MMM d, h:mm a') : 'Instant'}
                      </p>
                      <Link href={`/meetings/${m._id}`} className="btn-primary h-6 px-2 rounded-lg text-[10px]">
                        {m.status === 'active' ? 'Join' : 'View'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Workspace Pulse ── */}
          <div className="surface surface-interactive rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">Workspace Pulse</h3>
              </div>
              <Link href="/chat" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Open chat →</Link>
            </div>

            {recentMessages.length === 0 ? (
              <div className="px-5 py-4 text-[12px] theme-text-muted text-center">No recent messages</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {recentMessages.map((msg) => (
                  <div key={msg._id} className="table-row-hover flex gap-3 px-5 py-3 transition-colors">
                    <Avatar name={msg.senderId?.fullName ?? 'User'} src={msg.senderId?.avatar} size="sm" className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[12px] font-semibold theme-text-primary">{msg.senderId?.fullName}</span>
                        <span className="text-[10px] theme-text-muted">{formatTimeAgo(msg.createdAt)}</span>
                      </div>
                      <p className="text-[11px] theme-text-secondary truncate mt-0.5">{msg.content || '[Attachment]'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CRM SNAPSHOT ═══ */}
      {/* scroll-reveal: enters from bottom when scrolled into view */}
      {crmStats && (
        <CrmSnapshot crmStats={crmStats} />
      )}

    </div>
  );
}

/* ─── CRM Snapshot — isolated so useInView doesn't re-run on parent renders ─── */
function CrmSnapshot({ crmStats }: { crmStats: CrmPipelineStats }) {
  // Inline the inView logic without importing — avoids making the whole page
  // 'use client' dependent on the hook import. The hook is already client-safe.
  const [visible, setVisible] = useState(false);
  const ref = typeof window !== 'undefined' ? undefined : undefined; // SSR: skip

  useEffect(() => {
    // Use IntersectionObserver if available, else show immediately
    const el = document.getElementById('crm-snapshot-section');
    if (!el) { setVisible(true); return; }
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id="crm-snapshot-section"
      className={`scroll-reveal surface-interactive surface rounded-2xl overflow-hidden${visible ? ' scroll-reveal--visible' : ''}`}
    >
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold theme-text-primary">CRM Overview</h3>
            <p className="text-[10px] theme-text-muted">Pipeline · Contacts · Companies</p>
          </div>
        </div>
        <Link href="/crm" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          Open CRM <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* top KPI row */}
        <div className="stagger-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="surface-interactive rounded-xl p-3.5 flex flex-col gap-1" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold theme-text-muted">
              <TrendingUp className="h-3 w-3" />Open deals
            </div>
            <p className="text-xl font-extrabold theme-text-primary">{crmStats.openDeals}</p>
          </div>
          <div className="surface-interactive rounded-xl p-3.5 flex flex-col gap-1" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold theme-text-muted">
              <DollarSign className="h-3 w-3" />Pipeline
            </div>
            <p className="text-xl font-extrabold theme-text-primary">{formatCurrency(crmStats.totalPipelineValue)}</p>
          </div>
          <div className="surface-interactive rounded-xl p-3.5 flex flex-col gap-1" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold theme-text-muted">
              <Users className="h-3 w-3" />Contacts
            </div>
            <p className="text-xl font-extrabold theme-text-primary">{crmStats.contactCount}</p>
          </div>
          <div className="surface-interactive rounded-xl p-3.5 flex flex-col gap-1" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />Won
            </div>
            <p className="text-xl font-extrabold text-emerald-600">{crmStats.wonDeals}</p>
          </div>
        </div>

        {/* Pipeline stage bars */}
        {crmStats.openDeals > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider theme-text-muted">Pipeline stages</p>
            {PIPELINE_STAGES.map((s) => {
              const data = crmStats.stageMap[s.key] ?? { count: 0, totalValue: 0 };
              const maxCount = Math.max(...PIPELINE_STAGES.map((st) => (crmStats.stageMap[st.key]?.count ?? 0)), 1);
              const pct = Math.round((data.count / maxCount) * 100);
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className={`text-[11px] font-semibold w-24 shrink-0 ${s.color}`}>{s.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                    <div className={`h-full rounded-full transition-all duration-500 ${s.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold w-16 text-right theme-text-secondary">
                    {data.count} deal{data.count !== 1 ? 's' : ''}
                    {data.totalValue > 0 && <span className="theme-text-muted"> · {formatCurrency(data.totalValue)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {crmStats.openDeals === 0 && crmStats.contactCount === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Building2 className="h-8 w-8 theme-text-muted opacity-40" />
            <p className="text-xs theme-text-muted">No CRM data yet. <Link href="/crm" className="text-indigo-600 hover:underline font-semibold">Open CRM</Link> to add contacts and deals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
