'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/LoadingSkeleton';
import {
  Shield, AlertTriangle, CheckCircle2, Clock, X,
  ChevronDown, Filter, Eye, Trash2, UserX, MessageSquare,
  BarChart3, Flag, RefreshCw, ChevronRight, Gavel,
  AlertCircle, Info,
} from 'lucide-react';
import { formatDate, formatTimeAgo } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface ModerationAction {
  _id: string;
  moderatorId: { _id: string; fullName: string; avatar?: string };
  action: string;
  note?: string;
  timestamp: string;
}

interface Report {
  _id: string;
  reporterId: { _id: string; fullName: string; avatar?: string; email: string };
  targetType: 'message' | 'user' | 'conversation';
  targetId: string;
  targetSnapshot?: {
    content?: string;
    senderName?: string;
    senderId?: string;
    conversationId?: string;
    channelId?: string;
    createdAt?: string;
  };
  reason: string;
  details?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  actions: ModerationAction[];
  assignedTo?: { fullName: string; avatar?: string };
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalOpen: number;
  totalReviewing: number;
  resolvedToday: number;
  highSeverityOpen: number;
  reportsThisWeek: number;
  totalReports: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  low:      'badge badge-slate',
  medium:   'badge badge-blue',
  high:     'badge badge-amber',
  critical: 'badge badge-rose',
};

const STATUS_BADGE: Record<string, string> = {
  open:       'badge badge-rose',
  reviewing:  'badge badge-amber',
  resolved:   'badge badge-emerald',
  dismissed:  'badge badge-slate',
};

