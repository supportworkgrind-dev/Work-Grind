'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RoomOptions,
} from 'livekit-client';
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Waves,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
type VoiceSessionResponse = {
  success: boolean;
  serverUrl: string;
  token: string;
  roomName: string;
};

type VoiceAssistantPanelProps = {
  onClose: () => void;
};

const AGENT_NAME_ATTRIBUTE = 'lk.agent.name';
const AGENT_NAME = 'tavro-voice';
const CONNECT_TIMEOUT_MS = 20_000;
const AGENT_JOIN_TIMEOUT_MS = 30_000;
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
};

function getSafeErrorMessage(error: unknown): string {
  const value = error as {
    name?: string;
    response?: { status?: number; data?: { code?: string; message?: string } };
  };
  const code = value.response?.data?.code;
  const status = value.response?.status;

  if (value.name === 'NotAllowedError' || value.name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow microphone access in your browser settings and try again.';
  }
  if (value.name === 'NotFoundError') {
    return 'No microphone was found. Connect a microphone and try again.';
  }
  if (code === 'VOICE_NOT_CONFIGURED') {
    return 'Tavro Voice is not configured on this server yet. Text chat is still available.';
  }
  if (code === 'WORKSPACE_MEMBERSHIP_REQUIRED' || code === 'WORKSPACE_UNAVAILABLE') {
    return value.response?.data?.message ?? 'An active WorkGrind workspace membership is required.';
  }
  if (code === 'AI_LIMIT_EXCEEDED' || code === 'PLAN_UPGRADE_REQUIRED' || code === 'SUBSCRIPTION_REQUIRED') {
    return value.response?.data?.message ?? 'Your current plan does not allow another AI voice session.';
  }
  if (status === 401) return 'Your session expired. Sign in again, then retry the voice session.';
  if (status === 429) return 'Too many voice session requests. Please wait a little and try again.';
  if (status === 503) return 'Tavro Voice is temporarily unavailable. Please try again shortly.';
  if (value.name === 'VoiceConnectionTimeout') {
    return 'The LiveKit connection timed out. Check your connection and retry.';
  }
  return 'Tavro Voice could not connect. Check your microphone and network, then retry.';
}

function isTavro(participant: Participant): boolean {
  return participant.isAgent || participant.attributes[AGENT_NAME_ATTRIBUTE] === AGENT_NAME;
}

