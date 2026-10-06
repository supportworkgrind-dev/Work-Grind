'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonLine } from '@/components/common/LoadingSkeleton';
import { Avatar } from '@/components/common/Avatar';
import {
  UserCircle, Plus, Mail, Trash2, Share2,
  CheckCircle2, Clock, AlertCircle, Send, MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';

interface ClientEntry {
  _id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isVerified: boolean;
  lastSeen?: string;
  sharedProjects: string[];
  sharedFiles:    string[];
  sharedMeetings: string[];
  sharedDocs:     string[];
}

// ── Invite modal ──────────────────────────────────────────────────────────────
function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email,    setEmail]    = useState('');
  const [fullName, setFullName] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [sent,     setSent]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/client-portal/invite', { email: email.trim(), fullName: fullName.trim() });
      setSent(true);
      setTimeout(() => { onInvited(); onClose(); }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to send invitation');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-3xl border shadow-float p-6 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold theme-text-primary">Invite Client</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0 rounded-lg">✕</button>
        </div>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold theme-text-primary">Invitation sent!</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Client Full Name *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" className="input-premium w-full" required />
              </div>
              <div>
                <label className="form-label">Client Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@clientcompany.com" className="input-premium w-full" required />
              </div>
              <p className="text-xs theme-text-muted">An invitation email will be sent with a link to set up their account.</p>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 h-10">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 h-10">
                  <Send className="h-3.5 w-3.5" />{saving ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Message panel ─────────────────────────────────────────────────────────────
function MessagePanel({ client, onClose }: { client: ClientEntry; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await api.post('/client-portal/messages', { clientId: client._id, content: content.trim() });
      setSent(true); setContent('');
      setTimeout(() => setSent(false), 3000);
    } catch {} finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-3xl border shadow-float p-6 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold theme-text-primary">Message {client.fullName}</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0 rounded-lg">✕</button>
        </div>
        {sent && <div className="flex items-center gap-2 text-emerald-600 text-sm"><CheckCircle2 className="h-4 w-4" />Message sent!</div>}
        <form onSubmit={handleSend} className="space-y-3">
          <textarea
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Type your message…"
            className="input-premium w-full resize-none"
            rows={4}
            required
          />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 h-10">Close</button>
            <button type="submit" disabled={sending || !content.trim()} className="btn-primary flex-1 h-10">
              <Send className="h-3.5 w-3.5" />{sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientPortalMgmtPage() {
  const { user } = useAuthStore();
  const canManage = ['owner','admin','manager'].includes(user?.role ?? '');

  const [clients,    setClients]    = useState<ClientEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [messaging,  setMessaging]  = useState<ClientEntry | null>(null);

  function load() {
    api.get('/client-portal/clients')
      .then(r => setClients(r.data.clients))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function removeClient(id: string) {
    if (!confirm('Remove this client? They will lose access to the portal.')) return;
    try {
      await api.delete(`/client-portal/clients/${id}`);
      setClients(prev => prev.filter(c => c._id !== id));
    } catch {}
  }

  return (
    <div className="page-reveal space-y-6 pb-8">
      <PageHeader
        hero
        title="Client Portal"
        subtitle="Manage client access to shared projects, files, and documents"
        icon={UserCircle}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/client-portal"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary h-9 px-3"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Portal
            </a>
            {canManage && (
              <button onClick={() => setShowInvite(true)} className="btn-primary h-9 px-4">
                <Plus className="h-3.5 w-3.5" /> Invite Client
              </button>
            )}
          </div>
        }
      />

      {/* Stats mini-cards */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Clients',    value: clients.length,                              color: 'var(--accent-text)' },
            { label: 'Active',           value: clients.filter(c => c.isActive).length,       color: 'var(--success-text)' },
            { label: 'Pending Invite',   value: clients.filter(c => !c.isVerified).length,    color: 'var(--warning-text)' },
            { label: 'Shared Projects',  value: clients.reduce((s,c) => s + (c.sharedProjects?.length ?? 0), 0), color: 'var(--accent-text)' },
          ].map(stat => (
            <div
              key={stat.label}
              className="surface rounded-2xl p-4 flex flex-col gap-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider theme-text-muted">{stat.label}</span>
              <span className="text-2xl font-black theme-text-primary tabular-nums" style={{ letterSpacing: '-0.04em', color: stat.color }}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <UserCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold theme-text-primary">Client Portal</p>
          <p className="text-xs theme-text-secondary mt-0.5">
            Invite external clients to a secure portal where they can view shared projects, files, meetings, documents, and communicate with your team — without accessing your internal workspace.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="surface rounded-2xl p-5 flex items-center gap-4">
              <SkeletonLine className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <SkeletonLine className="h-4 w-40" />
                <SkeletonLine className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="No clients yet"
          description="Invite your first client to give them a dedicated secure portal."
          actions={canManage ? [{ label: 'Invite Client', onClick: () => setShowInvite(true) }] : []}
        />
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {clients.map(c => (
              <div key={c._id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-hover)] transition-colors">
                <Avatar name={c.fullName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold theme-text-primary">{c.fullName}</span>
                    <span className={`badge text-[10px] ${c.isActive && c.isVerified ? 'badge-emerald' : c.isActive ? 'badge-amber' : 'badge-slate'}`}>
                      {c.isActive && c.isVerified ? 'Active' : c.isActive ? 'Pending' : 'Invited'}
                    </span>
                  </div>
                  <p className="text-xs theme-text-muted mt-0.5 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                    {c.sharedProjects?.length > 0 && <span>{c.sharedProjects.length} project{c.sharedProjects.length !== 1 ? 's' : ''}</span>}
                    {c.lastSeen && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last seen {formatTimeAgo(c.lastSeen)}</span>}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setMessaging(c)} className="btn-ghost h-8 w-8 p-0 rounded-lg" title="Send message">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeClient(c._id)} className="btn-ghost h-8 w-8 p-0 rounded-lg text-rose-500" title="Remove client">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={load} />}
      {messaging  && <MessagePanel client={messaging} onClose={() => setMessaging(null)} />}
    </div>
  );
}
