'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { DocumentItem, FileItem, Meeting, Project, Task } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  ArrowRight, Building2, CalendarDays, CheckSquare, Clock3, FileText,
  FolderOpen, Loader2, MessageSquare, Users, X,
} from 'lucide-react';

type ProjectActivity = { id: string; type: string; title: string; createdAt: string; href?: string };
type ClientActivity = { _id: string; senderName: string; content: string; createdAt: string };
type RequestComment = { authorType: 'client'|'team'; authorName: string; content: string; createdAt: string };
type ProjectRequest = { _id: string; title: string; description: string; status: string; clientUserId?: { fullName: string } | string; comments: RequestComment[]; createdAt: string };
type ApprovalHistory = { actorName: string; status: string; comment?: string; createdAt: string };
type ProjectApproval = { _id: string; targetType: string; targetId: string; title: string; description?: string; requesterName: string; approverType: 'employee'|'client'; approverId: string; approverName: string; status: string; history: ApprovalHistory[] };
type ClientApprover = { id: string; fullName: string; sharedProjects: string[]; sharedMeetings: string[]; sharedDocuments: string[]; sharedFiles: string[] };
type ProjectConnectedData = {
  project: Project;
  tasks: Task[];
  meetings: Meeting[];
  documents: DocumentItem[];
  files: FileItem[];
  clientActivity: ClientActivity[];
  clientRequests: ProjectRequest[];
  approvals: ProjectApproval[];
  clientApprovers: ClientApprover[];
  activity: ProjectActivity[];
  access: { meetings: boolean; resources: boolean; clientActivity: boolean };
};

type ProjectTab = 'overview' | 'work' | 'activity';

function projectCompanyName(project: Project): string | undefined {
  return typeof project.crmCompanyId === 'object' ? project.crmCompanyId.name : undefined;
}

function taskAssigneeName(task: Task): string | undefined {
  return typeof task.assigneeId === 'object' ? task.assigneeId?.fullName : undefined;
}

function meetingProjectName(meeting: Meeting): string | undefined {
  return meeting.projectId?.name;
}

function meetingContactNames(meeting: Meeting): string[] {
  return (meeting.crmContactIds ?? []).map((contact) => `${contact.firstName} ${contact.lastName}`);
}

function userSummary(value: unknown): { id: string; name: string } | undefined {
  if (typeof value !== 'object' || value === null || !('_id' in value) || !('fullName' in value)) return undefined;
  const item = value as { _id?: unknown; fullName?: unknown };
  return typeof item._id === 'string' && typeof item.fullName === 'string' ? { id: item._id, name: item.fullName } : undefined;
}