const REASON_LABELS: Record<string, string> = {
  harassment:            'Harassment',
  spam:                  'Spam',
  inappropriate_content: 'Inappropriate Content',
  hate_speech:           'Hate Speech',
  violence:              'Violence',
  privacy_violation:     'Privacy Violation',
  other:                 'Other',
};

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  REVIEWED:        { label: 'Mark as Reviewing', icon: <Eye className="h-3.5 w-3.5" />,        color: 'text-blue-600 hover:bg-blue-50' },
  MESSAGE_DELETED: { label: 'Delete Message',    icon: <Trash2 className="h-3.5 w-3.5" />,     color: 'text-rose-600 hover:bg-rose-50' },
  USER_WARNED:     { label: 'Warn User',         icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 hover:bg-amber-50' },
  USER_SUSPENDED:  { label: 'Suspend User',      icon: <UserX className="h-3.5 w-3.5" />,       color: 'text-rose-600 hover:bg-rose-50' },
  RESOLVED:        { label: 'Resolve Report',    icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600 hover:bg-emerald-50' },
  DISMISSED:       { label: 'Dismiss Report',    icon: <X className="h-3.5 w-3.5" />,           color: 'text-slate-500 hover:bg-slate-100' },
  ESCALATED:       { label: 'Escalate',          icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-purple-600 hover:bg-purple-50' },
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function ModerationPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'owner' && user.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const [reports,       setReports]       = useState<Report[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [selectedReport,setSelectedReport]= useState<Report | null>(null);
  const [liveContent,   setLiveContent]   = useState<any>(null);
  const [actionNote,    setActionNote]    = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);

  // Filters
  const [filterStatus,     setFilterStatus]     = useState('all');
  const [filterSeverity,   setFilterSeverity]   = useState('all');
  const [filterTargetType, setFilterTargetType] = useState('all');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterStatus     !== 'all') params.set('status',     filterStatus);
      if (filterSeverity   !== 'all') params.set('severity',   filterSeverity);
      if (filterTargetType !== 'all') params.set('targetType', filterTargetType);

      const [rRes, sRes] = await Promise.all([
        api.get(`/moderation/reports?${params}`),
        api.get('/moderation/reports/stats'),
      ]);
      if (rRes.data.success) { setReports(rRes.data.reports); setTotal(rRes.data.total); }
      if (sRes.data.success) setStats(sRes.data.stats);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, filterStatus, filterSeverity, filterTargetType]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const openReport = async (r: Report) => {
    setSelectedReport(r);
    setLiveContent(null);
    setActionNote('');
    try {
      const res = await api.get(`/moderation/reports/${r._id}`);
      if (res.data.success) {
        setSelectedReport(res.data.report);
        setLiveContent(res.data.liveContent);
      }
    } catch { /* silent */ }
  };

  const handleAction = async (action: string) => {
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/moderation/reports/${selectedReport._id}/action`, {
        action,
        note: actionNote.trim() || undefined,
      });
      if (res.data.success) {
        setSelectedReport(res.data.report);
        setActionNote('');
        // Refresh list
        setReports((p) => p.map((r) => r._id === res.data.report._id ? res.data.report : r));
        await fetchReports();
      }
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return null;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-subtle)' }}>
            <Shield className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
          </div>
          <div>
            <h1 className="page-title">Moderation Center</h1>
            <p className="page-subtitle">Review reports, manage safety, and take moderator actions</p>
          </div>
        </div>
        <button onClick={fetchReports} className="btn-secondary h-9 px-3 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /><span>Refresh</span>
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Open',          value: stats.totalOpen,         color: 'var(--error-text)',   tray: 'icon-tray-rose'    },
            { label: 'Reviewing',     value: stats.totalReviewing,    color: 'var(--warning-text)', tray: 'icon-tray-amber'   },
            { label: 'High Priority', value: stats.highSeverityOpen,  color: 'var(--accent-text)',  tray: 'icon-tray-purple'  },
            { label: 'Resolved Today',value: stats.resolvedToday,     color: 'var(--success-text)', tray: 'icon-tray-emerald' },
            { label: 'This Week',     value: stats.reportsThisWeek,   color: 'var(--info-text)',    tray: 'icon-tray-blue'    },
            { label: 'Total Reports', value: stats.totalReports,      color: 'var(--text-secondary)', tray: 'icon-tray-indigo' },
          ].map((s) => (
            <div key={s.label} className="stat-tile">
              <p className="text-[11px] font-semibold theme-text-muted mb-1">{s.label}</p>
              <p className="text-2xl font-black tabular-nums" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: 'Status',   value: filterStatus,     setter: setFilterStatus,
            options: ['all','open','reviewing','resolved','dismissed'] },
          { label: 'Severity', value: filterSeverity,   setter: setFilterSeverity,
            options: ['all','low','medium','high','critical'] },
          { label: 'Type',     value: filterTargetType, setter: setFilterTargetType,
            options: ['all','message','user','conversation'] },
        ].map((f) => (
          <select
            key={f.label}
            value={f.value}
            onChange={(e) => { f.setter(e.target.value); setPage(1); }}
            className="rounded-xl border px-3 py-1.5 text-xs font-medium theme-text-secondary focus-ring capitalize"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
          >
            {f.options.map((o) => (
              <option key={o} value={o} className="capitalize">{o === 'all' ? `All ${f.label}s` : o.replace('_', ' ')}</option>
            ))}
          </select>
        ))}
        <span className="ml-auto text-xs theme-text-muted">{total} report{total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Reports List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <PageSkeleton />
          ) : reports.length === 0 ? (
            <EmptyState icon={Shield} title="No reports found" description="No moderation reports match the current filters." compact />
          ) : (
            reports.map((r) => (
              <button
                key={r._id}
                onClick={() => openReport(r)}
                className={`w-full text-left surface rounded-2xl p-4 card-hover transition-all border-2 ${
                  selectedReport?._id === r._id
                    ? 'border-[var(--accent)]'
                    : 'border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={r.reporterId?.fullName ?? '?'} src={r.reporterId?.avatar} size="sm" className="shrink-0 mt-0.5" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={SEVERITY_BADGE[r.severity]}>{r.severity}</span>
                      <span className={STATUS_BADGE[r.status]}>{r.status}</span>
                      <span className="badge badge-slate capitalize">{r.targetType}</span>
                    </div>
                    <p className="text-[13px] font-semibold theme-text-primary">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </p>
                    <p className="text-[11px] theme-text-secondary mt-0.5">
                      Reported by <span className="font-semibold">{r.reporterId?.fullName ?? 'Unknown'}</span>
                    </p>
                    {r.targetSnapshot?.content && (
                      <p className="text-[11px] theme-text-muted mt-1.5 line-clamp-2 break-words bg-[var(--bg-base)] rounded-lg px-2 py-1.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
                        "{r.targetSnapshot.content}"
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-[10px] theme-text-muted">{formatTimeAgo(r.createdAt)}</p>
                    {r.actions.length > 0 && (
                      <p className="text-[10px] theme-text-muted">{r.actions.length} action{r.actions.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">Prev</button>
              <span className="text-xs theme-text-muted">Page {page} of {Math.ceil(total / 20)}</span>
              <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)} className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedReport ? (
          <div className="surface rounded-2xl overflow-hidden sticky top-20">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-bold theme-text-primary">Report Detail</span>
              </div>
              <button onClick={() => setSelectedReport(null)} className="btn-ghost h-7 w-7 p-0 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[calc(100vh-14rem)] overflow-y-auto">

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={SEVERITY_BADGE[selectedReport.severity]}>{selectedReport.severity} severity</span>
                <span className={STATUS_BADGE[selectedReport.status]}>{selectedReport.status}</span>
                <span className="badge badge-slate capitalize">{selectedReport.targetType}</span>
              </div>

              {/* Reporter */}
              <div>
                <p className="section-label mb-2">Reporter</p>
                <div className="flex items-center gap-2.5">
                  <Avatar name={selectedReport.reporterId?.fullName ?? '?'} src={selectedReport.reporterId?.avatar} size="sm" />
                  <div>
                    <p className="text-xs font-semibold theme-text-primary">{selectedReport.reporterId?.fullName}</p>
                    <p className="text-[11px] theme-text-muted">{selectedReport.reporterId?.email}</p>
                  </div>
                </div>
              </div>

              {/* Reason & Details */}
              <div>
                <p className="section-label mb-1.5">Reason</p>
                <p className="text-sm font-semibold theme-text-primary">{REASON_LABELS[selectedReport.reason] ?? selectedReport.reason}</p>
                {selectedReport.details && (
                  <p className="text-xs theme-text-secondary mt-1 leading-relaxed break-words">{selectedReport.details}</p>
                )}
              </div>

              {/* Reported content snapshot */}
              {selectedReport.targetSnapshot?.content && (
                <div>
                  <p className="section-label mb-1.5">Reported Content (snapshot)</p>
                  <div className="rounded-xl border p-3 text-xs theme-text-secondary break-words leading-relaxed" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                    <p className="theme-text-muted mb-1">From: <span className="font-semibold theme-text-secondary">{selectedReport.targetSnapshot.senderName}</span></p>
                    <p>"{selectedReport.targetSnapshot.content}"</p>
                  </div>
                </div>
              )}

              {/* Live content if still available */}
              {liveContent && selectedReport.targetType === 'message' && liveContent.deletedAt == null && (
                <div>
                  <p className="section-label mb-1.5">Live Message State</p>
                  <div className="rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar name={liveContent.senderId?.fullName ?? '?'} src={liveContent.senderId?.avatar} size="xs" />
                      <span className="text-[11px] font-semibold theme-text-primary">{liveContent.senderId?.fullName}</span>
                      <span className="text-[10px] theme-text-muted">{formatTimeAgo(liveContent.createdAt)}</span>
                    </div>
                    <p className="theme-text-secondary break-words">{liveContent.content}</p>
                  </div>
                </div>
              )}

              {/* Moderation timeline */}
              {selectedReport.actions.length > 0 && (
                <div>
                  <p className="section-label mb-2">Moderation Timeline</p>
                  <div className="space-y-2">
                    {selectedReport.actions.map((a) => (
                      <div key={a._id} className="flex items-start gap-2.5 text-xs">
                        <Avatar name={a.moderatorId?.fullName ?? '?'} src={a.moderatorId?.avatar} size="xs" className="shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold theme-text-primary">{a.moderatorId?.fullName}</span>
                            <span className="badge badge-slate">{a.action.replace(/_/g, ' ')}</span>
                          </div>
                          {a.note && <p className="theme-text-secondary mt-0.5 break-words">{a.note}</p>}
                          <p className="text-[10px] theme-text-muted mt-0.5">{formatTimeAgo(a.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedReport.status !== 'resolved' && selectedReport.status !== 'dismissed' && (
                <div>
                  <p className="section-label mb-2">Take Action</p>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Optional moderator note (visible in audit trail)…"
                    rows={2}
                    className="input-base text-xs resize-none mb-3"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ACTION_LABELS).map(([key, { label, icon, color }]) => (
                      // Show MESSAGE_DELETED only for message reports, USER_* only for user reports
                      (key === 'MESSAGE_DELETED' && selectedReport.targetType !== 'message') ? null :
                      (['USER_WARNED','USER_SUSPENDED'].includes(key) && selectedReport.targetType === 'message') ? null :
                      (
                        <button
                          key={key}
                          onClick={() => handleAction(key)}
                          disabled={actionLoading}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${color}`}
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          {icon}
                          <span>{label}</span>
                        </button>
                      )
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] theme-text-muted text-center pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                Report filed {formatDate(selectedReport.createdAt, 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        ) : (
          <div className="surface rounded-2xl p-8 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-20 theme-text-muted" />
            <p className="text-sm theme-text-secondary font-medium">Select a report to review</p>
            <p className="text-xs theme-text-muted mt-1">Click any report on the left to see details and take action</p>
          </div>
        )}
      </div>
    </div>
  );
}
