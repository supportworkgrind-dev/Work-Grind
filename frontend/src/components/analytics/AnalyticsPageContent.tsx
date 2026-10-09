'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SkeletonLine } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart2, TrendingUp, Users, CheckSquare,
  Building2, DollarSign, Video, Briefcase,
  AlertCircle, RefreshCw,
} from 'lucide-react';

// ── WorkGrind data palette: evergreen, terracotta, and quiet supporting tones ─
const CHART_COLORS = ['#294a38', '#bf6548', '#81947a', '#a18045', '#59665d', '#a7b5a1'];
const STAGE_COLORS: Record<string, string> = {
  new_lead: '#899089', qualified: '#81947a', proposal: '#a18045',
  negotiation: '#bf6548', won: '#294a38', lost: '#866a62',
};

// ── Skeleton for loading state ────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="surface rounded-2xl p-5 space-y-4 animate-fade-in" style={{ minHeight: 240 }}>
      <SkeletonLine className="h-4 w-40" />
      <div className="flex items-end gap-2 pt-4" style={{ height: 160 }}>
        {[40,70,55,90,65,80,50,75,60,85].map((h,i) => (
          <div key={i} className="skeleton-shimmer rounded-t flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon }: {
  label: string; value: number | string; sub?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="surface-interactive surface rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider theme-text-muted">{label}</span>
        <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
          <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
      <p className="text-3xl font-black tracking-tight theme-text-primary" style={{ letterSpacing: '-0.04em' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs theme-text-muted">{sub}</p>}
    </div>
  );
}

// ── Tab system ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',  icon: BarChart2  },
  { id: 'crm',       label: 'CRM',       icon: Building2  },
  { id: 'tasks',     label: 'Tasks',     icon: CheckSquare},
  { id: 'team',      label: 'Team',      icon: Users      },
  { id: 'meetings',  label: 'Meetings',  icon: Video      },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [crm,      setCrm]      = useState<any>(null);
  const [tasks,    setTasks]    = useState<any>(null);
  const [team,     setTeam]     = useState<any>(null);
  const [meetings, setMeetings] = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  async function loadOverview() {
    try {
      setLoading(true); setError('');
      const r = await api.get('/analytics/overview');
      setOverview(r.data.overview);
    } catch { setError('Failed to load analytics.'); }
    finally { setLoading(false); }
  }

  async function loadTab(t: TabId) {
    if (t === 'overview') { if (!overview) await loadOverview(); return; }
    try {
      setLoading(true); setError('');
      const r = await api.get(`/analytics/${t}`);
      if (t === 'crm')     setCrm(r.data.crm);
      if (t === 'tasks')   setTasks(r.data.tasks);
      if (t === 'team')    setTeam(r.data.team);
      if (t === 'meetings') setMeetings(r.data.meetings);
    } catch { setError(`Failed to load ${t} analytics.`); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadOverview(); }, []);

  function handleTab(t: TabId) {
    setTab(t);
    if (t === 'crm'      && !crm)      loadTab('crm');
    if (t === 'tasks'    && !tasks)    loadTab('tasks');
    if (t === 'team'     && !team)     loadTab('team');
    if (t === 'meetings' && !meetings) loadTab('meetings');
  }

  return (
    <div className="page-reveal space-y-6 pb-8">
      <PageHeader
        hero
        title="Analytics"
        subtitle="Real-time insights from your workspace data"
        icon={BarChart2}
        actions={
          <button onClick={() => loadTab(tab)} className="btn-secondary h-9 px-3">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl border w-fit" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              tab === t.id
                ? 'text-[var(--text-on-accent)] shadow-sm'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
            style={tab === t.id ? { background: 'var(--accent)' } : {}}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_,i) => <div key={i} className="surface rounded-2xl p-5 h-28 skeleton-shimmer" />)}
          </div>
        ) : overview ? (
          <div className="space-y-6 stagger-children">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Tasks"     value={overview.tasks.total}        sub={`${overview.tasks.completionRate}% completion rate`} icon={CheckSquare} />
              <KpiCard label="Completed Tasks" value={overview.tasks.completed}    sub={`${overview.tasks.overdue} overdue`}               icon={TrendingUp} />
              <KpiCard label="Active Projects" value={overview.projects.active}    sub={`${overview.projects.completed} completed`}        icon={Briefcase} />
              <KpiCard label="Team Members"    value={overview.team.totalMembers}  sub="Active workspace members"                          icon={Users} />
              <KpiCard label="Open Deals"      value={overview.crm.openDeals}      sub={`${overview.crm.wonDeals} deals won`}              icon={Building2} />
              <KpiCard label="Won Revenue"     value={`$${(overview.crm.totalDealValue/1000).toFixed(1)}K`} sub="Total closed revenue"   icon={DollarSign} />
              <KpiCard label="Total Meetings"  value={overview.meetings.total}     sub={`${overview.meetings.completed} completed`}        icon={Video} />
              <KpiCard label="CRM Contacts"    value={overview.crm.totalContacts}  sub={`${overview.crm.totalCrmCompanies} companies`}     icon={Users} />
            </div>

            {/* Quick completion rate bar */}
            <div className="surface rounded-2xl p-6">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Task Completion Rate</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${overview.tasks.completionRate}%`, background: 'var(--accent)' }}
                  />
                </div>
                <span className="text-lg font-black theme-text-primary tabular-nums">{overview.tasks.completionRate}%</span>
              </div>
              <div className="flex gap-6 mt-4 text-xs theme-text-muted">
                <span><span className="font-bold text-indigo-500">{overview.tasks.completed}</span> completed</span>
                <span><span className="font-bold text-rose-500">{overview.tasks.overdue}</span> overdue</span>
                <span><span className="font-bold theme-text-primary">{overview.tasks.total}</span> total</span>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* ── CRM TAB ── */}
      {tab === 'crm' && (
        loading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2,3,4].map(i=><ChartSkeleton key={i}/>)}</div>
        : crm ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
            {/* Deals by Stage */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Deals by Stage</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={crm.dealsByStage} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6,6,0,0]}>
                    {crm.dealsByStage.map((entry: any, i: number) => (
                      <Cell key={i} fill={STAGE_COLORS[entry._id] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by Month */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Won Revenue by Month</h3>
              {crm.revenueByMonth.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs theme-text-muted">No won deals yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={crm.revenueByMonth} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `$${(Number(v)/1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }}
                      formatter={(v) => v != null ? [`$${Number(v).toLocaleString()}`, 'Revenue'] : ['-', 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--wg-chart-1)" strokeWidth={2.5} dot={{ fill: 'var(--wg-chart-1)', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Contacts by Status */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Contacts by Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={crm.contactsByStatus} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={70} label={({ _id, count }: any) => `${_id}: ${count}`} labelLine={false}>
                    {crm.contactsByStatus.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Deals */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Top Open Deals</h3>
              {crm.topDeals.length === 0 ? (
                <div className="text-xs theme-text-muted text-center py-8">No open deals</div>
              ) : (
                <div className="space-y-3">
                  {crm.topDeals.map((d: any) => (
                    <div key={d._id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold theme-text-primary truncate">{d.title}</p>
                        <p className="text-[10px] theme-text-muted">{d.crmCompanyId?.name} · {d.stage}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0">${(d.value??0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* ── TASKS TAB ── */}
      {tab === 'tasks' && (
        loading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2,3,4].map(i=><ChartSkeleton key={i}/>)}</div>
        : tasks ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
            {/* By Status */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Tasks by Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tasks.byStatus} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--wg-chart-1)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Priority */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Open Tasks by Priority</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={tasks.byPriority} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={80} label={({ _id, count }: any) => `${_id} (${count})`} labelLine={false}>
                    {tasks.byPriority.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Completion Trend */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Tasks Completed (Last 30 Days)</h3>
              {tasks.completionTrend.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs theme-text-muted">No completions yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={tasks.completionTrend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="var(--wg-chart-2)" strokeWidth={2.5} dot={{ fill: 'var(--wg-chart-2)', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Project Progress */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Active Project Progress</h3>
              {tasks.projectProgress.length === 0 ? (
                <div className="text-xs theme-text-muted text-center py-8">No active projects</div>
              ) : (
                <div className="space-y-3">
                  {tasks.projectProgress.map((p: any) => (
                    <div key={p._id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold theme-text-primary truncate">{p.name}</span>
                        <span className="theme-text-muted shrink-0 ml-2">{p.progress ?? 0}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${p.progress ?? 0}%`, background: p.color ?? '#294a38' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* ── TEAM TAB ── */}
      {tab === 'team' && (
        loading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2,3].map(i=><ChartSkeleton key={i}/>)}</div>
        : team ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
            {/* Workload */}
            <div className="surface rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Team Workload (Open Tasks)</h3>
              {team.workload.length === 0 ? (
                <div className="text-xs theme-text-muted text-center py-8">No task assignments yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={team.workload} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis type="category" dataKey="user.fullName" width={110} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="taskCount" fill="var(--wg-chart-1)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By Role */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Members by Role</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={team.byRole} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={70} label={({ _id, count }: any) => `${_id} (${count})`} labelLine={false}>
                    {team.byRole.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* By Department */}
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Members by Department</h3>
              {team.byDept.length === 0 ? (
                <div className="text-xs theme-text-muted text-center py-12">No department data</div>
              ) : (
                <div className="space-y-2">
                  {team.byDept.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs theme-text-secondary w-28 shrink-0 truncate">{d._id}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(d.count / Math.max(...team.byDept.map((x: any) => x.count))) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-xs font-bold theme-text-primary w-6 shrink-0">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* ── MEETINGS TAB ── */}
      {tab === 'meetings' && (
        loading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2].map(i=><ChartSkeleton key={i}/>)}</div>
        : meetings ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Meetings by Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={meetings.byStatus} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={70} label={({ _id, count }: any) => `${_id} (${count})`} labelLine={false}>
                    {meetings.byStatus.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Meetings per Month</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={meetings.perMonth} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="total" fill="var(--wg-chart-1)" radius={[4,4,0,0]} name="Total" />
                  <Bar dataKey="ended" fill="var(--wg-chart-3)" radius={[4,4,0,0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-1">Average Duration</h3>
              <p className="text-3xl font-black theme-text-primary mt-2">{Math.round(meetings.avgDuration?.avgMinutes ?? 0)} min</p>
              <p className="text-xs theme-text-muted">across {meetings.avgDuration?.totalMeetings ?? 0} completed meetings</p>
            </div>

            <div className="surface rounded-2xl p-5">
              <h3 className="text-sm font-bold theme-text-primary mb-4">Upcoming Meetings</h3>
              {meetings.upcomingList.length === 0 ? (
                <div className="text-xs theme-text-muted text-center py-8">No upcoming meetings</div>
              ) : (
                <div className="space-y-2">
                  {meetings.upcomingList.map((m: any) => (
                    <div key={m._id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold theme-text-primary truncate">{m.title}</p>
                        <p className="text-[10px] theme-text-muted">
                          {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          {m.duration ? ` · ${m.duration}min` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
