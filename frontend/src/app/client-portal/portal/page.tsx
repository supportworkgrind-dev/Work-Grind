'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { SkeletonLine } from '@/components/common/LoadingSkeleton';
import {
  Briefcase, FolderClosed, Video, FileText,
  MessageSquare, Send, LogOut, Clock, ClipboardList, ShieldCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/apiConfig';

const API_BASE = getApiBaseUrl();

interface ClientUser { _id: string; email: string; fullName: string; avatar?: string; }
interface Project    { _id: string; name: string; status: string; progress: number; color?: string; deadline?: string; }
interface FileItem   { _id: string; name: string; mimeType: string; size: number; }
interface MeetingItem { _id: string; title: string; status: string; scheduledAt?: string; meetingLink: string; }
interface DocItem    { _id: string; title: string; type: string; }
interface ChatMsg    { _id?: string; senderType: 'client'|'team'; senderName: string; content: string; createdAt?: string; }
interface PortalRequest { _id: string; title: string; description: string; status: string; projectId: string | { _id: string; name: string }; createdAt: string; updatedAt: string; comments: { authorName: string; authorType: 'client'|'team'; content: string; createdAt: string }[]; }
interface PortalApproval { _id: string; title: string; description?: string; targetType: string; status: 'pending'|'approved'|'rejected'|'changes_requested'; dueAt?: string; requesterName: string; history: { actorName: string; status: string; comment?: string; createdAt: string }[]; }
interface ClientPortalData { client: ClientUser; projects: Project[]; files: FileItem[]; meetings: MeetingItem[]; docs: DocItem[]; messages: ChatMsg[]; }

function clientApi(token: string) {
  return axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === 'string' ? response.data.message : fallback;
}

export default function ClientPortalPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [portal,  setPortal]  = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalError, setPortalError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [tab,     setTab]     = useState<'projects'|'files'|'meetings'|'docs'|'messages'|'requests'|'approvals'>('projects');
  const [msgInput, setMsgInput] = useState('');
  const [sending,  setSending]  = useState(false);
  const [msgs,     setMsgs]     = useState<ChatMsg[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [approvals, setApprovals] = useState<PortalApproval[]>([]);
  const [requestProjectId, setRequestProjectId] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [requestComments, setRequestComments] = useState<Record<string, string>>({});
  const [requestCommentError, setRequestCommentError] = useState('');
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [approvalError, setApprovalError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('workgrind_client_token');
    if (!t) { router.push('/client-portal'); return; }
    tokenRef.current = t;

    clientApi(t).get('/client-portal/portal')
      .then(async r => {
        setPortal(r.data.portal);
        setMsgs(r.data.portal.messages ?? []);
        const [requestResult, approvalResult] = await Promise.allSettled([
          clientApi(t).get('/client-portal/portal/requests'),
          clientApi(t).get('/client-portal/portal/approvals'),
        ]);
        if (requestResult.status === 'fulfilled') setRequests(requestResult.value.data.requests ?? []);
        if (approvalResult.status === 'fulfilled') setApprovals(approvalResult.value.data.approvals ?? []);
      })
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('workgrind_client_token');
          router.push('/client-portal');
          return;
        }
        setPortalError(apiErrorMessage(error, 'Your client portal could not be loaded. Please try again.'));
      })
      .finally(() => setLoading(false));
  }, [retryCount, router]);

  function logout() {
    localStorage.removeItem('workgrind_client_token');
    localStorage.removeItem('workgrind_client_user');
    router.push('/client-portal');
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const token = tokenRef.current;
    if (!msgInput.trim() || !token) return;
    setSending(true);
    try {
      const r = await clientApi(token).post('/client-portal/portal/messages', { content: msgInput.trim() });
      setMsgs(prev => [...prev, r.data.message]);
      setMsgInput('');
    } catch {} finally { setSending(false); }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    const token = tokenRef.current;
    if (!token || !requestProjectId || !requestTitle.trim() || !requestDescription.trim()) return;
    setRequestSending(true);
    setRequestError('');
    try {
      const response = await clientApi(token).post('/client-portal/portal/requests', {
        projectId: requestProjectId,
        title: requestTitle.trim(),
        description: requestDescription.trim(),
      });
      setRequests((current) => [response.data.request, ...current]);
      setRequestTitle('');
      setRequestDescription('');
    } catch (error: unknown) {
      setRequestError(apiErrorMessage(error, 'Your request could not be submitted.'));
    } finally {
      setRequestSending(false);
    }
  }

  async function respondToApproval(approval: PortalApproval, status: 'approved'|'rejected'|'changes_requested') {
    const token = tokenRef.current;
    if (!token) return;
    setApprovalError('');
    try {
      const response = await clientApi(token).patch(`/client-portal/portal/approvals/${approval._id}`, {
        status,
        comment: approvalComments[approval._id] || undefined,
      });
      setApprovals((current) => current.map((item) => item._id === approval._id ? response.data.approval : item));
      setApprovalComments((current) => ({ ...current, [approval._id]: '' }));
    } catch (error: unknown) {
      setApprovalError(apiErrorMessage(error, 'Your approval response could not be saved.'));
    }
  }

  async function addRequestComment(request: PortalRequest) {
    const token = tokenRef.current;
    if (!token || !requestComments[request._id]?.trim()) return;
    setRequestCommentError('');
    try {
      const response = await clientApi(token).post(`/client-portal/portal/requests/${request._id}/comments`, { content: requestComments[request._id].trim() });
      setRequests((current) => current.map((item) => item._id === request._id ? response.data.request : item));
      setRequestComments((current) => ({ ...current, [request._id]: '' }));
    } catch (error: unknown) {
      setRequestCommentError(apiErrorMessage(error, 'Your comment could not be sent.'));
    }
  }

  if (loading) {
    return (
      <div className="theme-scope min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="space-y-3 w-64">
          <SkeletonLine className="h-8 w-48 mx-auto" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-3/4 mx-auto" />
        </div>
      </div>
    );
  }

  if (portalError) {
    return (
      <div className="theme-scope min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg-base)' }}>
        <section className="w-full max-w-md border p-6 sm:p-8" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--wg-radius-panel)' }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--accent)' }}>CLIENT PORTAL</p>
          <h1 className="mb-3 text-2xl" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, "Times New Roman", serif' }}>We couldn’t open your workspace.</h1>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }} role="alert">{portalError}</p>
          <button
            type="button"
            className="btn-primary min-h-10 px-4"
            onClick={() => {
              setPortalError('');
              setLoading(true);
              setRetryCount((count) => count + 1);
            }}
          >
            Try again
          </button>
        </section>
      </div>
    );
  }

  const TABS = [
    { id: 'projects'  as const, label: 'Projects',  icon: Briefcase,    count: portal?.projects?.length  },
    { id: 'files'     as const, label: 'Files',      icon: FolderClosed, count: portal?.files?.length     },
    { id: 'meetings'  as const, label: 'Meetings',   icon: Video,        count: portal?.meetings?.length  },
    { id: 'docs'      as const, label: 'Documents',  icon: FileText,     count: portal?.docs?.length      },
    { id: 'messages'  as const, label: 'Messages',   icon: MessageSquare,count: msgs.length               },
    { id: 'requests'  as const, label: 'Requests',   icon: ClipboardList,count: requests.length           },
    { id: 'approvals' as const, label: 'Approvals',  icon: ShieldCheck,  count: approvals.filter((item) => item.status === 'pending').length },
  ];

  return (
    <div className="theme-scope min-h-screen" data-workspace-shell="client-portal" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b h-14 flex items-center px-4 sm:px-6 justify-between"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <ThemeAwareLogo size="sm" showWordmark />
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold theme-text-primary hidden sm:block">{portal?.client?.fullName}</span>
          <button onClick={logout} className="btn-ghost h-8 w-8 p-0 rounded-lg" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6" data-workspace="client-portal">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight theme-text-primary">
            Welcome back, {portal?.client?.fullName?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm theme-text-secondary mt-1">Here&apos;s your shared workspace overview</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl border w-full overflow-x-auto" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
                tab === t.id ? 'text-white shadow-sm' : 'theme-text-muted'
              }`}
              style={tab === t.id ? { background: 'var(--accent)' } : {}}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {(t.count ?? 0) > 0 && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tab === t.id ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Projects */}
        {tab === 'projects' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(portal?.projects ?? []).length === 0 ? (
              <div className="col-span-2 text-center py-12 text-sm theme-text-muted">No projects shared with you yet.</div>
            ) : (portal?.projects ?? []).map((p: Project) => (
              <div key={p._id} className="surface-interactive surface rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color ?? '#6366f1' }} />
                  <h3 className="text-sm font-bold theme-text-primary truncate">{p.name}</h3>
                  <span className={`badge ml-auto shrink-0 text-[10px] ${p.status === 'active' ? 'badge-blue' : p.status === 'completed' ? 'badge-emerald' : 'badge-slate'}`}>{p.status}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs theme-text-muted mb-1.5">
                    <span>Progress</span><span className="font-semibold theme-text-secondary">{p.progress ?? 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${p.progress ?? 0}%`, background: p.color ?? '#6366f1' }} />
                  </div>
                </div>
                {p.deadline && <p className="text-[11px] theme-text-muted flex items-center gap-1"><Clock className="h-3 w-3" />Deadline: {formatDate(p.deadline, 'MMM d, yyyy')}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Files */}
        {tab === 'files' && (
          <div className="surface rounded-2xl overflow-hidden">
            {(portal?.files ?? []).length === 0 ? (
              <div className="text-center py-12 text-sm theme-text-muted">No files shared with you yet.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {(portal?.files ?? []).map((f: FileItem) => (
                  <div key={f._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
                    <FolderClosed className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold theme-text-primary truncate">{f.name}</p>
                      <p className="text-[11px] theme-text-muted">{f.mimeType} · {(f.size/1024/1024).toFixed(1)}MB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meetings */}
        {tab === 'meetings' && (
          <div className="space-y-3">
            {(portal?.meetings ?? []).length === 0 ? (
              <div className="text-center py-12 text-sm theme-text-muted">No meetings shared with you yet.</div>
            ) : (portal?.meetings ?? []).map((m: MeetingItem) => (
              <div key={m._id} className="surface-interactive surface rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold theme-text-primary">{m.title}</h3>
                    {m.scheduledAt && <p className="text-xs theme-text-muted mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(m.scheduledAt, 'MMM d, yyyy · h:mm a')}</p>}
                  </div>
                  <span className={`badge text-[10px] shrink-0 ${m.status === 'active' ? 'badge-rose' : m.status === 'ended' ? 'badge-slate' : 'badge-blue'}`}>{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Docs */}
        {tab === 'docs' && (
          <div className="space-y-3">
            {(portal?.docs ?? []).length === 0 ? (
              <div className="text-center py-12 text-sm theme-text-muted">No documents shared with you yet.</div>
            ) : (portal?.docs ?? []).map((d: DocItem) => (
              <div key={d._id} className="surface-interactive surface rounded-2xl p-4 flex items-center gap-3">
                <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold theme-text-primary truncate">{d.title}</p>
                  <p className="text-[11px] theme-text-muted capitalize">{d.type.replace('_',' ')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {tab === 'messages' && (
          <div className="surface rounded-2xl overflow-hidden flex flex-col" style={{ height: 480 }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.length === 0 && (
                <div className="text-center py-12 text-sm theme-text-muted">No messages yet. Say hello!</div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.senderType === 'client' ? 'flex-row-reverse' : ''}`}>
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: m.senderType === 'client' ? 'var(--accent)' : '#64748b' }}>
                    {(m.senderName ?? 'T')[0].toUpperCase()}
                  </div>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${m.senderType === 'client' ? 'text-white' : 'theme-text-primary'}`}
                    style={{ background: m.senderType === 'client' ? 'var(--accent)' : 'var(--bg-hover)' }}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="border-t flex gap-2 p-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Send a message to your account team…"
                className="input-premium flex-1 text-sm"
              />
              <button type="submit" disabled={sending || !msgInput.trim()} className="btn-primary h-10 px-3">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-6">
            {portal?.projects?.length ? <form onSubmit={submitRequest} className="space-y-3 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-sm font-bold theme-text-primary">Submit a project request</h2>
              <select value={requestProjectId} onChange={(event) => setRequestProjectId(event.target.value)} required className="input-base h-10 w-full text-sm">
                <option value="">Choose a shared project</option>
                {portal.projects.map((project: Project) => <option key={project._id} value={project._id}>{project.name}</option>)}
              </select>
              <input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} maxLength={200} required placeholder="Request title" className="input-base h-10 w-full text-sm" />
              <textarea value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} maxLength={4000} required rows={3} placeholder="Describe what you need" className="input-base w-full resize-y text-sm" />
              {requestError && <p role="alert" className="text-xs text-rose-600">{requestError}</p>}
              <button type="submit" disabled={requestSending} className="btn-primary h-9 px-4 text-xs disabled:opacity-50">{requestSending ? 'Submitting…' : 'Submit request'}</button>
            </form> : <p className="border-b pb-5 text-sm theme-text-muted" style={{ borderColor: 'var(--border-subtle)' }}>A shared project is required to submit a request.</p>}

            <section>
              <h2 className="text-sm font-bold theme-text-primary">Your requests <span className="ml-1 text-xs font-medium theme-text-muted">{requests.length}</span></h2>
              {requests.length === 0 ? <p className="py-8 text-center text-sm theme-text-muted">No requests yet.</p> : <div className="mt-2 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {requests.map((request) => <article key={request._id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold theme-text-primary">{request.title}</h3><p className="mt-1 text-xs theme-text-muted">{typeof request.projectId === 'object' ? request.projectId.name : 'Shared project'} · {formatDate(request.createdAt, 'MMM d, yyyy')}</p></div><span className="badge badge-slate capitalize">{request.status.replace('_', ' ')}</span></div>
                  <p className="mt-2 whitespace-pre-wrap text-sm theme-text-secondary">{request.description}</p>
                  {request.comments.length > 0 && <div className="mt-3 space-y-2 border-l pl-3" style={{ borderColor: 'var(--border-color)' }}>{request.comments.map((comment, index) => <p key={`${request._id}-comment-${index}`} className="text-xs"><span className="font-semibold theme-text-primary">{comment.authorName}</span><span className="theme-text-muted"> · {comment.content}</span></p>)}</div>}
                  {request.status !== 'resolved' && request.status !== 'rejected' && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={requestComments[request._id] ?? ''} onChange={(event) => setRequestComments((current) => ({ ...current, [request._id]: event.target.value }))} maxLength={4000} placeholder="Add a comment" className="input-base h-9 min-w-0 flex-1 text-xs" /><button type="button" onClick={() => void addRequestComment(request)} disabled={!requestComments[request._id]?.trim()} className="btn-secondary h-9 px-3 text-xs disabled:opacity-50">Comment</button></div>}
                </article>)}
              </div>}
              {requestCommentError && <p role="alert" className="mt-2 text-xs text-rose-600">{requestCommentError}</p>}
            </section>
          </div>
        )}

        {tab === 'approvals' && (
          <section>
            <h2 className="text-sm font-bold theme-text-primary">Approvals <span className="ml-1 text-xs font-medium theme-text-muted">{approvals.length}</span></h2>
            {approvalError && <p role="alert" className="mt-2 text-xs text-rose-600">{approvalError}</p>}
            {approvals.length === 0 ? <p className="py-8 text-center text-sm theme-text-muted">No approvals have been shared with you.</p> : <div className="mt-2 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {approvals.map((approval) => <article key={approval._id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold theme-text-primary">{approval.title}</h3><p className="mt-1 text-xs capitalize theme-text-muted">{approval.targetType} · requested by {approval.requesterName}</p></div><span className="badge badge-slate capitalize">{approval.status.replace('_', ' ')}</span></div>
                {approval.description && <p className="mt-2 text-sm theme-text-secondary">{approval.description}</p>}
                <div className="mt-3 space-y-1 border-l pl-3" style={{ borderColor: 'var(--border-color)' }}>{approval.history.map((entry, index) => <p key={`${approval._id}-history-${index}`} className="text-xs"><span className="font-semibold theme-text-primary">{entry.actorName}</span><span className="theme-text-muted"> · {entry.status.replace('_', ' ')}{entry.comment ? ` · ${entry.comment}` : ''}</span></p>)}</div>
                {approval.status === 'pending' && <div className="mt-3 space-y-2"><textarea value={approvalComments[approval._id] ?? ''} onChange={(event) => setApprovalComments((current) => ({ ...current, [approval._id]: event.target.value }))} maxLength={4000} rows={2} placeholder="Optional response comment" className="input-base w-full resize-y text-xs" /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void respondToApproval(approval, 'approved')} className="btn-primary h-8 px-3 text-xs">Approve</button><button type="button" onClick={() => void respondToApproval(approval, 'changes_requested')} className="btn-secondary h-8 px-3 text-xs">Request changes</button><button type="button" onClick={() => void respondToApproval(approval, 'rejected')} className="btn-ghost h-8 px-3 text-xs text-rose-600">Reject</button></div></div>}
              </article>)}
            </div>}
          </section>
        )}
      </main>
    </div>
  );
}
