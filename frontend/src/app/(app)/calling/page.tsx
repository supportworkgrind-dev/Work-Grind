'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Clock3, Copy, History, LoaderCircle, MessageSquareText, PhoneCall, PhoneIncoming, PhoneOutgoing, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { ActiveCallPanel } from '@/components/calling/ActiveCallPanel';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { useCallingStore } from '@/store/useCallingStore';

type DirectoryUser = { callingId: string; displayName: string; avatar: string | null; availability?: 'available' | 'busy' | 'away' | 'offline' };
type CallHistoryEntry = {
  kind: string;
  sessionId?: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  calledAt: string;
  startedAt?: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number;
  peer?: { callingId?: string; displayName?: string; avatar?: string | null } | null;
};

export default function CallingPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canBackfill = ['owner', 'admin'].includes(user?.role || '');
  const activeCall = useCallingStore((state) => state.activeCall);
  const setActiveCall = useCallingStore((state) => state.setActiveCall);
  const [myCallingId, setMyCallingId] = useState('');
  const [myIdLoading, setMyIdLoading] = useState(true);
  const [myIdError, setMyIdError] = useState('');
  const [copied, setCopied] = useState(false);
  const [callingIdInput, setCallingIdInput] = useState('');
  const [directoryUser, setDirectoryUser] = useState<DirectoryUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const lookupRequestId = useRef(0);
  const previousCallSessionId = useRef<string | null>(null);

  const fetchCallHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.get('/calls/history', { params: { page: 1, limit: 50, source: 'global' } });
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setCallHistory(rows.filter((entry: CallHistoryEntry) => entry.kind === 'workgrind-call'));
    } catch (error: unknown) {
      setHistoryError(getApiErrorMessage(error, 'Call history could not be loaded.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/users/me/calling-id')
      .then((response) => { if (active) setMyCallingId(response.data.callingId || ''); })
      .catch((error: unknown) => { if (active) setMyIdError(getApiErrorMessage(error, 'Your Calling ID could not be loaded.')); })
      .finally(() => { if (active) setMyIdLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void fetchCallHistory();
  }, [fetchCallHistory]);

  useEffect(() => {
    const currentSessionId = activeCall?.sessionId ?? null;
    if (previousCallSessionId.current && !currentSessionId) {
      void fetchCallHistory();
    }
    previousCallSessionId.current = currentSessionId;
  }, [activeCall?.sessionId, fetchCallHistory]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAvailability = ({ callingId, availability }: { callingId: string; availability: DirectoryUser['availability'] }) => {
      setDirectoryUser((current) => current?.callingId === callingId ? { ...current, availability } : current);
    };
    const refreshSelectedAvailability = () => {
      const callingId = directoryUser?.callingId;
      if (!callingId) return;
      void api.get(`/users/calling-id/${encodeURIComponent(callingId)}`)
        .then((response) => {
          const resolvedUser = response.data?.user as DirectoryUser | undefined;
          if (resolvedUser?.callingId?.toUpperCase() !== callingId.toUpperCase()) {
            console.error('[Calling] Availability refresh returned a different Calling ID.', {
              requestedCallingId: callingId,
              returnedCallingId: resolvedUser?.callingId ?? null,
            });
            return;
          }
          setDirectoryUser((current) => current?.callingId === callingId
            ? { ...current, availability: resolvedUser.availability }
            : current);
        })
        .catch((error: unknown) => {
          console.error('[Calling] Failed to refresh availability after socket connection:', error);
        });
    };
    socket.on('calling:availability', handleAvailability);
    socket.on('connect', refreshSelectedAvailability);
    if (socket.connected) refreshSelectedAvailability();
    return () => {
      socket.off('calling:availability', handleAvailability);
      socket.off('connect', refreshSelectedAvailability);
    };
  }, [user?._id, directoryUser?.callingId]);

  async function lookupCallingId(input: string) {
    const normalized = input.trim().toUpperCase();
    const requestId = ++lookupRequestId.current;
    setCallingIdInput(normalized.replace(/^WG-/, ''));
    setSearchError('');
    setDirectoryUser(null);
    setNotice('');
    if (!/^WG-\d{5,8}$/.test(normalized)) {
      setSearchError('Enter a Calling ID in the format WG-48291.');
      return;
    }
    setSearching(true);
    try {
      const response = await api.get(`/users/calling-id/${encodeURIComponent(normalized)}`);
      if (requestId !== lookupRequestId.current) return;
      const result = response.data?.user as DirectoryUser | undefined;
      if (
        !result ||
        typeof result.callingId !== 'string' ||
        result.callingId.toUpperCase() !== normalized ||
        typeof result.displayName !== 'string'
      ) {
        console.error('[Calling] Lookup response did not match requested Calling ID.', {
          requestedCallingId: normalized,
          returnedCallingId: result?.callingId ?? null,
        });
        setDirectoryUser(null);
        setSearchError('The Calling ID response did not match the requested user. Please try again.');
        return;
      }
      setDirectoryUser({
        callingId: result.callingId,
        displayName: result.displayName,
        avatar: result.avatar ?? null,
        availability: result.availability,
      });
    } catch (error: unknown) {
      if (requestId === lookupRequestId.current) {
        setSearchError(getApiErrorMessage(error, 'Calling ID could not be found.'));
      }
    } finally {
      if (requestId === lookupRequestId.current) setSearching(false);
    }
  }

  async function copyMyId() {
    if (!myCallingId) return;
    try {
      await navigator.clipboard.writeText(myCallingId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMyIdError('Clipboard access was denied. Select and copy your ID manually.');
    }
  }

  async function searchByCallingId(event: FormEvent) {
    event.preventDefault();
    await lookupCallingId(`WG-${callingIdInput.replace(/^WG-/i, '')}`);
  }

  function handleCallingIdInput(value: string) {
    setCallingIdInput(value.replace(/^WG-/i, '').replace(/\D/g, '').slice(0, 8));
  }

  async function redial(entry: CallHistoryEntry) {
    if (!entry.peer?.callingId) return;
    const normalizedId = entry.peer.callingId.toUpperCase();
    setCallingIdInput(normalizedId.replace(/^WG-/, ''));
    setSearchError('');
    setNotice('');
    try {
      const response = await api.get(`/users/calling-id/${encodeURIComponent(normalizedId)}`);
      const result = response.data?.user as DirectoryUser | undefined;
      if (result?.callingId?.toUpperCase() !== normalizedId) {
        setSearchError('The Calling ID response did not match the requested user. Please try again.');
        return;
      }
      setDirectoryUser({
        callingId: result.callingId,
        displayName: result.displayName,
        avatar: result.avatar ?? null,
        availability: result.availability,
      });
      const resolvedUser = {
        callingId: result.callingId,
        displayName: result.displayName,
        avatar: result.avatar ?? null,
        availability: result.availability,
      };
      setDirectoryUser(resolvedUser);
      if (resolvedUser.availability === 'offline' || resolvedUser.availability === 'away') {
        setSearchError(`${resolvedUser.displayName} is not available for a call right now.`);
        return;
      }
      await placeCall(resolvedUser);
    } catch (error: unknown) {
      setSearchError(getApiErrorMessage(error, 'This contact could not be reached.'));
    }
  }

  async function openDirectChatWithUser(target: DirectoryUser) {
    if (!target || chatLoading) return;
    setChatLoading(true);
    setSearchError('');
    setNotice('');
    try {
      const response = await api.post('/direct-messages/conversations', { recipientCallingId: target.callingId });
      if (response.data?.success && response.data.conversation?._id) {
        router.push(`/chat?conversationId=${encodeURIComponent(response.data.conversation._id)}`);
        return;
      }
      setSearchError('Direct chat is not available for this user yet.');
    } catch (error: unknown) {
      setSearchError(getApiErrorMessage(error, 'Direct chat is not available for this WorkGrind user.'));
    } finally {
      setChatLoading(false);
    }
  }

  async function placeCall(target: DirectoryUser) {
    if (!target || callLoading) return;
    if (target.availability === 'offline' || target.availability === 'away') {
      setSearchError(`${target.displayName} is not available for a call right now.`);
      return;
    }
    setCallLoading(true);
    setSearchError('');
    setNotice('');
    try {
      const response = await api.post('/calls', { callingId: target.callingId });
      setActiveCall({
        sessionId: response.data.sessionId,
        sessionToken: response.data.sessionToken,
        direction: 'outgoing',
        peer: { callingId: target.callingId, displayName: target.displayName, avatar: target.avatar },
        status: 'ringing',
      });
      setNotice(`Calling ${target.displayName}...`);
    } catch (error: unknown) {
      setSearchError(getApiErrorMessage(error, 'This call could not be started.'));
    } finally {
      setCallLoading(false);
    }
  }

  async function hangUp() {
    if (!activeCall) return;
    if (activeCall.status !== 'ringing' && activeCall.status !== 'accepted') {
      setActiveCall(null);
      return;
    }

    try {
      const action = activeCall.status === 'ringing' ? 'cancel' : 'end';
      await api.post(`/calls/${encodeURIComponent(activeCall.sessionId)}/${action}`);
      setActiveCall(null);
    } catch (error: unknown) {
      setSearchError(getApiErrorMessage(error, 'This call could not be ended.'));
    }
  }

  function callStatusLabel(status: string): string {
    switch (status) {
      case 'accepted': return 'In progress';
      case 'completed':
      case 'ended': return 'Completed';
      case 'missed': return 'Missed';
      case 'rejected':
      case 'declined': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      case 'ringing': return 'Ringing';
      default: return status;
    }
  }

  function formatCallDuration(totalSeconds: number): string {
    const seconds = Math.max(0, totalSeconds);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  async function backfillWorkspace() {
    setBackfillLoading(true);
    setSearchError('');
    setNotice('');
    try {
      const response = await api.post('/users/calling-id/backfill');
      setNotice(`${response.data.generated} active teammate${response.data.generated === 1 ? '' : 's'} assigned a Calling ID.`);
    } catch (error: unknown) {
      setSearchError(getApiErrorMessage(error, 'Workspace Calling IDs could not be prepared.'));
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <div className="calling-workspace mx-auto max-w-7xl space-y-6">
      <header className="calling-hero relative isolate overflow-hidden rounded-2xl border p-5 shadow-[var(--shadow-card)] sm:p-8" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-accent-strip)' }}>
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">WorkGrind identity</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight theme-text-primary sm:text-3xl">Global Calling</h1>
            <p className="mt-2 max-w-2xl text-sm theme-text-secondary">Find and call any WorkGrind user worldwide using their permanent Calling ID.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold theme-text-secondary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Private, peer-to-peer audio
          </span>
        </div>
      </header>

      {activeCall && <ActiveCallPanel call={activeCall} onHangUp={() => void hangUp()} />}

      <section className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div><h2 className="text-sm font-semibold theme-text-primary">Global Calling</h2><p className="mt-1 text-xs leading-relaxed theme-text-secondary">This lookup reveals only a user’s public display name, avatar, Calling ID, and current availability. It does not expose any workspace, CRM, or private profile data.</p></div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-3xl border theme-border theme-bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]"><PhoneCall className="h-5 w-5" /></span><div><h2 className="text-base font-bold theme-text-primary">Your Calling ID</h2><p className="mt-0.5 text-xs theme-text-muted">Permanent · Global WorkGrind Calling ID</p></div></div>
          {myIdError && <p role="alert" className="mt-4 text-xs text-rose-600">{myIdError}</p>}
          <div className="calling-id-card mt-5 flex items-center gap-2">
            <code className="flex min-h-12 flex-1 items-center justify-center rounded-xl border theme-border theme-bg-base px-3 text-lg font-bold tracking-widest theme-text-primary" aria-live="polite">
              {myIdLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : myCallingId || 'Unavailable'}
            </code>
            <button type="button" onClick={copyMyId} disabled={!myCallingId || myIdLoading} aria-label="Copy my Calling ID" title="Copy my Calling ID" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border theme-border theme-text-primary transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed theme-text-muted">Share this code with anyone on WorkGrind so they can call you. Your email address, phone number, company details, and internal account ID are not part of the lookup response.</p>
          {canBackfill && <div className="mt-5 border-t theme-border pt-4"><p className="text-xs theme-text-secondary">Prepare IDs for active teammates who joined before Calling IDs were added.</p><button type="button" onClick={() => void backfillWorkspace()} disabled={backfillLoading} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border theme-border px-3 text-xs font-semibold theme-text-primary disabled:opacity-50">{backfillLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}Assign missing workspace IDs</button></div>}
        </div>

        <div className="rounded-3xl border theme-border theme-bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600"><Search className="h-5 w-5" /></span><div><h2 className="text-base font-bold theme-text-primary">Find a WorkGrind user</h2><p className="mt-0.5 text-xs theme-text-muted">Search globally by WorkGrind Calling ID</p></div></div>
          <form onSubmit={searchByCallingId} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="calling-id-search" className="sr-only">Calling ID</label>
            <div className="flex min-h-12 min-w-0 flex-1 items-center overflow-hidden rounded-xl border theme-border theme-bg-base transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-glow)]">
              <span aria-hidden="true" className="pl-4 font-mono text-sm font-bold tracking-wider theme-text-muted">WG-</span>
              <input id="calling-id-search" value={callingIdInput} onChange={(event) => handleCallingIdInput(event.target.value)} maxLength={8} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="48291" className="min-w-0 flex-1 bg-transparent px-1 py-3 font-mono text-sm tracking-wider theme-text-primary outline-none placeholder:theme-text-muted" />
            </div>
            <button type="submit" disabled={searching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-60">{searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Find</button>
          </form>
          {searchError && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-600"><AlertCircle className="h-4 w-4 shrink-0" />{searchError}</p>}
          {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-emerald-700">{notice}</p>}
          {directoryUser ? (
            <div className="calling-user-result mt-5 rounded-2xl border theme-border theme-bg-base p-4" aria-live="polite">
              <div className="flex items-center gap-3">
                <Avatar name={directoryUser.displayName} src={directoryUser.avatar || undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold theme-text-primary">{directoryUser.displayName}</p>
                  <p className="mt-1 text-xs font-mono tracking-wider theme-text-muted">{directoryUser.callingId}</p>
                  <p className="mt-1 text-[11px] capitalize theme-text-secondary">{directoryUser.availability ?? 'offline'}</p>
                </div>
                <UserRound className="h-4 w-4 shrink-0 theme-text-muted" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={chatLoading} onClick={() => void openDirectChatWithUser(directoryUser)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border theme-border px-4 text-xs font-semibold theme-text-primary transition hover:bg-[var(--bg-hover)] disabled:opacity-50">
                  {chatLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareText className="h-3.5 w-3.5" />}Chat
                </button>
                <button type="button" disabled={callLoading || !directoryUser.availability || directoryUser.availability === 'offline'} onClick={() => void placeCall(directoryUser)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-50">
                  {callLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}Call
                </button>
              </div>
            </div>
          ) : !searching && !searchError && <div className="mt-5 flex min-h-28 items-center justify-center rounded-2xl border border-dashed theme-border px-4 text-center text-xs theme-text-muted">Enter the digits after WG- to find a WorkGrind user anywhere.</div>}
          <div className="mt-5 flex items-start gap-2 border-t theme-border pt-4 text-[11px] leading-relaxed theme-text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Any active WorkGrind user can be found by Calling ID. Invalid and unavailable IDs reveal no account details.</p></div>
        </div>
      </section>
      <section className="rounded-3xl border theme-border theme-bg-card p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="call-history-title">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600"><History className="h-5 w-5" /></span>
            <div>
              <h2 id="call-history-title" className="text-base font-bold theme-text-primary">Call History</h2>
              <p className="mt-0.5 text-xs theme-text-muted">Your recent Global Calling activity</p>
            </div>
          </div>
          <button type="button" onClick={() => void fetchCallHistory()} disabled={historyLoading} aria-label="Refresh call history" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border theme-border theme-text-primary transition hover:bg-[var(--bg-hover)] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {historyError && <p role="alert" className="mt-4 text-xs text-rose-600">{historyError}</p>}
        {historyLoading ? (
          <div className="flex min-h-24 items-center justify-center theme-text-muted"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
        ) : callHistory.length ? (
          <ul className="mt-4 divide-y theme-border">
            {callHistory.map((entry) => (
              <li key={entry.sessionId} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0 sm:flex-nowrap" style={{ borderColor: 'var(--border-subtle)' }}>
                <Avatar name={entry.peer?.displayName || 'WorkGrind user'} src={entry.peer?.avatar || undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold theme-text-primary">{entry.peer?.displayName || 'WorkGrind user'}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs theme-text-secondary">
                    <span className="inline-flex items-center gap-1 capitalize">
                      {entry.direction === 'incoming' ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                      {entry.direction}
                    </span>
                    {entry.peer?.callingId && <span className="font-mono">{entry.peer.callingId}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold theme-text-primary">{callStatusLabel(entry.status)}</p>
                  <p className="mt-1 text-[11px] theme-text-muted">{new Date(entry.calledAt).toLocaleString()}</p>
                  {entry.answeredAt && <p className="mt-0.5 inline-flex items-center justify-end gap-1 text-[11px] theme-text-muted"><Clock3 className="h-3 w-3" />{formatCallDuration(entry.durationSeconds || 0)}</p>}
                </div>
                {entry.peer?.callingId && (
                  <button
                    type="button"
                    onClick={() => void redial(entry)}
                    disabled={callLoading || Boolean(activeCall)}
                    title={`Call ${entry.peer.displayName || entry.peer.callingId} again`}
                    className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PhoneCall className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : !historyError ? (
          <p className="mt-4 rounded-lg border border-dashed theme-border px-4 py-8 text-center text-xs theme-text-muted">No Global Calling activity yet.</p>
        ) : null}
      </section>
    </div>
  );
}
