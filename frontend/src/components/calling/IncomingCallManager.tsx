'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle, Phone, PhoneOff, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { getSocket } from '@/lib/socket';
import { useCallingStore, type IncomingCall } from '@/store/useCallingStore';
import { useChatSound } from '@/lib/useChatSound';

export function IncomingCallManager() {
  const router = useRouter();
  const incomingCall = useCallingStore((state) => state.incomingCall);
  const setIncomingCall = useCallingStore((state) => state.setIncomingCall);
  const setActiveCall = useCallingStore((state) => state.setActiveCall);
  const updateActiveCall = useCallingStore((state) => state.updateActiveCall);
  const clearCall = useCallingStore((state) => state.clearCall);
  const { playChime } = useChatSound();
  const alertedSessionId = useRef<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onIncoming = (call: IncomingCall) => {
      setError('');
      if (alertedSessionId.current !== call.sessionId) {
        alertedSessionId.current = call.sessionId;
        playChime();
      }
      setIncomingCall(call);
    };
    const onAccepted = ({ sessionId }: { sessionId: string }) => updateActiveCall(sessionId, 'accepted');
    const onDeclined = ({ sessionId }: { sessionId: string }) => updateActiveCall(sessionId, 'declined');
    const onEnded = ({ sessionId }: { sessionId: string; status: string }) => {
      if (sessionId) clearCall(sessionId);
    };
    const onDisconnect = () => {
      const state = useCallingStore.getState();
      if (state.activeCall) clearCall(state.activeCall.sessionId);
      if (state.incomingCall) clearCall(state.incomingCall.sessionId);
    };
    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
      socket.off('disconnect', onDisconnect);
    };
  }, [clearCall, playChime, setIncomingCall, updateActiveCall]);

  useEffect(() => {
    if (!incomingCall) return;
    const delay = Math.max(0, new Date(incomingCall.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => setIncomingCall(null), delay);
    return () => window.clearTimeout(timer);
  }, [incomingCall, setIncomingCall]);

  async function acceptCall() {
    if (!incomingCall || working) return;
    setWorking(true);
    setError('');
    try {
      const response = await api.post(`/calls/${encodeURIComponent(incomingCall.sessionId)}/accept`);
      setActiveCall({
        sessionId: response.data.sessionId,
        sessionToken: response.data.sessionToken,
        direction: 'incoming',
        peer: response.data.caller,
        status: 'accepted',
      });
      setIncomingCall(null);
      router.push('/calling');
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'This call is no longer available.'));
    } finally {
      setWorking(false);
    }
  }

  async function declineCall() {
    if (!incomingCall || working) return;
    setWorking(true);
    try {
      await api.post(`/calls/${encodeURIComponent(incomingCall.sessionId)}/decline`);
      setIncomingCall(null);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'This call could not be declined.'));
    } finally {
      setWorking(false);
    }
  }

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="incoming-call-title" className="w-full max-w-sm overflow-hidden rounded-3xl border theme-border theme-bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center" style={{ background: 'var(--bg-accent-strip)' }}>
          <div className="rounded-full p-1.5 ring-1 ring-[var(--accent-glow)]">
            <Avatar name={incomingCall.caller.displayName} src={incomingCall.caller.avatar || undefined} size="xl" shape="circle" className="h-20 w-20" />
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider theme-text-secondary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Incoming WorkGrind call
          </p>
          <h2 id="incoming-call-title" className="mt-3 text-xl font-bold theme-text-primary">{incomingCall.caller.displayName}</h2>
          <p className="mt-1 font-mono text-xs theme-text-muted">{incomingCall.caller.callingId}</p>
        </div>
        {error && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-center text-xs text-rose-600">{error}</p>}
        <div className="flex justify-center gap-5 px-6 pt-5">
          <button type="button" onClick={() => void declineCall()} disabled={working} aria-label="Decline call" className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"><PhoneOff className="h-5 w-5" /></button>
          <button type="button" onClick={() => void acceptCall()} disabled={working} aria-label="Accept call" className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">{working ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}</button>
        </div>
        <p className="px-6 pb-5 pt-4 flex items-center justify-center gap-1.5 text-[10px] theme-text-muted"><ShieldCheck className="h-3.5 w-3.5" />Only the audio session is shared</p>
      </section>
    </div>
  );
}
