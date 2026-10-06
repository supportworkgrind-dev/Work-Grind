'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import {
  Users,
  Building2,
  Briefcase,
  CheckSquare,
  TrendingUp,
  HardDrive,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserX,
  Sparkles,
  LifeBuoy,
  Flame,
  Calendar,
} from 'lucide-react';

interface PlatformStats {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    active: number;
    suspended: number;
  };
  workspaces: {
    total: number;
    company: number;
    individual: number;
    planBreakdown: { free: number; starter: number; pro: number };
  };
  workload: {
    totalProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    totalMessages: number;
    totalFiles: number;
    totalStorageBytes: number;
  };
  support: {
    pendingTickets: number;
  };
  signupTrend: { date: string; label: string; count: number }[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function SuperAdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<{ label: string; count: number } | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.get('/analytics');
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load platform analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const maxSignupCount = Math.max(1, ...(stats?.signupTrend.map((d) => d.count) || [1]));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Health & Analytics</h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time platform metrics, user registration velocity, and infrastructure utilization
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Registered Users</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats?.users.total ?? '—'}</span>
            <span className="text-xs font-semibold text-emerald-400">
              +{stats?.users.thisMonth ?? 0} this month
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Today: +{stats?.users.today ?? 0}</span>
            <span>This Week: +{stats?.users.thisWeek ?? 0}</span>
          </div>
        </div>

        {/* Total Workspaces */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Workspaces</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats?.workspaces.total ?? '—'}</span>
            <span className="text-xs font-semibold text-slate-400">
              {stats?.workspaces.company ?? 0} Teams &bull; {stats?.workspaces.individual ?? 0} Solo
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Starter: {stats?.workspaces.planBreakdown.starter ?? 0}</span>
            <span>Pro: {stats?.workspaces.planBreakdown.pro ?? 0}</span>
          </div>
        </div>

        {/* Projects & Deliverables */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Projects Created</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats?.workload.totalProjects ?? '—'}</span>
            <span className="text-xs font-semibold text-emerald-400">
              {stats?.workload.completedProjects ?? 0} Completed
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Tasks: {stats?.workload.totalTasks ?? 0}</span>
            <span>Done: {stats?.workload.completedTasks ?? 0}</span>
          </div>
        </div>

        {/* Storage Volume */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Storage</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {formatBytes(stats?.workload.totalStorageBytes || 0)}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {stats?.workload.totalFiles ?? 0} Files
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Messages: {stats?.workload.totalMessages ?? 0}</span>
            <span>Tickets: {stats?.support.pendingTickets ?? 0} open</span>
          </div>
        </div>
      </div>

      {/* ── 30-DAY REGISTRATION VELOCITY CHART ── */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              <span>30-Day User Registration Velocity</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily new signups across individual and company workspace registrations
            </p>
          </div>

          {hoveredBar && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              {hoveredBar.label}: <span className="font-bold text-white">{hoveredBar.count} signups</span>
            </div>
          )}
        </div>

        {/* SVG Interactive Bar Chart */}
        <div className="h-48 w-full flex items-end gap-1 sm:gap-2 pt-4 px-2">
          {stats?.signupTrend.map((day, idx) => {
            const heightPercent = Math.max(8, Math.round((day.count / maxSignupCount) * 100));

            return (
              <div
                key={day.date}
                onMouseEnter={() => setHoveredBar({ label: day.label, count: day.count })}
                onMouseLeave={() => setHoveredBar(null)}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
              >
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    day.count > 0
                      ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-500 group-hover:to-indigo-300 group-hover:shadow-lg group-hover:shadow-indigo-500/30'
                      : 'bg-slate-800/50 group-hover:bg-slate-700'
                  }`}
                />
                {idx % 5 === 0 && (
                  <span className="text-[9px] text-slate-500 whitespace-nowrap hidden sm:inline">
                    {day.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RATIOS & QUICK ACTION PANELS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Types Breakdown */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Account Distribution</h3>
            <span className="text-xs font-semibold text-slate-400">Total Workspaces: {stats?.workspaces.total}</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300">🏢 Multi-Member Company Teams</span>
                <span className="text-indigo-400 font-bold">
                  {stats?.workspaces.company ?? 0} (
                  {stats?.workspaces.total
                    ? Math.round(((stats.workspaces.company || 0) / stats.workspaces.total) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      stats?.workspaces.total
                        ? ((stats.workspaces.company || 0) / stats.workspaces.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300">👤 Solo / Individual Workspaces</span>
                <span className="text-amber-400 font-bold">
                  {stats?.workspaces.individual ?? 0} (
                  {stats?.workspaces.total
                    ? Math.round(((stats.workspaces.individual || 0) / stats.workspaces.total) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      stats?.workspaces.total
                        ? ((stats.workspaces.individual || 0) / stats.workspaces.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Active vs Suspended Accounts:</span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <UserCheck className="h-3.5 w-3.5" /> {stats?.users.active ?? 0} Active
                </span>
                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                  <UserX className="h-3.5 w-3.5" /> {stats?.users.suspended ?? 0} Suspended
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Operations Navigation */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Platform Administration</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Direct access to platform governance tools, user management drawers, and system diagnostics.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/admin-portal/users"
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 hover:border-indigo-500/40 hover:bg-slate-800/40 transition-all group"
              >
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                    Manage Users
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Search, suspend, password reset</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin-portal/workspaces"
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 hover:border-purple-500/40 hover:bg-slate-800/40 transition-all group"
              >
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                    Workspaces
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Audit plans, storage & idle orgs</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin-portal/support"
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 hover:border-emerald-500/40 hover:bg-slate-800/40 transition-all group"
              >
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Support Queue
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {stats?.support.pendingTickets || 0} pending inquiries
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin-portal/system"
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 hover:border-blue-500/40 hover:bg-slate-800/40 transition-all group"
              >
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                    System Health
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Database, memory, SMTP tests</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Database Node: MongoDB Atlas Primary</span>
            <span>Security: 2FA Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
