'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Project } from '@/types';
import { EmptyState } from '@/components/common/EmptyState';
import { Avatar } from '@/components/common/Avatar';
import { CreateProjectModal } from '@/components/modals/CreateProjectModal';
import { Project360Drawer } from '@/components/projects/Project360Drawer';
import {
  Briefcase, Plus, Calendar, ArrowRight, Hash, Building2,
  CheckCircle2, Clock,
} from 'lucide-react';
import { formatDate, getInitials } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active:    'badge badge-emerald',
  planning:  'badge badge-blue',
  on_hold:   'badge badge-amber',
  completed: 'badge badge-slate',
};
const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'badge badge-rose',
  high:   'badge badge-amber',
  medium: 'badge badge-blue',
  low:    'badge badge-slate',
};

export default function ProjectsPage() {
  const router          = useRouter();
  const { user }        = useAuthStore();
  const { openCreateModal } = useAppStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filter,   setFilter]   = useState('all');
  const [loading,  setLoading]  = useState(true);

  const fetchProjects = async () => {
    try { setLoading(true);
      const r = await api.get('/projects');
      if (r.data.success) setProjects(r.data.projects);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onCreated = (p: Project) => setProjects((prev) => { if (prev.some((x) => x._id === p._id)) return prev; return [p, ...prev]; });
    const onUpdated = (p: Project) => setProjects((prev) => prev.map((x) => x._id === p._id ? p : x));
    s.on('project:created', onCreated);
    s.on('project:updated', onUpdated);
    return () => { s.off('project:created', onCreated); s.off('project:updated', onUpdated); };
  }, []);

  const filtered = projects.filter((p) => filter === 'all' || p.status === filter);

  const FILTERS = ['all', 'active', 'planning', 'on_hold', 'completed'];

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Track initiatives, milestones, and team progress</p>
        </div>
        {(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager') && (
          <button onClick={() => openCreateModal('project')} className="btn-primary h-9 px-4 shrink-0">
            <Plus className="h-3.5 w-3.5" /><span>New Project</span>
          </button>
        )}
      </div>

      {/* ── FILTER TABS ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
              filter === f
                ? 'text-[var(--text-on-accent)] shadow-xs'
                : 'theme-text-secondary hover:theme-bg-hover'
            }`}
            style={filter === f ? { background: 'var(--accent)' } : {}}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* ── GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="rounded-2xl border p-6 space-y-4 skeleton-shimmer h-52" style={{ borderColor: 'var(--border-color)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects found"
          description="Start a new project to coordinate your team's roadmap and deliverables."
          actionLabel="Create Project"
          onAction={() => openCreateModal('project')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((proj) => {
            const assignee = (proj.assigneeId || proj.managerId) as any;
            const channelObj = proj.channelId && typeof proj.channelId === 'object' ? proj.channelId as any : null;
            const channelId  = channelObj?._id ?? (typeof proj.channelId === 'string' ? proj.channelId : null);
            const channelName = channelObj?.name ?? null;

            return (
              <div
                key={proj._id}
                className="surface rounded-2xl p-5 flex flex-col gap-4 card-hover"
              >
                {/* Top: color swatch + name + badges */}
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-[var(--text-on-accent)] text-sm shadow-xs"
                    style={{ background: proj.color ?? '#4f46e5' }}
                  >
                    {getInitials(proj.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold theme-text-primary truncate">{proj.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={STATUS_STYLES[proj.status] ?? 'badge badge-slate'}>
                        {proj.status.replace('_', ' ')}
                      </span>
                      {proj.priority && (
                        <span className={PRIORITY_STYLES[proj.priority] ?? 'badge badge-slate'}>
                          {proj.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {typeof proj.crmCompanyId === 'object' && proj.crmCompanyId && (
                  <p className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--accent-text)' }}>
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{proj.crmCompanyId.name}</span>
                  </p>
                )}
                {proj.description && (
                  <p className="text-[11px] theme-text-secondary line-clamp-2 leading-relaxed">
                    {proj.description}
                  </p>
                )}

                {/* Assignee + members */}
                <div className="flex items-center justify-between text-[11px] theme-text-muted">
                  <div className="flex items-center gap-1.5">
                    {assignee?.fullName && (
                      <>
                        <Avatar name={assignee.fullName} src={assignee.avatar} size="xs" />
                        <span className="truncate max-w-[100px]">{assignee.fullName}</span>
                      </>
                    )}
                  </div>
                  {proj.members && proj.members.length > 0 && (
                    <div className="flex items-center -space-x-1.5">
                      {proj.members.slice(0, 5).map((m: any, idx: number) => {
                        const u = typeof m.userId === 'object' ? m.userId : null;
                        return <Avatar key={idx} name={u?.fullName ?? ''} src={u?.avatar} size="xs" className="ring-2 ring-[var(--bg-card)]" />;
                      })}
                      {proj.members.length > 5 && (
                        <span className="h-6 w-6 rounded-xl flex items-center justify-center text-[9px] font-bold ring-2 ring-[var(--bg-card)]"
                          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                          +{proj.members.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-[11px] theme-text-muted mb-1.5">
                    <span>Progress</span>
                    <span className="font-semibold theme-text-secondary">{proj.progress ?? 0}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${proj.progress ?? 0}%`, background: proj.color ?? 'var(--accent)' }} />
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2 mt-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button type="button" onClick={() => setSelectedProject(proj)} className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>Details <ArrowRight className="ml-1 inline h-3 w-3" /></button>
                  {channelId ? (
                    <Link
                      href={`/chat?channelId=${channelId}`}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors min-w-0"
                    >
                      <Hash className="h-3 w-3 shrink-0" />
                      <span className="truncate">#{channelName ?? 'channel'}</span>
                    </Link>
                  ) : <span />}

                  <span className="text-[10px] theme-text-muted flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3" />
                    {proj.deadline ? formatDate(proj.deadline, 'MMM d') : 'Ongoing'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedProject && <Project360Drawer key={selectedProject._id} project={selectedProject} onClose={() => setSelectedProject(null)} />}
      <CreateProjectModal onCreated={fetchProjects} />
    </div>
  );
}