export function Project360Drawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const user = useAuthStore((state) => state.user);
  const canManage = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';
  const [data, setData] = useState<ProjectConnectedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [approvalTarget, setApprovalTarget] = useState('');
  const [approvalApproverType, setApprovalApproverType] = useState<'employee'|'client'>('employee');
  const [approvalApproverId, setApprovalApproverId] = useState('');
  const [approvalTitle, setApprovalTitle] = useState('');
  const [approvalDescription, setApprovalDescription] = useState('');
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestReplies, setRequestReplies] = useState<Record<string, string>>({});
  const [approvalReply, setApprovalReply] = useState('');
  const [respondingApprovalId, setRespondingApprovalId] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/projects/${project._id}/connected-data`)
      .then((response) => { if (active) setData(response.data); })
      .catch((requestError: unknown) => {
        const message = typeof requestError === 'object' && requestError !== null && 'response' in requestError
          ? (requestError as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;
        if (active) setError(typeof message === 'string' ? message : 'Project details could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project._id]);

  const memberApprovers = data ? [
    userSummary(data.project.managerId),
    userSummary(data.project.assigneeId),
    ...(data.project.members ?? []).map((member) => userSummary(member.userId)),
  ].filter((item): item is { id: string; name: string } => Boolean(item)).filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index) : [];

  const targetOptions = data ? [
    { type: 'project', id: data.project._id, label: `Project · ${data.project.name}` },
    ...data.tasks.map((task) => ({ type: 'task', id: task._id, label: `Task · ${task.title}` })),
    ...data.meetings.map((meeting) => ({ type: 'meeting', id: meeting._id, label: `Meeting · ${meeting.title}` })),
    ...data.documents.map((document) => ({ type: 'document', id: document._id, label: `Document · ${document.title}` })),
    ...data.files.map((file) => ({ type: 'file', id: file._id, label: `File · ${file.name}` })),
  ] : [];
  const [approvalTargetType, approvalTargetId] = approvalTarget.split(':');
  const eligibleClientApprovers = (data?.clientApprovers ?? []).filter((client) => {
    if (approvalTargetType === 'project') return client.sharedProjects.includes(data!.project._id);
    if (approvalTargetType === 'meeting') return client.sharedMeetings.includes(approvalTargetId);
    if (approvalTargetType === 'document') return client.sharedDocuments.includes(approvalTargetId);
    if (approvalTargetType === 'file') return client.sharedFiles.includes(approvalTargetId);
    return false;
  });

  const createApproval = async () => {
    if (!data || !canManage || !approvalTargetId || !approvalApproverId || approvalSaving) return;
    setApprovalSaving(true);
    setApprovalError('');
    const payload = {
      targetType: approvalTargetType,
      targetId: approvalTargetId,
      title: approvalTitle.trim() || undefined,
      description: approvalDescription.trim() || undefined,
      ...(approvalApproverType === 'client' ? { clientUserId: approvalApproverId } : { approverUserId: approvalApproverId }),
    };
    try {
      const response = await api.post('/approvals', payload);
      setData((current) => current ? { ...current, approvals: [response.data.approval, ...current.approvals] } : current);
      setApprovalTarget('');
      setApprovalApproverId('');
      setApprovalTitle('');
      setApprovalDescription('');
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined;
      setApprovalError(typeof message === 'string' ? message : 'Approval could not be requested.');
    } finally {
      setApprovalSaving(false);
    }
  };

  const respondToApproval = async (approval: ProjectApproval, status: 'approved'|'rejected'|'changes_requested') => {
    setRespondingApprovalId(approval._id);
    setApprovalError('');
    try {
      const response = await api.patch(`/approvals/${approval._id}`, { status, comment: approvalReply.trim() || undefined });
      setData((current) => current ? { ...current, approvals: current.approvals.map((item) => item._id === approval._id ? response.data.approval : item) } : current);
      setApprovalReply('');
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined;
      setApprovalError(typeof message === 'string' ? message : 'Approval response could not be saved.');
    } finally {
      setRespondingApprovalId('');
    }
  };

  const updateRequestStatus = async (request: ProjectRequest, status: string) => {
    setRequestError('');
    try {
      const response = await api.patch(`/client-portal/requests/${request._id}`, { status, content: requestReplies[request._id]?.trim() || undefined });
      setData((current) => current ? { ...current, clientRequests: current.clientRequests.map((item) => item._id === request._id ? response.data.request : item) } : current);
      setRequestReplies((current) => ({ ...current, [request._id]: '' }));
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined;
      setRequestError(typeof message === 'string' ? message : 'Request status could not be updated.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" aria-label="Close project details" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="project-360-title" className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Project 360</p>
            <h2 id="project-360-title" className="truncate text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{project.name}</h2>
          </div>
          <button type="button" aria-label="Close project details" onClick={onClose} className="btn-ghost h-9 w-9 shrink-0 p-0"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>
            : error ? <p role="alert" className="py-8 text-center text-sm text-rose-600">{error}</p>
            : data && <div className="space-y-5">
              <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                  <span className="badge badge-slate">{data.project.status.replace('_', ' ')}</span>
                  <span>{data.project.progress}% complete</span>
                  {data.project.deadline && <span>· Due {formatDate(data.project.deadline, 'MMM d, yyyy')}</span>}
                </div>
                {projectCompanyName(data.project) && <Link href="/crm" className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--accent)' }}><Building2 className="h-3.5 w-3.5" />{projectCompanyName(data.project)}</Link>}
              </section>
              {data.project.description && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.project.description}</p>}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Tasks', value: data.tasks.length, icon: CheckSquare },
                  { label: 'Meetings', value: data.access.meetings ? data.meetings.length : '—', icon: CalendarDays },
                  { label: 'Docs', value: data.access.resources ? data.documents.length : '—', icon: FileText },
                  { label: 'Files', value: data.access.resources ? data.files.length : '—', icon: FolderOpen },
                ].map(({ label, value, icon: Icon }) => <div key={label} className="border px-3 py-2.5" style={{ borderColor: 'var(--border-color)' }}><div className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}><Icon className="h-3 w-3" />{label}</div><p className="mt-1 text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</p></div>)}
              </div>

              <div role="tablist" aria-label="Project details" className="flex gap-1 overflow-x-auto border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                {([['overview', 'Overview'], ['work', 'Work'], ['activity', 'Activity']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold" style={{ color: tab === value ? 'var(--accent-text)' : 'var(--text-secondary)', background: tab === value ? 'var(--accent-subtle)' : 'transparent' }}>{label}</button>)}
              </div>

              {tab === 'overview' && <div className="space-y-5">
                <section><SectionHeading title="Team" count={data.project.members?.length ?? 0} />{data.project.members?.length ? <div className="mt-2 flex flex-wrap gap-2">{data.project.members.map((member, index) => <span key={`${member.userId?._id ?? index}`} className="inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Users className="h-3 w-3" />{member.userId?.fullName ?? 'Workspace member'}</span>)}</div> : <EmptyLine>No project members listed.</EmptyLine>}</section>
                <section><SectionHeading title="Tasks" count={data.tasks.length} />{data.tasks.length ? <div className="mt-1 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.tasks.slice(0, 8).map((task) => <div key={task._id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.title}</p><p className="mt-0.5 text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{task.status.replace('_', ' ')}{taskAssigneeName(task) ? ` · ${taskAssigneeName(task)}` : ''}{task.dueDate ? ` · ${formatDate(task.dueDate, 'MMM d')}` : ''}</p></div><Link href="/tasks" className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>Tasks</Link></div>)}</div> : <EmptyLine>No tasks are linked to this project.</EmptyLine>}</section>
              </div>}

              {tab === 'work' && <div className="space-y-5">
                <section><SectionHeading title="Meetings" count={data.access.meetings ? data.meetings.length : undefined} />{!data.access.meetings ? <EmptyLine>Meetings are unavailable on this plan.</EmptyLine> : data.meetings.length ? <div className="mt-1 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.meetings.map((meeting) => <div key={meeting._id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meeting.title}</p><span className="badge badge-slate capitalize">{meeting.status}</span></div><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{meeting.scheduledAt ? formatDate(meeting.scheduledAt, 'MMM d, yyyy h:mm a') : 'Time not set'}{meetingProjectName(meeting) ? ` · ${meetingProjectName(meeting)}` : ''}</p><p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>Host: {meeting.hostId?.fullName ?? 'Workspace host'}{meeting.participants.length ? ` · Participants: ${meeting.participants.map((participant) => participant.userId?.fullName ?? 'Member').join(', ')}` : ''}</p>{meetingContactNames(meeting).length > 0 && <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>CRM contacts: {meetingContactNames(meeting).join(', ')}</p>}{meeting.description && <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{meeting.description}</p>}</div>)}</div> : <EmptyLine>No meetings linked to this project.</EmptyLine>}</section>
                <section><SectionHeading title="Documents" count={data.access.resources ? data.documents.length : undefined} />{!data.access.resources ? <EmptyLine>Documents are unavailable on this plan.</EmptyLine> : data.documents.length ? <div className="mt-1 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.documents.map((document) => <Link key={document._id} href="/docs" className="flex items-center justify-between gap-3 py-2.5"><span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} /><span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{document.title}</span></span><span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{document.type.replace('_', ' ')}</span></Link>)}</div> : <EmptyLine>No documents linked to this project.</EmptyLine>}</section>
                <section><SectionHeading title="Files" count={data.access.resources ? data.files.length : undefined} />{!data.access.resources ? <EmptyLine>Files are unavailable on this plan.</EmptyLine> : data.files.length ? <div className="mt-1 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.files.map((file) => <Link key={file._id} href="/files" className="flex items-center justify-between gap-3 py-2.5"><span className="flex min-w-0 items-center gap-2"><FolderOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} /><span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</span></span><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(file.createdAt, 'MMM d, yyyy')}</span></Link>)}</div> : <EmptyLine>No files linked to this project.</EmptyLine>}</section>
                <section className="space-y-3">
                  <SectionHeading title="Approvals" count={data.approvals.length} />
                  {canManage && <div className="space-y-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <select aria-label="Approval target" value={approvalTarget} onChange={(event) => { setApprovalTarget(event.target.value); setApprovalApproverId(''); }} className="input-base h-9 w-full text-xs">
                      <option value="">Choose a project item…</option>
                      {targetOptions.map((target) => <option key={`${target.type}:${target.id}`} value={`${target.type}:${target.id}`}>{target.label}</option>)}
                    </select>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select aria-label="Approver type" value={approvalApproverType} onChange={(event) => { setApprovalApproverType(event.target.value as 'employee'|'client'); setApprovalApproverId(''); }} className="input-base h-9 text-xs">
                        <option value="employee">Team member</option>
                        <option value="client">Client with shared access</option>
                      </select>
                      <select aria-label="Approver" value={approvalApproverId} onChange={(event) => setApprovalApproverId(event.target.value)} className="input-base h-9 text-xs">
                        <option value="">Choose approver…</option>
                        {approvalApproverType === 'employee' ? memberApprovers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>) : eligibleClientApprovers.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
                      </select>
                    </div>
                    <input value={approvalTitle} onChange={(event) => setApprovalTitle(event.target.value)} maxLength={200} placeholder="Approval title (optional)" className="input-base h-9 w-full text-xs" />
                    <textarea value={approvalDescription} onChange={(event) => setApprovalDescription(event.target.value)} maxLength={4000} rows={2} placeholder="What needs to be reviewed?" className="input-base w-full resize-y text-xs" />
                    {approvalError && <p role="alert" className="text-xs text-rose-600">{approvalError}</p>}
                    <button type="button" onClick={() => void createApproval()} disabled={!approvalTargetId || !approvalApproverId || approvalSaving} className="btn-secondary h-8 px-3 text-xs disabled:opacity-50">{approvalSaving ? 'Requesting…' : 'Request approval'}</button>
                  </div>}
                  {data.approvals.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.approvals.map((approval) => <div key={approval._id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{approval.title}</p><p className="mt-1 text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{approval.targetType} · {approval.approverType === 'client' ? 'Client' : 'Team'} approver: {approval.approverName}</p></div><span className="badge badge-slate capitalize">{approval.status.replace('_', ' ')}</span></div>
                    {approval.description && <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{approval.description}</p>}
                    {approval.history.map((entry, index) => <p key={`${approval._id}-history-${index}`} className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.actorName} · {entry.status.replace('_', ' ')}{entry.comment ? ` · ${entry.comment}` : ''} · {formatDate(entry.createdAt, 'MMM d, yyyy h:mm a')}</p>)}
                    {approval.status === 'pending' && approval.approverType === 'employee' && (canManage || approval.approverId === user?._id) && <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={respondingApprovalId === approval._id} onClick={() => void respondToApproval(approval, 'approved')} className="btn-secondary h-7 px-2 text-[10px]">Approve</button><button type="button" disabled={respondingApprovalId === approval._id} onClick={() => void respondToApproval(approval, 'changes_requested')} className="btn-secondary h-7 px-2 text-[10px]">Request changes</button><button type="button" disabled={respondingApprovalId === approval._id} onClick={() => void respondToApproval(approval, 'rejected')} className="btn-ghost h-7 px-2 text-[10px] text-rose-600">Reject</button></div>}
                  </div>)}</div> : <EmptyLine>No approvals exist for this project yet.</EmptyLine>}
                </section>

                {canManage && <section className="space-y-3">
                  <SectionHeading title="Client requests" count={data.clientRequests.length} />
                  {requestError && <p role="alert" className="text-xs text-rose-600">{requestError}</p>}
                  {data.clientRequests.length ? <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.clientRequests.map((request) => <div key={request._id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{request.title}</p><select aria-label={`Status for ${request.title}`} value={request.status} onChange={(event) => void updateRequestStatus(request, event.target.value)} className="input-base h-8 text-[10px]"><option value="submitted">Submitted</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></div>
                    <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{typeof request.clientUserId === 'object' ? request.clientUserId.fullName : 'Client'} · {formatDate(request.createdAt, 'MMM d, yyyy')}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>{request.description}</p>
                    {request.comments.map((comment, index) => <p key={`${request._id}-comment-${index}`} className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{comment.authorName}: {comment.content}</p>)}
                    <input value={requestReplies[request._id] ?? ''} onChange={(event) => setRequestReplies((current) => ({ ...current, [request._id]: event.target.value }))} maxLength={4000} placeholder="Reply to client" className="input-base mt-2 h-8 w-full text-xs" onKeyDown={(event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) { event.preventDefault(); void updateRequestStatus(request, request.status); } }} />
                  </div>)}</div> : <EmptyLine>No client requests are recorded for this project.</EmptyLine>}
                </section>}
              </div>}

              {tab === 'activity' && <div className="space-y-5">
                {data.access.clientActivity && <section><SectionHeading title="Client Portal activity" count={data.clientActivity.length} />{data.clientActivity.length ? <div className="mt-1 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{data.clientActivity.map((message) => <div key={message._id} className="flex gap-3 py-3"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} /><div className="min-w-0"><p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{message.senderName}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{message.content}</p><p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(message.createdAt, 'MMM d, yyyy h:mm a')}</p></div></div>)}</div> : <EmptyLine>No client messages are recorded for this project.</EmptyLine>}</section>}
                <section><SectionHeading title="Project activity" count={data.activity.length} />{data.activity.length ? <div className="mt-1">{data.activity.map((event) => <div key={event.id} className="flex gap-3 border-l py-2 pl-3" style={{ borderColor: 'var(--border-color)' }}><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} /><div className="min-w-0"><p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</p><p className="mt-0.5 text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{event.type.replace('_', ' ')} · {formatDate(event.createdAt, 'MMM d, yyyy h:mm a')}</p>{event.href && <Link href={event.href} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>Open source <ArrowRight className="h-3 w-3" /></Link>}</div></div>)}</div> : <EmptyLine>No project activity is recorded.</EmptyLine>}</section>
              </div>}
            </div>
          }
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