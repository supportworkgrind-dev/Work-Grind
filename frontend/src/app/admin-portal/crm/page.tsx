'use client';

/**
 * Admin Portal — CRM Inspector
 *
 * Displays an aggregate view of CRM data across all workspaces the
 * authenticated Super Admin has access to.
 *
 * Security:
 *   - Uses adminApi (Super Admin JWT) — already guarded by layout.tsx
 *   - Calls GET /api/admin/crm-stats (requireRole owner/admin on backend)
 *   - Does NOT expose individual user private data beyond what the
 *     workspace admin already has access to
 *   - Every page load is audit-logged server-side
 */

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/adminApi';
import {
  TrendingUp, Users, Building2, DollarSign,
  CheckCircle2, XCircle, RefreshCw, AlertCircle,
  ArrowRight, BarChart2, User,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

interface StageEntry { count: number; totalValue: number }

interface CrmStats {
  contactCount:  number;
  companyCount:  number;
  openDeals:     number;
  wonDeals:      number;
  lostDeals:     number;
  pipelineValue: number;
  stageMap: Record<string, StageEntry>;
  recentDeals: {
    _id: string; title: string; value?: number; currency: string;
    stage: string; priority: string; closeDate?: string;
    contactId?: { firstName: string; lastName: string; email?: string } | null;
    crmCompanyId?: { name: string } | null;
    ownerId?: { fullName: string; avatar?: string } | null;
    createdAt: string;
  }[];
  recentContacts: {
    _id: string; firstName: string; lastName: string;
    email?: string; status: string; jobTitle?: string;
    crmCompanyId?: { name: string } | null;
    ownerId?: { fullName: string } | null;
    createdAt: string;
  }[];
}

/* ── Constants ─────────────────────────────────────────────────────── */

const STAGES: { key: string; label: string; col: string; bg: string }[] = [
  { key: 'new_lead',    label: 'New Lead',    col: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { key: 'qualified',   label: 'Qualified',   col: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  { key: 'proposal',    label: 'Proposal',    col: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { key: 'negotiation', label: 'Negotiation', col: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  { key: 'won',         label: 'Won',         col: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { key: 'lost',        label: 'Lost',        col: '#f87171', bg: 'rgba(248,113,113,0.12)' },
];

const PRIO_COL: Record<string, string> = {
  urgent: '#ef4444', high: '#f59e0b', medium: '#60a5fa', low: '#94a3b8',
};

const STATUS_COL: Record<string, string> = {
  lead: '#94a3b8', prospect: '#60a5fa', customer: '#34d399', churned: '#f87171', inactive: '#fbbf24',
};

function fmt(val?: number, cur = 'USD') {
  if (!val) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
}

function fmtShort(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

/* ── KPI Card ───────────────────────────────────────────────────────── */

function KpiCard({
  label, value, sub, icon: Icon, iconCol, iconBg,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconCol: string; iconBg: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
          <p className="text-2xl font-extrabold text-white">{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border"
          style={{ background: iconBg, borderColor: iconCol + '30' }}>
          <Icon className="h-5 w-5" style={{ color: iconCol }} />
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */

export default function AdminCrmPage() {
  const [data,    setData]    = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get('/admin/crm-stats');
      if (res.data.success) setData(res.data.crm);
      else setError('Failed to load CRM data.');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to load CRM data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Loading CRM data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-rose-400" />
          <p className="text-sm font-semibold text-white">{error}</p>
          <button onClick={load}
            className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const maxStageCount = Math.max(...STAGES.map(s => data?.stageMap[s.key]?.count ?? 0), 1);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">CRM Inspector</h1>
          <p className="mt-1 text-xs text-slate-400">
            Workspace CRM overview — contacts, companies, deals and pipeline health.
            Data is scoped to the authenticated workspace and respects all access controls.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Contacts"      value={data?.contactCount  ?? 0}         icon={User}        iconCol="#60a5fa" iconBg="rgba(96,165,250,0.1)"  />
        <KpiCard label="Companies"     value={data?.companyCount  ?? 0}         icon={Building2}   iconCol="#a78bfa" iconBg="rgba(167,139,250,0.1)" />
        <KpiCard label="Open Deals"    value={data?.openDeals     ?? 0}         icon={TrendingUp}  iconCol="#fbbf24" iconBg="rgba(251,191,36,0.1)"  />
        <KpiCard label="Won Deals"     value={data?.wonDeals      ?? 0}         icon={CheckCircle2}iconCol="#34d399" iconBg="rgba(52,211,153,0.1)"  />
        <KpiCard label="Lost Deals"    value={data?.lostDeals     ?? 0}         icon={XCircle}     iconCol="#f87171" iconBg="rgba(248,113,113,0.1)" />
        <KpiCard label="Pipeline"      value={fmtShort(data?.pipelineValue ?? 0)} icon={DollarSign}iconCol="#34d399" iconBg="rgba(52,211,153,0.1)"  />
      </div>

      {/* Stage breakdown */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-400" />Pipeline by Stage
        </h2>
        <div className="space-y-3">
          {STAGES.map((s) => {
            const entry  = data?.stageMap[s.key] ?? { count: 0, totalValue: 0 };
            const widthPct = Math.round((entry.count / maxStageCount) * 100);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <span className="text-[11px] font-semibold" style={{ color: s.col }}>{s.label}</span>
                </div>
                <div className="flex-1 h-[6px] rounded-full overflow-hidden bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${widthPct}%`, background: s.col }}
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0 w-40 justify-end">
                  <span className="text-[11px] font-semibold text-slate-300 w-14 text-right">
                    {entry.count} deal{entry.count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 w-20 text-right">
                    {entry.totalValue > 0 ? fmtShort(entry.totalValue) : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-col: recent deals + recent contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Deals */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />Recent Deals
            </h2>
            <span className="text-[11px] text-slate-500">{data?.recentDeals.length ?? 0} shown</span>
          </div>
          {!data?.recentDeals.length ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-500">No deals yet</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {data.recentDeals.map((deal) => {
                const stage = STAGES.find(s => s.key === deal.stage);
                return (
                  <div key={deal._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{deal.title}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {deal.crmCompanyId?.name ?? deal.contactId
                          ? `${deal.contactId?.firstName} ${deal.contactId?.lastName}`
                          : '—'
                        }
                        {deal.ownerId?.fullName && <span className="ml-2 text-slate-600">· {deal.ownerId.fullName}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {deal.value != null && (
                        <span className="text-[11px] font-bold text-emerald-400">{fmt(deal.value, deal.currency)}</span>
                      )}
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: stage?.col, background: stage?.bg }}>
                        {stage?.label ?? deal.stage}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Contacts */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />Recent Contacts
            </h2>
            <span className="text-[11px] text-slate-500">{data?.recentContacts.length ?? 0} shown</span>
          </div>
          {!data?.recentContacts.length ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-500">No contacts yet</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {data.recentContacts.map((c) => (
                <div key={c._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                  {/* Avatar initials */}
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-[9px] font-black text-indigo-300 shrink-0">
                    {(c.firstName[0] ?? '') + (c.lastName[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {c.jobTitle ?? c.email ?? '—'}
                      {c.crmCompanyId?.name && <span className="ml-2 text-slate-600">· {c.crmCompanyId.name}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color:       STATUS_COL[c.status] ?? '#94a3b8',
                        background: (STATUS_COL[c.status] ?? '#94a3b8') + '18',
                      }}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {formatDate(c.createdAt, 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security note */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-400">Access control:</span> This view is restricted to Super Administrators.
          Data shown is scoped to workspace-level permissions. No private user credentials or payment information is exposed here.
          All access to this page is recorded in the platform audit log.
        </p>
      </div>
    </div>
  );
}
