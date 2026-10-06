'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { CrmCompany, CrmContact, CrmDeal, DocumentItem, FileItem, Meeting, Project, Task } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  ArrowRight, Building2, CalendarDays, CheckSquare, CircleDollarSign, Clock3,
  ExternalLink, FileText, FolderOpen, Loader2, MessageSquare, Users, X,
} from 'lucide-react';

type CompanyActivity = { id: string; type: string; title: string; createdAt: string; href?: string };
type ClientActivity = { _id: string; senderName: string; content: string; createdAt: string };
type ClientPortalResources = {
  clients: { id: string; fullName: string; projectIds: string[] }[];
  documents: DocumentItem[];
  files: FileItem[];
};
type CompanyRequest = { _id: string; title: string; description: string; status: string; clientUserId?: { fullName: string } | string; projectId?: { name: string } | string; comments: { authorName: string; authorType: 'client'|'team'; content: string; createdAt: string }[]; createdAt: string };
type CompanyApproval = { _id: string; targetType: string; title: string; description?: string; requesterName: string; approverType: 'employee'|'client'; approverId: string; approverName: string; status: string; history: { actorName: string; status: string; comment?: string; createdAt: string }[] };
type Company360 = CrmCompany & {
  contacts: CrmContact[];
  deals: CrmDeal[];
  activity: CompanyActivity[];
};
type ConnectedAccess = { projects: boolean; meetings: boolean; resources: boolean; clientActivity: boolean };
type CompanyTab = 'overview' | 'work' | 'activity';

function linkedCompanyId(value: Project['crmCompanyId']): string | undefined {
  return typeof value === 'string' ? value : value?._id;
}

function taskProjectId(value: Task['projectId']): string | undefined {
  return typeof value === 'string' ? value : value?._id;
}

function meetingContactNames(meeting: Meeting): string[] {
  return (meeting.crmContactIds ?? []).map((contact) => `${contact.firstName} ${contact.lastName}`);
}

function formatValue(value: number | undefined, currency = 'USD') {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function getApiErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === 'string' ? response.data.message : undefined;
}

