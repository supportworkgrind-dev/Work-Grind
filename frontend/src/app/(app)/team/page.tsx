'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { User, Meeting } from '@/types';
import { EmptyState } from '@/components/common/EmptyState';
import { Avatar } from '@/components/common/Avatar';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import Link from 'next/link';
import {
  Users, Search, MessageSquare, Video, UserPlus,
  CheckCircle2, X, Play, Radio, PhoneCall,
} from 'lucide-react';

export default function TeamDirectoryPage() {
  const router = useRouter();
  const { user, isAtLimit, refreshSubscription } = useAuthStore();
  const memberLimitReached = isAtLimit('members');
  const isOwnerAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  const [members,       setMembers]       = useState<User[]>([]);
  const onlineUserIds = useRef(new Set<string>());
  const presenceStatusByUser = useRef(new Map<string, User['status']>());
  const [search,        setSearch]        = useState('');
  const [dept,          setDept]          = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [isInviteOpen,  setIsInviteOpen]  = useState(false);
  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviteRole,    setInviteRole]    = useState('employee');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteDone,    setInviteDone]    = useState(false);
  const [liveMeetings,  setLiveMeetings]  = useState<Meeting[]>([]);
  const [starting,      setStarting]      = useState(false);
  const [dmError,       setDmError]       = useState('');

  useEffect(() => {
    api.get('/users').then((r) => {
      if (r.data.success) {
        setMembers((r.data.users as User[]).map((member) => ({
          ...member,
          status: presenceStatusByUser.current.get(member._id)
            ?? (onlineUserIds.current.has(member._id)
              ? member.status === 'busy' || member.status === 'away' ? member.status : 'online'
              : 'offline'),
        })));
      }
    }).catch(() => {});
    api.get('/meetings/active').then((r) => { if (r.data.success) setLiveMeetings(r.data.meetings); }).catch(() => {});

    const s = getSocket();
    if (!s) return;
    const onOnline  = ({ userId }: { userId: string }) => {
      onlineUserIds.current.add(userId);
      const status = presenceStatusByUser.current.get(userId);
      if (!status || status === 'offline') presenceStatusByUser.current.set(userId, 'online');
      setMembers((p) => p.map((m) => m._id === userId ? { ...m, status: presenceStatusByUser.current.get(userId) || 'online' } : m));
    };
    const onOffline = ({ userId }: { userId: string }) => {
      onlineUserIds.current.delete(userId);
      presenceStatusByUser.current.set(userId, 'offline');
      setMembers((p) => p.map((m) => m._id === userId ? { ...m, status: 'offline' } : m));
    };
    const onOnlineList = (ids: string[]) => {
      onlineUserIds.current = new Set(ids);
      setMembers((p) => p.map((m) => ({
        ...m,
        status: onlineUserIds.current.has(m._id)
          ? m.status === 'busy' || m.status === 'away' ? m.status : 'online'
          : 'offline',
      })));
    };
    const onPresenceSnapshot = ({ users }: { users: { userId: string; status: User['status'] }[] }) => {
      onlineUserIds.current = new Set(users.filter((presence) => presence.status !== 'offline').map((presence) => presence.userId));
      presenceStatusByUser.current = new Map(users.map((presence) => [presence.userId, presence.status]));
      setMembers((current) => current.map((member) => ({
        ...member,
        status: presenceStatusByUser.current.get(member._id) || 'offline',
      })));
    };
    const onPresenceChanged = ({ userId, status }: { userId: string; status: User['status'] }) => {
      presenceStatusByUser.current.set(userId, status);
      if (status === 'offline') onlineUserIds.current.delete(userId);
      else onlineUserIds.current.add(userId);
      setMembers((current) => current.map((member) => member._id === userId ? { ...member, status } : member));
    };
    const requestPresenceSnapshot = () => s.emit('presence:sync');
    const onStatus  = ({ userId, status }: { userId: string; status: User['status'] }) => setMembers((p) => p.map((m) => m._id === userId ? {
      ...m,
      status: onlineUserIds.current.has(userId)
        ? status === 'busy' || status === 'away' ? status : 'online'
        : 'offline',
    } : m));
    const onStart   = ({ meeting }: { meeting: Meeting }) => setLiveMeetings((p) => { const ex = p.some((x) => x._id === meeting._id); return ex ? p.map((x) => x._id === meeting._id ? meeting : x) : [meeting, ...p]; });
    const onEnd     = ({ meetingLink }: { meetingLink: string }) => setLiveMeetings((p) => p.filter((m) => m.meetingLink !== meetingLink));
    s.on('user:online', onOnline); s.on('user:offline', onOffline); s.on('user:status-changed', onStatus);
    s.on('users:online-list', onOnlineList);
    s.on('presence:snapshot', onPresenceSnapshot);
    s.on('user:presence', onPresenceChanged);
    s.on('meeting:started', onStart); s.on('meeting:ended', onEnd);
    s.on('connect', requestPresenceSnapshot);
    if (s.connected) requestPresenceSnapshot();
    return () => { s.off('user:online', onOnline); s.off('user:offline', onOffline); s.off('user:status-changed', onStatus); s.off('users:online-list', onOnlineList); s.off('presence:snapshot', onPresenceSnapshot); s.off('user:presence', onPresenceChanged); s.off('connect', requestPresenceSnapshot); s.off('meeting:started', onStart); s.off('meeting:ended', onEnd); };
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const r = await api.post('/users/invite', { email: inviteEmail, role: inviteRole });
      if (r.data.success) { setInviteDone(true); void refreshSubscription(); setTimeout(() => { setIsInviteOpen(false); setInviteDone(false); setInviteEmail(''); }, 1500); }
    } catch { /* silent */ } finally { setInviteLoading(false); }
  };
  const handleInstantMeeting = async () => {
    setStarting(true);
    try {
      const r = await api.post('/meetings', { title: `${user?.fullName?.split(' ')[0] ?? 'Team'}'s Instant Meeting`, isInstant: true });
      if (r.data.success) router.push(`/meetings?join=${r.data.meeting.meetingLink}`);
    } catch { /* silent */ } finally { setStarting(false); }
  };
  const handleDM = async (member: User) => {
    setDmError('');
    if (!member.callingId) {
      setDmError('This user does not have an available WorkGrind User ID.');
      return;
    }
    try {
      const response = await api.post('/direct-messages/conversations', { recipientCallingId: member.callingId });
      const conversationId = response.data?.conversation?._id;
      if (!response.data?.success || typeof conversationId !== 'string') {
        setDmError('The conversation could not be opened. Please try again.');
        return;
      }
      router.push(`/chat?conversationId=${encodeURIComponent(conversationId)}`);
    } catch (error: unknown) {
      setDmError(getApiErrorMessage(error, 'This user is not currently available for direct messages.'));
    }
  };
  const handleCall = async (member: User) => {
    try {
      const r = await api.post('/meetings', { title: `Call with ${member.fullName}`, participantIds: [member._id], isInstant: true });
      if (r.data.success) router.push(`/meetings?join=${r.data.meeting.meetingLink}`);
    } catch { /* silent */ }
  };

  const depts = Array.from(new Set(members.map((m) => m.department).filter(Boolean)));
  const filtered = members.filter((m) => {
    const s = search.toLowerCase();
    const matchSearch = !s || (m.callingId ?? '').toLowerCase().includes(s) || m.fullName.toLowerCase().includes(s) || m.email.toLowerCase().includes(s) || (m.jobTitle ?? '').toLowerCase().includes(s);
    return matchSearch && (dept === 'all' || m.department === dept) && (statusFilter === 'all' || m.status === statusFilter);
  });

  const statusDot: Record<string, string> = { online: 'bg-emerald-500', away: 'bg-amber-400', busy: 'bg-rose-500', offline: 'bg-slate-300' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Team Directory</h1>
          <p className="page-subtitle">Browse your team, check availability, and start conversations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleInstantMeeting} disabled={starting} className="btn-primary h-9 px-4">
            <Play className="h-3.5 w-3.5 fill-white" />
            <span>{starting ? 'Starting...' : 'Instant Meeting'}</span>
          </button>
          {isOwnerAdmin && (memberLimitReached ? (
            <Link href="/billing" className="btn-secondary h-9 px-4">Member limit reached · Upgrade</Link>
          ) : (
            <button onClick={() => setIsInviteOpen(true)} className="btn-secondary h-9 px-4">
              <UserPlus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>Invite Member</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Meeting banner */}
      {liveMeetings.length > 0 && (
        <div className="banner-live p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inset-0 rounded-full bg-rose-400 opacity-75" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              {liveMeetings.length} live meeting{liveMeetings.length > 1 ? 's' : ''} in progress
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveMeetings.map((m) => (
              <div key={m._id} className="surface rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="badge badge-rose text-[9px]">LIVE</span>
                    <p className="text-[13px] font-semibold theme-text-primary truncate">{m.title}</p>
                  </div>
                  <p className="text-[11px] theme-text-muted">Host: {(m.hostId as any)?.fullName ?? 'Team Member'}</p>
                </div>
                <Link href={`/meetings?join=${m.meetingLink}`} className="btn-danger shrink-0 border-rose-400/60 bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" /><span>Join</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 theme-text-muted" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, email, or user ID..."
            className="input-base pl-9 h-9"
          />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)}
          className="rounded-xl border px-3 py-2 text-xs theme-text-secondary focus-ring"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <option value="all">All Departments</option>
          {depts.map((d) => <option key={d} value={d!}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border px-3 py-2 text-xs theme-text-secondary focus-ring"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <option value="all">All Statuses</option>
          <option value="online">Online</option>
          <option value="away">Away</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
      </div>
      <p className="text-[11px] theme-text-muted">Direct messages are available to active users in this workspace. User IDs are searchable within this directory.</p>
      {dmError && <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-600">{dmError}</p>}

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No members found" description="Invite team members to collaborate on projects and tasks." actionLabel={memberLimitReached ? 'Upgrade Plan' : 'Invite Member'} onAction={() => memberLimitReached ? router.push('/billing') : setIsInviteOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((m) => (
            <div key={m._id} className="surface rounded-2xl p-5 flex flex-col gap-4 card-hover">
              <div className="flex items-start justify-between">
                <div className="relative">
                  <Avatar name={m.fullName} src={m.avatar} size="lg" />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-[var(--bg-card)] ${statusDot[m.status ?? 'offline']}`} />
                </div>
                <span className="badge badge-slate uppercase">{m.role}</span>
              </div>

              <div className="flex-1">
                <p className="text-[13px] font-bold theme-text-primary truncate">{m.fullName}</p>
                <p className="text-[11px] theme-text-secondary truncate mt-0.5">{m.jobTitle ?? 'Team Member'}</p>
                <p className="text-[10px] theme-text-muted mt-0.5">{m.department ?? 'General'}</p>
                <p className="mt-1 text-[10px] theme-text-muted">User ID</p>
                <p className="font-mono text-[10px] theme-text-primary">{m.callingId || 'Unavailable'}</p>

                {m.skills && m.skills.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {m.skills.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium border"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={() => handleDM(m)} className="btn-secondary h-8 justify-center text-[11px]">
                  <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />DM
                </button>
                <button onClick={() => handleCall(m)} className="btn-secondary h-8 justify-center text-[11px]">
                  <Video className="h-3.5 w-3.5 text-blue-500" />Call
                </button>
                <Link
                  href="/calling"
                  className="btn-secondary col-span-2 h-8 justify-center text-[11px]"
                  aria-label={`Open Calling ID for ${m.fullName}`}
                >
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />Call by ID
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {isInviteOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Invite Team Member</h3>
              <button onClick={() => setIsInviteOpen(false)} className="btn-ghost h-7 w-7 p-0 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            {inviteDone ? (
              <div className="p-8 text-center text-emerald-600 space-y-2">
                <CheckCircle2 className="mx-auto h-10 w-10" />
                <p className="text-sm font-bold">Invitation sent!</p>
                <p className="text-xs theme-text-muted">Your colleague will receive an email shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="modal-body">
                <div>
                  <label className="form-label" htmlFor="inv-email">Email Address</label>
                  <input id="inv-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="input-base" />
                </div>
                <div>
                  <label className="form-label" htmlFor="inv-role">Role</label>
                  <select id="inv-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input-base">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setIsInviteOpen(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={inviteLoading || memberLimitReached} className="btn-primary">
                    {inviteLoading ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