export default function VoiceAssistantPanel({ onClose }: VoiceAssistantPanelProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentReady, setIsAgentReady] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [roomName, setRoomName] = useState('');
  const roomRef = useRef<Room | null>(null);
  const startInProgressRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const agentReadyRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const agentJoinTimerRef = useRef<number | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  const clearAgentJoinTimer = useCallback(() => {
    if (agentJoinTimerRef.current !== null) {
      window.clearTimeout(agentJoinTimerRef.current);
      agentJoinTimerRef.current = null;
    }
  }, []);

  const disconnectRoom = useCallback(async (showError: boolean, reason = 'disconnect_requested') => {
    intentionalDisconnectRef.current = true;
    clearAgentJoinTimer();
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      console.info('[Tavro Voice] Disconnecting room.', { roomId: room.name, reason });
      try {
        await room.disconnect();
      } catch {
        if (showError) {
          setErrorMessage('The call ended, but the audio connection did not close cleanly. Please reload before starting another call.');
          setStatus('error');
        }
      }
    }
    setIsMuted(false);
    setIsAgentReady(false);
    setIsAgentSpeaking(false);
    setIsUserSpeaking(false);
    if (!showError) setStatus('idle');
  }, [clearAgentJoinTimer]);

  useEffect(() => () => {
    intentionalDisconnectRef.current = true;
    clearAgentJoinTimer();
    requestAbortRef.current?.abort();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      console.info('[Tavro Voice] Voice panel unmounted.', { roomId: room.name, reason: 'component_unmount' });
      void room.disconnect();
    }
  }, [clearAgentJoinTimer]);

  const startConversation = async () => {
    if (startInProgressRef.current || roomRef.current) return;
    startInProgressRef.current = true;
    intentionalDisconnectRef.current = false;
    agentReadyRef.current = false;
    setErrorMessage('');
    setIsAgentReady(false);
    setStatus('connecting');
    const abortController = new AbortController();
    requestAbortRef.current = abortController;

    let room: Room | null = null;
    let connectTimeoutId: number | null = null;
    try {
      const response = await api.post<VoiceSessionResponse>(
        '/ai/voice/session',
        {},
        { timeout: 15_000, signal: abortController.signal },
      );
      if (
        response.data.success !== true ||
        typeof response.data.serverUrl !== 'string' ||
        typeof response.data.token !== 'string'
      ) {
        throw new Error('Invalid voice session response');
      }

      room = new Room(ROOM_OPTIONS);
      roomRef.current = room;

      const onTrackSubscribed = (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio || !audioContainerRef.current) return;
        const audioElement = track.attach();
        audioElement.autoplay = true;
        audioElement.setAttribute('aria-hidden', 'true');
        audioContainerRef.current.appendChild(audioElement);
        void audioElement.play().catch(() => {
          setErrorMessage('Your browser blocked audio playback. Use the audio permission prompt or check your browser settings.');
        });
      };
      const onTrackUnsubscribed = (track: RemoteTrack) => {
        for (const element of track.detach()) element.remove();
      };
      const onParticipantConnected = (participant: RemoteParticipant) => {
        if (!isTavro(participant)) return;
        console.info('[Tavro Voice] Agent participant joined.', {
          roomId: response.data.roomName,
          participantKind: participant.kind,
        });
        agentReadyRef.current = true;
        clearAgentJoinTimer();
        setIsAgentReady(true);
        setErrorMessage('');
      };
      const onParticipantDisconnected = (participant: RemoteParticipant) => {
        if (!isTavro(participant) || intentionalDisconnectRef.current) return;
        console.warn('[Tavro Voice] Agent participant disconnected.', {
          roomId: response.data.roomName,
          participantKind: participant.kind,
          reason: 'agent_participant_disconnected',
        });
        agentReadyRef.current = false;
        setIsAgentReady(false);
        setErrorMessage('Tavro left the voice session. End the call and retry to reconnect.');
        setStatus('error');
        void disconnectRoom(true, 'agent_participant_disconnected');
      };
      const onActiveSpeakersChanged = (speakers: Participant[]) => {
        const localIdentity = room?.localParticipant.identity;
        setIsAgentSpeaking(speakers.some((speaker) => isTavro(speaker)));
        setIsUserSpeaking(speakers.some((speaker) => speaker.identity === localIdentity));
      };
      const onReconnecting = () => {
        setStatus('reconnecting');
        setErrorMessage('');
      };
      const onReconnected = () => {
        setStatus('connected');
        setErrorMessage('');
      };
      const onConnectionStateChanged = (state: ConnectionState) => {
        if (state === ConnectionState.Connected) setStatus('connected');
      };
      const onDisconnected = (reason?: unknown) => {
        console.warn('[Tavro Voice] LiveKit room disconnected.', {
          roomId: response.data.roomName,
          reason: reason ?? 'unspecified',
          intentional: intentionalDisconnectRef.current,
        });
        if (intentionalDisconnectRef.current) return;
        clearAgentJoinTimer();
        roomRef.current = null;
        setStatus('error');
        setErrorMessage('The LiveKit connection ended unexpectedly. Retry to start a new voice session.');
      };

      room
        .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
        .on(RoomEvent.ParticipantConnected, onParticipantConnected)
        .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
        .on(RoomEvent.Reconnecting, onReconnecting)
        .on(RoomEvent.Reconnected, onReconnected)
        .on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
        .on(RoomEvent.Disconnected, onDisconnected);

      await Promise.race([
        room.connect(response.data.serverUrl, response.data.token),
        new Promise<never>((_, reject) => {
          connectTimeoutId = window.setTimeout(() => {
            const timeoutError = new Error('Voice connection timed out');
            timeoutError.name = 'VoiceConnectionTimeout';
            reject(timeoutError);
          }, CONNECT_TIMEOUT_MS);
        }),
      ]);
      if (connectTimeoutId !== null) window.clearTimeout(connectTimeoutId);
      connectTimeoutId = null;

      console.info('[Tavro Voice] LiveKit room connected.', { roomId: response.data.roomName });
      await room.localParticipant.setMicrophoneEnabled(true);
      console.info('[Tavro Voice] Microphone published.', { roomId: response.data.roomName });
      setIsMuted(false);
      await room.startAudio();
      setStatus('connected');
      setRoomName(response.data.roomName);

      const agentAlreadyJoined = Array.from(room.remoteParticipants.values()).some(isTavro);
      if (agentAlreadyJoined) {
        agentReadyRef.current = true;
        setIsAgentReady(true);
      } else {
        agentJoinTimerRef.current = window.setTimeout(() => {
          if (agentReadyRef.current || intentionalDisconnectRef.current) return;
          console.error('[Tavro Voice] Agent join timed out.', {
            roomId: response.data.roomName,
            timeoutMs: AGENT_JOIN_TIMEOUT_MS,
          });
          setErrorMessage('Tavro did not join the voice session. Check that the LiveKit Agent is running, then retry.');
          setStatus('error');
          void disconnectRoom(true, 'agent_join_timeout');
        }, AGENT_JOIN_TIMEOUT_MS);
      }
    } catch (error) {
      if (connectTimeoutId !== null) window.clearTimeout(connectTimeoutId);
      if (room) {
        intentionalDisconnectRef.current = true;
        roomRef.current = null;
        try {
          await room.disconnect();
        } catch {
          setErrorMessage('The connection failed and could not be fully closed. Reload the page before starting another call.');
        }
      }
      if (!abortController.signal.aborted) {
        setStatus('error');
        setErrorMessage(getSafeErrorMessage(error));
      }
    } finally {
      requestAbortRef.current = null;
      startInProgressRef.current = false;
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room || status !== 'connected') return;
    try {
      const nextMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error));
    }
  };

  const endConversation = async () => {
    setErrorMessage('');
    await disconnectRoom(false, 'user_ended_session');
    setRoomName('');
  };

  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected' || status === 'reconnecting';
  const activityLabel = status === 'reconnecting'
    ? 'Reconnecting to LiveKit…'
    : isAgentSpeaking
      ? 'Tavro is speaking'
      : isUserSpeaking
        ? 'You are speaking'
        : isAgentReady
          ? 'Listening'
          : 'Waiting for Tavro to join';

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 sm:p-6"
      style={{
        borderColor: 'var(--border-color)',
        background: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 13%, var(--bg-card)) 0%, var(--bg-card) 68%)',
      }}
      aria-label="Tavro AI voice assistant"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
            Tavro Voice
          </p>
          <h3 className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Talk naturally with Tavro
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            LiveKit securely streams microphone audio. Voice mode answers general questions; use text chat for workspace records and actions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void endConversation().then(onClose)}
          className="btn-ghost h-8 w-8 shrink-0 rounded-lg p-0"
          aria-label="Close voice assistant"
          title="Close voice assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-7 text-center">
        <div
          className={`relative flex h-28 w-28 items-center justify-center rounded-full border transition-all duration-300 sm:h-32 sm:w-32 ${
            isAgentSpeaking ? 'scale-105 shadow-[0_0_55px_color-mix(in_srgb,var(--accent)_45%,transparent)]' : ''
          }`}
          style={{
            borderColor: 'color-mix(in srgb, var(--accent) 38%, var(--border-color))',
            background: 'color-mix(in srgb, var(--accent) 14%, var(--bg-base))',
          }}
          aria-hidden="true"
        >
          {isConnected ? (
            <Waves className={`h-11 w-11 ${isAgentSpeaking ? 'animate-pulse' : ''}`} style={{ color: 'var(--accent)' }} />
          ) : isConnecting ? (
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--accent)' }} />
          ) : (
            <Mic className="h-10 w-10" style={{ color: 'var(--accent)' }} />
          )}
          <span
            className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 ${
              status === 'connected' && isAgentReady ? 'bg-emerald-500' :
                status === 'reconnecting' || isConnecting ? 'bg-amber-400' :
                  status === 'error' ? 'bg-rose-500' : 'bg-slate-400'
            }`}
            style={{ borderColor: 'var(--bg-card)' }}
          />
        </div>
        <p className="mt-5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {status === 'idle' ? 'Ready when you are' :
            status === 'connecting' ? 'Connecting securely…' :
              status === 'error' ? 'Voice session needs attention' : activityLabel}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {status === 'idle' ? 'Your browser will ask for microphone permission.' :
            status === 'connecting' ? 'Requesting a short-lived room token and connecting to LiveKit.' :
              isMuted ? 'Microphone muted' :
                isAgentReady ? 'Your audio is private to this voice room.' :
                  status === 'error' ? 'No audio is being sent while the session is stopped.' : 'Microphone is on'}
        </p>
        {roomName && status !== 'idle' && (
          <span className="mt-2 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Session {roomName.slice(-8)}
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300/70 bg-rose-500/10 px-3 py-2.5 text-left text-xs text-rose-700 dark:text-rose-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {isConnected ? (
          <>
            <button
              type="button"
              onClick={() => void toggleMicrophone()}
              className="flex h-12 w-12 items-center justify-center rounded-full border transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                borderColor: 'var(--border-color)',
                background: isMuted ? 'color-mix(in srgb, #ef4444 14%, var(--bg-card))' : 'var(--bg-card)',
                color: isMuted ? '#ef4444' : 'var(--text-primary)',
              }}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => void endConversation()}
              className="flex h-12 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-700"
            >
              <PhoneOff className="h-4 w-4" />
              End conversation
            </button>
          </>
        ) : status === 'error' ? (
          <>
            <button
              type="button"
              onClick={() => void endConversation()}
              className="btn-ghost h-11 rounded-xl px-4 text-sm"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void startConversation()}
              disabled={isConnecting}
              className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void startConversation()}
            disabled={isConnecting}
            className="flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-65"
            style={{ background: 'var(--accent)' }}
          >
            {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {isConnecting ? 'Connecting…' : 'Start conversation'}
          </button>
        )}
      </div>
      <div ref={audioContainerRef} className="sr-only" aria-hidden="true" />
    </section>
  );
}