export function Company360Drawer({ company, onClose }: { company: CrmCompany; onClose: () => void }) {
  const user = useAuthStore((state) => state.user);
  const canManage = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';
  const [detail, setDetail] = useState<Company360 | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [clientActivity, setClientActivity] = useState<ClientActivity[]>([]);
  const [clientPortal, setClientPortal] = useState<ClientPortalResources | null>(null);
  const [clientRequests, setClientRequests] = useState<CompanyRequest[]>([]);
  const [approvals, setApprovals] = useState<CompanyApproval[]>([]);
  const [requestReplies, setRequestReplies] = useState<Record<string, string>>({});
  const [workflowError, setWorkflowError] = useState('');
  const [respondingApprovalId, setRespondingApprovalId] = useState('');
  const [activity, setActivity] = useState<CompanyActivity[]>([]);
  const [access, setAccess] = useState<ConnectedAccess>({ projects: false, meetings: false, resources: false, clientActivity: false });
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTab, setActiveTab] = useState<CompanyTab>('overview');
  const [loading, setLoading] = useState(true);
  const [workUnavailable, setWorkUnavailable] = useState(false);
  const [linking, setLinking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setWorkUnavailable(false);
      const [companyResult, workResult] = await Promise.allSettled([
        api.get(`/crm/companies/${company._id}`),
        api.get(`/crm/companies/${company._id}/connected-work`),
      ]);
      if (!active) return;

      if (companyResult.status === 'rejected') {
        setActionError(getApiErrorMessage(companyResult.reason) ?? 'Company details could not be loaded.');
        setDetail(null);
        setLoading(false);
        return;
      }

      setDetail(companyResult.value.data.company as Company360);
      if (workResult.status === 'fulfilled') {
        const connected = workResult.value.data;
        setProjects(connected.projects as Project[]);
        setTasks(connected.tasks as Task[]);
        setMeetings(connected.meetings as Meeting[]);
        setDocuments(connected.documents as DocumentItem[]);
        setFiles(connected.files as FileItem[]);
        setClientActivity(connected.clientActivity as ClientActivity[]);
        setClientPortal(connected.clientPortal as ClientPortalResources | null);
        setClientRequests(connected.clientRequests as CompanyRequest[]);
        setApprovals(connected.approvals as CompanyApproval[]);
        setActivity(connected.activity as CompanyActivity[]);
        setAccess(connected.access as ConnectedAccess);
        if (canManage && connected.access.projects) {
          try {
            const response = await api.get('/projects?limit=200');
            if (active && response.data.success) {
              setAvailableProjects((response.data.projects as Project[]).filter((project) => !linkedCompanyId(project.crmCompanyId)));
            }
          } catch {
            if (active) setAvailableProjects([]);
          }
        }
      } else {
        setProjects([]);
        setTasks([]);
        setMeetings([]);
        setDocuments([]);
        setFiles([]);
        setClientActivity([]);
        setClientPortal(null);
        setClientRequests([]);
        setApprovals([]);
        setActivity([]);
        setAccess({ projects: false, meetings: false, resources: false, clientActivity: false });
        setAvailableProjects([]);
        setWorkUnavailable(true);
      }
      if (active) setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [company._id, canManage, refreshKey]);

  const linkProject = async () => {
    if (!canManage || !selectedProjectId || linking) return;
    setLinking(true);
    setActionError('');
    try {
      await api.patch(`/projects/${selectedProjectId}`, { crmCompanyId: company._id });
      setSelectedProjectId('');
      setRefreshKey((value) => value + 1);
    } catch (error: unknown) {
      setActionError(getApiErrorMessage(error) ?? 'Project could not be linked.');
    } finally {
      setLinking(false);
    }
  };

  const updateClientRequest = async (request: CompanyRequest, status: string) => {
    setWorkflowError('');
    try {
      const response = await api.patch(`/client-portal/requests/${request._id}`, { status, content: requestReplies[request._id]?.trim() || undefined });
      setClientRequests((current) => current.map((item) => item._id === request._id ? response.data.request : item));
      setRequestReplies((current) => ({ ...current, [request._id]: '' }));
    } catch (error: unknown) {
      setWorkflowError(getApiErrorMessage(error) ?? 'Client request could not be updated.');
    }
  };

  const respondToApproval = async (approval: CompanyApproval, status: 'approved'|'rejected'|'changes_requested') => {
    setRespondingApprovalId(approval._id);
    setWorkflowError('');
    try {
      const response = await api.patch(`/approvals/${approval._id}`, { status });
      setApprovals((current) => current.map((item) => item._id === approval._id ? response.data.approval : item));
    } catch (error: unknown) {
      setWorkflowError(getApiErrorMessage(error) ?? 'Approval response could not be saved.');
    } finally {
      setRespondingApprovalId('');
    }
  };

  const clientVisibleProjectIds = new Set(clientPortal?.clients.flatMap((client) => client.projectIds) ?? []);
  const clientVisibleProjects = projects.filter((project) => clientVisibleProjectIds.has(project._id));

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" aria-label="Close company details" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="company-360-title" className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}><Building2 className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Client 360</p>
              <h2 id="company-360-title" className="truncate text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{company.name}</h2>
            </div>
          </div>
          <button type="button" aria-label="Close company details" onClick={onClose} className="btn-ghost h-9 w-9 shrink-0 p-0"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading && !detail ? (
            <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>
          ) : detail ? (
            <div className="space-y-5">
              <section className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{detail.industry || 'Company'}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{[detail.domain, detail.city, detail.country].filter(Boolean).join(' · ') || 'No company details added'}</p>
                </div>
                {detail.website && <a href={detail.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--accent)' }}>Website <ExternalLink className="h-3.5 w-3.5" /></a>}
              </section>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: 'Contacts', value: detail.contacts.length, icon: Users },
                  { label: 'Deals', value: detail.deals.length, icon: CircleDollarSign },
                  { label: 'Projects', value: access.projects && !workUnavailable ? projects.length : '—', icon: Building2 },
                  { label: 'Tasks', value: access.projects && !workUnavailable ? tasks.length : '—', icon: CheckSquare },
                  { label: 'Meetings', value: access.meetings && !workUnavailable ? meetings.length : '—', icon: CalendarDays },
                  { label: 'Documents & files', value: access.resources && !workUnavailable ? documents.length + files.length : '—', icon: FolderOpen },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="border px-3 py-2.5" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}><Icon className="h-3 w-3" />{label}</div>
                    <p className="mt-1 text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {actionError && <p role="alert" className="text-xs text-rose-600">{actionError}</p>}
              {workflowError && <p role="alert" className="text-xs text-rose-600">{workflowError}</p>}

              <div role="tablist" aria-label="Company details" className="flex gap-1 overflow-x-auto border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                {([
                  ['overview', 'Overview'],
                  ['work', 'Work'],
                  ['activity', 'Activity'],
                ] as const).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold" style={{ color: activeTab === tab ? 'var(--accent-text)' : 'var(--text-secondary)', background: activeTab === tab ? 'var(--accent-subtle)' : 'transparent' }}>{label}</button>)}
              </div>

              {activeTab === 'overview' && <div className="space-y-6">
                <section>
                  <SectionHeading title="Contacts" count={detail.contacts.length} />
                  {detail.contacts.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {detail.contacts.map((contact) => <div key={contact._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.firstName} {contact.lastName}</p><p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{contact.jobTitle || contact.email || 'Contact'}</p></div>
                      <span className="badge badge-slate shrink-0">{contact.status}</span>
                    </div>)}
                  </div> : <EmptyLine>No contacts linked to this company.</EmptyLine>}
                </section>
                <section>
                  <SectionHeading title="Deals" count={detail.deals.length} />
                  {detail.deals.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {detail.deals.map((deal) => <div key={deal._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{deal.title}</p><p className="mt-0.5 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{deal.stage.replace('_', ' ')}{deal.closeDate ? ` · closes ${formatDate(deal.closeDate, 'MMM d, yyyy')}` : ''}</p></div>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatValue(deal.value, deal.currency)}</span>
                    </div>)}
                  </div> : <EmptyLine>No deals linked to this company.</EmptyLine>}
                </section>
              </div>}

              {activeTab === 'work' && <div className="space-y-6">
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionHeading title="Projects & tasks" count={access.projects && !workUnavailable ? projects.length : undefined} />
                    {canManage && access.projects && availableProjects.length > 0 && <div className="flex w-full gap-2 sm:w-auto">
                      <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} aria-label="Select project to link" className="input-base h-9 min-w-0 flex-1 text-xs sm:w-56 sm:flex-none">
                        <option value="">Link an existing project…</option>
                        {availableProjects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
                      </select>
                      <button type="button" onClick={() => void linkProject()} disabled={!selectedProjectId || linking} className="btn-secondary h-9 px-3 text-xs disabled:opacity-50">{linking ? 'Linking…' : 'Link'}</button>
                    </div>}
                  </div>
                  {workUnavailable ? <EmptyLine>Connected project work could not be loaded.</EmptyLine>
                    : !access.projects ? <EmptyLine>Projects and tasks are unavailable on this plan.</EmptyLine>
                    : projects.length ? <div className="mt-2 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {projects.map((project) => {
                        const projectTasks = tasks.filter((task) => taskProjectId(task.projectId) === project._id);
                        return <div key={project._id} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</p><p className="mt-0.5 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{project.status.replace('_', ' ')} · {project.progress}% complete{project.deadline ? ` · due ${formatDate(project.deadline, 'MMM d, yyyy')}` : ''}</p></div>
                            <Link href="/projects" className="shrink-0 text-xs font-semibold" style={{ color: 'var(--accent)' }}>Projects <ArrowRight className="ml-1 inline h-3 w-3" /></Link>
                          </div>
                          {projectTasks.length ? <div className="mt-2 space-y-1 border-l pl-3" style={{ borderColor: 'var(--border-color)' }}>{projectTasks.slice(0, 5).map((task) => <p key={task._id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}><CheckSquare className="h-3 w-3 shrink-0" />{task.title}<span className="ml-auto capitalize" style={{ color: 'var(--text-muted)' }}>{task.status.replace('_', ' ')}</span></p>)}{projectTasks.length > 5 && <Link href="/tasks" className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>View all {projectTasks.length} tasks</Link>}</div> : <EmptyLine>No tasks linked to this project.</EmptyLine>}
                        </div>;
                      })}
                    </div> : <EmptyLine>No projects linked to this company.</EmptyLine>}
                </section>

                <section>
                  <SectionHeading title="Meetings" count={access.meetings && !workUnavailable ? meetings.length : undefined} />
                  {!access.meetings ? <EmptyLine>Meetings are unavailable on this plan.</EmptyLine>
                    : workUnavailable ? <EmptyLine>Meetings could not be loaded.</EmptyLine>
                    : meetings.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{meetings.map((meeting) => <div key={meeting._id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meeting.title}</p><span className="badge badge-slate capitalize">{meeting.status}</span></div>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{meeting.scheduledAt ? formatDate(meeting.scheduledAt, 'MMM d, yyyy h:mm a') : 'Time not set'}{meeting.projectId ? ` · ${meeting.projectId.name}` : ''}</p>
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>Host: {meeting.hostId?.fullName ?? 'Workspace host'}{meeting.participants.length ? ` · Participants: ${meeting.participants.map((participant) => participant.userId?.fullName ?? 'Member').join(', ')}` : ''}</p>
                      {meetingContactNames(meeting).length > 0 && <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>CRM contacts: {meetingContactNames(meeting).join(', ')}</p>}
                      {meeting.description && <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{meeting.description}</p>}
                      {meeting.aiSummary?.summary && <p className="mt-2 line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Tavro summary: {meeting.aiSummary.summary}</p>}
                      <Link href="/meetings" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>Open meetings <ArrowRight className="h-3 w-3" /></Link>
                    </div>)}</div> : <EmptyLine>No meetings linked to this company or its projects.</EmptyLine>}
                </section>

                <section>
                  <SectionHeading title="Documents" count={access.resources && !workUnavailable ? documents.length : undefined} />
                  {!access.resources ? <EmptyLine>Documents are unavailable on this plan.</EmptyLine>
                    : documents.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{documents.map((document) => <Link key={document._id} href="/docs" className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} /><span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{document.title}</span></span>
                      <span className="shrink-0 text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{document.type.replace('_', ' ')}</span>
                    </Link>)}</div> : <EmptyLine>No documents linked to this company’s projects.</EmptyLine>}
                </section>

                <section>
                  <SectionHeading title="Files" count={access.resources && !workUnavailable ? files.length : undefined} />
                  {!access.resources ? <EmptyLine>Files are unavailable on this plan.</EmptyLine>
                    : files.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{files.map((file) => <Link key={file._id} href="/files" className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2"><FolderOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} /><span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</span></span>
                      <span className="shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(file.createdAt, 'MMM d, yyyy')}</span>
                    </Link>)}</div> : <EmptyLine>No files linked to this company’s projects.</EmptyLine>}
                </section>
              </div>}

              {activeTab === 'activity' && <div className="space-y-6">
                <section>
                  <SectionHeading title="Approvals" count={approvals.length} />
                  {approvals.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{approvals.map((approval) => <div key={approval._id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{approval.title}</p><p className="mt-0.5 text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{approval.targetType} · {approval.approverType === 'client' ? 'Client' : 'Team'} approver: {approval.approverName}</p></div><span className="badge badge-slate capitalize">{approval.status.replace('_', ' ')}</span></div>
                    {approval.description && <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{approval.description}</p>}
                    {approval.history.map((entry, index) => <p key={`${approval._id}-history-${index}`} className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.actorName} · {entry.status.replace('_', ' ')}{entry.comment ? ` · ${entry.comment}` : ''} · {formatDate(entry.createdAt, 'MMM d, yyyy h:mm a')}</p>)}
                    {approval.status === 'pending' && approval.approverType === 'employee' && (canManage || approval.approverId === user?._id) && <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={respondingApprovalId === approval._id} onClick={() => void respondToApproval(approval, 'approved')} className="btn-secondary h-7 px-2 text-[10px]">Approve</button><button type="button" disabled={respondingApprovalId === approval._id} onClick={() => void respondToApproval(approval, 'changes_requested')} className="btn-secondary h-7 px-2 text-[10px]">Request changes</button><button type="button" disabled={respondingApprovalId === approval._id} onClick={() => void respondToApproval(approval, 'rejected')} className="btn-ghost h-7 px-2 text-[10px] text-rose-600">Reject</button></div>}
                  </div>)}</div> : <EmptyLine>No approvals are recorded for this company’s projects.</EmptyLine>}
                </section>
                {access.clientActivity && <>
                  <section>
                    <SectionHeading title="Client requests" count={clientRequests.length} />
                    {clientRequests.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{clientRequests.map((request) => <div key={request._id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{request.title}</p><select aria-label={`Status for ${request.title}`} value={request.status} onChange={(event) => void updateClientRequest(request, event.target.value)} className="input-base h-8 text-[10px]"><option value="submitted">Submitted</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></div>
                      <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{typeof request.clientUserId === 'object' ? request.clientUserId.fullName : 'Client'}{typeof request.projectId === 'object' ? ` · ${request.projectId.name}` : ''} · {formatDate(request.createdAt, 'MMM d, yyyy')}</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>{request.description}</p>
                      {request.comments.map((comment, index) => <p key={`${request._id}-comment-${index}`} className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{comment.authorName}: {comment.content}</p>)}
                      <input value={requestReplies[request._id] ?? ''} onChange={(event) => setRequestReplies((current) => ({ ...current, [request._id]: event.target.value }))} maxLength={4000} placeholder="Reply to client" className="input-base mt-2 h-8 w-full text-xs" onKeyDown={(event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) { event.preventDefault(); void updateClientRequest(request, request.status); } }} />
                    </div>)}</div> : <EmptyLine>No client requests are linked to this company’s projects.</EmptyLine>}
                  </section>

                  <section>
                    <SectionHeading title="Client-visible work" count={clientVisibleProjects.length} />
                    {clientPortal?.clients.length ? <div className="mt-1 space-y-2">
                      {clientPortal.clients.map((client) => {
                        const sharedProjects = clientVisibleProjects.filter((project) => client.projectIds.includes(project._id));
                        return <div key={client.id} className="border-b py-2.5 last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{client.fullName}</p>
                          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{sharedProjects.length ? `Shared projects: ${sharedProjects.map((project) => project.name).join(', ')}` : 'No linked project shared'}</p>
                        </div>;
                      })}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{clientPortal?.documents.length ?? 0} shared document{clientPortal?.documents.length === 1 ? '' : 's'}</span>
                        <span>{clientPortal?.files.length ?? 0} shared file{clientPortal?.files.length === 1 ? '' : 's'}</span>
                      </div>
                      {(clientPortal?.documents.length ?? 0) > 0 && <div className="space-y-1">{clientPortal?.documents.slice(0, 5).map((document) => <Link key={document._id} href="/docs" className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--accent)' }}><FileText className="h-3.5 w-3.5" />{document.title}</Link>)}</div>}
                      {(clientPortal?.files.length ?? 0) > 0 && <div className="space-y-1">{clientPortal?.files.slice(0, 5).map((file) => <Link key={file._id} href="/files" className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--accent)' }}><FolderOpen className="h-3.5 w-3.5" />{file.name}</Link>)}</div>}
                    </div> : <EmptyLine>No active clients are connected to projects linked to this company.</EmptyLine>}
                  </section>
                  <section>
                    <SectionHeading title="Client Portal messages" count={clientActivity.length} />
                    {clientActivity.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{clientActivity.map((message) => <div key={message._id} className="flex gap-3 py-3">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                      <div className="min-w-0"><p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{message.senderName}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{message.content}</p><p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(message.createdAt, 'MMM d, yyyy h:mm a')}</p></div>
                    </div>)}</div> : <EmptyLine>No client messages are recorded for the linked projects.</EmptyLine>}
                  </section>
                </>}
                <section>
                  <SectionHeading title="Company activity" count={activity.length} />
                  {activity.length ? <div className="mt-1 space-y-0">{activity.map((item) => <div key={item.id} className="flex gap-3 border-l py-2 pl-3" style={{ borderColor: 'var(--border-color)' }}>
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                    <div className="min-w-0"><p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</p><p className="mt-0.5 text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{item.type.replace('_', ' ')} · {formatDate(item.createdAt, 'MMM d, yyyy h:mm a')}</p>{item.href && <Link href={item.href} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>Open source <ArrowRight className="h-3 w-3" /></Link>}</div>
                  </div>)}</div> : <EmptyLine>No recorded company activity yet.</EmptyLine>}
                </section>
              </div>}
            </div>
          ) : <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{actionError || 'Company details unavailable.'}</div>}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}{count !== undefined && <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{count}</span>}</h3>;
}

function EmptyLine({ children }: { children: string }) {
  return <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{children}</p>;
}