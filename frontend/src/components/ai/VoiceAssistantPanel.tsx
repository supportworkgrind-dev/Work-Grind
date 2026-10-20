'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import {
  mergeVoiceTranscriptSegments,
  type VoiceSpeaker,
  type VoiceTranscriptMessage,
} from './voiceTranscript';

type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'waiting-for-agent'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'reconnecting'
  | 'failed';
type ActiveAgentStatus = 'listening' | 'thinking' | 'speaking';
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
const AGENT_STATE_ATTRIBUTE = 'lk.agent.state';
const AGENT_STATES = new Set(['initializing', 'listening', 'thinking', 'speaking']);

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
  if (code === 'VOICE_SESSION_UNAVAILABLE') {
    return 'Tavro could not start a voice session. The voice service may be unavailable; please retry shortly.';
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
    return 'The voice connection timed out. Check your internet connection and retry.';
  }
  return 'Tavro Voice could not connect. Check your microphone and network, then retry.';
}

function isTavro(participant: Participant): boolean {
  return participant.isAgent || participant.attributes[AGENT_NAME_ATTRIBUTE] === AGENT_NAME;
}

function activeAgentStatus(value: string | undefined): ActiveAgentStatus | null {
  if (value === 'listening' || value === 'thinking' || value === 'speaking') return value;
  return null;
}

export default function VoiceAssistantPanel({ onClose }: VoiceAssistantPanelProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentReady, setIsAgentReady] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [agentState, setAgentState] = useState('initializing');
  const [transcriptMessages, setTranscriptMessages] = useState<VoiceTranscriptMessage[]>([]);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');
  const [audioDeviceError, setAudioDeviceError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [roomName, setRoomName] = useState('');
  const roomRef = useRef<Room | null>(null);
  const startInProgressRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const agentReadyRef = useRef(false);
  const microphonePublishedRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const agentJoinTimerRef = useRef<number | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isConnected = status === 'waiting-for-agent' ||
    status === 'listening' ||
    status === 'thinking' ||
    status === 'speaking' ||
    status === 'reconnecting';

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
          setStatus('failed');
        }
      }
    }
    setIsMuted(false);
    setIsAgentReady(false);
    agentReadyRef.current = false;
    microphonePublishedRef.current = false;
    setIsAgentSpeaking(false);
    setIsUserSpeaking(false);
    setAgentState('initializing');
    setAudioPlaybackBlocked(false);
    if (!showError) setStatus('idle');
  }, [clearAgentJoinTimer]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcriptMessages]);

  const refreshAudioInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === 'audioinput');
      setAudioInputs(devices);
      const activeDeviceId = roomRef.current?.getActiveDevice('audioinput');
      setSelectedAudioInputId(
        activeDeviceId && devices.some((device) => device.deviceId === activeDeviceId)
          ? activeDeviceId
          : devices[0]?.deviceId ?? '',
      );
      setAudioDeviceError('');
    } catch {
      setAudioDeviceError('Microphone devices could not be loaded. Check your browser permissions.');
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const initialRefresh = window.setTimeout(() => void refreshAudioInputs(), 0);
    navigator.mediaDevices?.addEventListener('devicechange', refreshAudioInputs);
    return () => {
      window.clearTimeout(initialRefresh);
      navigator.mediaDevices?.removeEventListener('devicechange', refreshAudioInputs);
    };
  }, [isConnected, refreshAudioInputs]);

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

  useEffect(() => {
    const handleSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.effectiveDirective !== 'connect-src') return;
      let blockedUrl = event.blockedURI;
      try {
        const url = new URL(event.blockedURI);
        blockedUrl = `${url.origin}${url.pathname}`;
      } catch {
        // CSP can report non-URL sources such as inline or eval.
      }
      console.error('[Tavro Voice] CSP blocked a connection.', {
        directive: event.effectiveDirective,
        blockedUrl,
        disposition: event.disposition,
        roomId: roomRef.current?.name,
      });
    };

    document.addEventListener('securitypolicyviolation', handleSecurityPolicyViolation);
    return () => document.removeEventListener('securitypolicyviolation', handleSecurityPolicyViolation);
  }, []);

  const startConversation = async () => {
    if (startInProgressRef.current || roomRef.current) return;
    startInProgressRef.current = true;
    intentionalDisconnectRef.current = false;
    agentReadyRef.current = false;
    microphonePublishedRef.current = false;
    setErrorMessage('');
    setIsAgentReady(false);
    setAgentState('initializing');
    setAudioPlaybackBlocked(false);
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
      const startAgentReadinessTimeout = () => {
        if (agentJoinTimerRef.current !== null) return;
        agentJoinTimerRef.current = window.setTimeout(() => {
          if (agentReadyRef.current || intentionalDisconnectRef.current) return;
          console.error('[Tavro Voice] Agent readiness timed out.', {
            roomId: response.data.roomName,
            timeoutMs: AGENT_JOIN_TIMEOUT_MS,
          });
          setErrorMessage('The voice room connected, but Tavro did not become ready. The voice service may be offline or unable to reach WorkGrind. Please retry shortly.');
          setStatus('failed');
          void disconnectRoom(true, 'agent_readiness_timeout');
        }, AGENT_JOIN_TIMEOUT_MS);
      };

      const onTrackSubscribed = (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio || !audioContainerRef.current) return;
        const audioElement = track.attach();
        audioElement.autoplay = true;
        audioElement.setAttribute('aria-hidden', 'true');
        audioContainerRef.current.appendChild(audioElement);
        void audioElement.play().catch(() => {
          setAudioPlaybackBlocked(true);
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
        const state = activeAgentStatus(participant.attributes[AGENT_STATE_ATTRIBUTE]);
        if (!state) {
          agentReadyRef.current = false;
          setStatus(microphonePublishedRef.current ? 'waiting-for-agent' : 'connecting');
          setIsAgentReady(false);
          return;
        }
        agentReadyRef.current = true;
        clearAgentJoinTimer();
        setIsAgentReady(true);
        setAgentState(state);
        setStatus(state);
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
        setAgentState('initializing');
        setErrorMessage('Tavro left the voice session. End the call and retry to reconnect.');
        setStatus('failed');
        void disconnectRoom(true, 'agent_participant_disconnected');
      };
      const onActiveSpeakersChanged = (speakers: Participant[]) => {
        const localIdentity = room?.localParticipant.identity;
        const agentSpeaking = speakers.some((speaker) => isTavro(speaker));
        setIsAgentSpeaking(agentSpeaking);
        setIsUserSpeaking(speakers.some((speaker) => speaker.identity === localIdentity));
        if (agentReadyRef.current) {
          const currentAgent = Array.from(room?.remoteParticipants.values() ?? []).find(isTavro);
          const currentAgentStatus = activeAgentStatus(currentAgent?.attributes[AGENT_STATE_ATTRIBUTE]);
          setStatus(agentSpeaking ? 'speaking' : currentAgentStatus ?? 'listening');
        }
      };
      const onTranscriptionReceived = (
        segments: Array<{ id: string; text: string; final: boolean }>,
        participant?: Participant,
      ) => {
        const speaker: VoiceSpeaker | null = participant && isTavro(participant)
          ? 'Tavro AI'
          : participant?.identity === room?.localParticipant.identity
            ? 'You'
            : null;
        if (!speaker) return;
        setTranscriptMessages((messages) => mergeVoiceTranscriptSegments(messages, speaker, segments));
      };
      const onParticipantAttributesChanged = (_changed: Record<string, string>, participant: Participant) => {
        if (!isTavro(participant)) return;
        const nextState = participant.attributes[AGENT_STATE_ATTRIBUTE];
        if (!nextState || !AGENT_STATES.has(nextState)) return;
        setAgentState(nextState);
        const activeState = activeAgentStatus(nextState);
        if (!activeState) {
          agentReadyRef.current = false;
          setIsAgentReady(false);
          setStatus(microphonePublishedRef.current ? 'waiting-for-agent' : 'connecting');
          if (microphonePublishedRef.current) startAgentReadinessTimeout();
          return;
        }
        agentReadyRef.current = true;
        clearAgentJoinTimer();
        setIsAgentReady(true);
        setStatus(activeState);
        setErrorMessage('');
      };
      const onReconnecting = () => {
        setStatus('reconnecting');
        setErrorMessage('');
      };
      const onReconnected = () => {
        const currentAgent = Array.from(room?.remoteParticipants.values() ?? []).find(isTavro);
        const currentState = activeAgentStatus(currentAgent?.attributes[AGENT_STATE_ATTRIBUTE]);
        agentReadyRef.current = currentState !== null;
        setIsAgentReady(agentReadyRef.current);
        setStatus(currentState ?? 'waiting-for-agent');
        if (currentState) clearAgentJoinTimer();
        else startAgentReadinessTimeout();
        setErrorMessage('');
      };
      const onDisconnected = (reason?: unknown) => {
        console.warn('[Tavro Voice] LiveKit room disconnected.', {
          roomId: response.data.roomName,
          reason: reason ?? 'unspecified',
          intentional: intentionalDisconnectRef.current,
        });
        if (intentionalDisconnectRef.current) return;
        clearAgentJoinTimer();
        agentReadyRef.current = false;
        microphonePublishedRef.current = false;
        setIsAgentReady(false);
        roomRef.current = null;
        setStatus('failed');
        setAgentState('initializing');
        setErrorMessage('The voice connection ended unexpectedly. Retry to start a new session.');
      };

      room
        .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
        .on(RoomEvent.ParticipantConnected, onParticipantConnected)
        .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .on(RoomEvent.ParticipantAttributesChanged, onParticipantAttributesChanged)
        .on(RoomEvent.TranscriptionReceived, onTranscriptionReceived)
        .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
        .on(RoomEvent.Reconnecting, onReconnecting)
        .on(RoomEvent.Reconnected, onReconnected)
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
      try {
        console.info('[Tavro Voice] LiveKit signaling origin.', {
          roomId: response.data.roomName,
          origin: new URL(response.data.serverUrl).origin,
        });
      } catch {
        console.warn('[Tavro Voice] LiveKit session returned an invalid signaling URL.', {
          roomId: response.data.roomName,
        });
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      microphonePublishedRef.current = true;
      console.info('[Tavro Voice] Microphone published.', { roomId: response.data.roomName });
      setIsMuted(false);
      try {
        await room.startAudio();
      } catch {
        setAudioPlaybackBlocked(true);
      }
      setStatus('waiting-for-agent');
      setRoomName(response.data.roomName);

      const agentParticipant = Array.from(room.remoteParticipants.values()).find(isTavro);
      const currentAgentState = activeAgentStatus(agentParticipant?.attributes[AGENT_STATE_ATTRIBUTE]);
      if (currentAgentState) {
        agentReadyRef.current = true;
        clearAgentJoinTimer();
        setIsAgentReady(true);
        setAgentState(currentAgentState);
        setStatus(currentAgentState);
      } else {
        startAgentReadinessTimeout();
      }
    } catch (error) {
      if (connectTimeoutId !== null) window.clearTimeout(connectTimeoutId);
      if (room) {
        intentionalDisconnectRef.current = true;
        microphonePublishedRef.current = false;
        roomRef.current = null;
        try {
          await room.disconnect();
        } catch {
          setErrorMessage('The connection failed and could not be fully closed. Reload the page before starting another call.');
        }
      }
      if (!abortController.signal.aborted) {
        setStatus('failed');
        setErrorMessage(getSafeErrorMessage(error));
      }
    } finally {
      requestAbortRef.current = null;
      startInProgressRef.current = false;
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room || !isConnected) return;
    try {
      const nextMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error));
    }
  };

  const selectAudioInput = async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.switchActiveDevice('audioinput', deviceId);
      setSelectedAudioInputId(deviceId);
      setAudioDeviceError('');
    } catch {
      setAudioDeviceError('This microphone could not be selected. Check its connection and permissions.');
    }
  };

  const enableAudioPlayback = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      const audioElements = audioContainerRef.current?.querySelectorAll('audio') ?? [];
      for (const audioElement of audioElements) await audioElement.play();
      setAudioPlaybackBlocked(false);
    } catch {
      setAudioPlaybackBlocked(true);
    }
  };

  const endConversation = async (source: 'close_button' | 'end_button' | 'error_close_button') => {
    setErrorMessage('');
    console.info('[Tavro Voice] User requested voice session end.', {
      roomId: roomRef.current?.name,
      source,
    });
    await disconnectRoom(false, 'user_ended_session');
    setRoomName('');
  };

  const isConnecting = status === 'connecting';
  const statusLabel: Record<VoiceStatus, string> = {
    idle: 'Ready when you are',
    connecting: 'Connecting securely…',
    'waiting-for-agent': 'Waiting for Tavro',
    listening: isUserSpeaking ? 'Listening to you' : 'Listening',
    thinking: 'Tavro is processing',
    speaking: isAgentSpeaking || agentState === 'speaking' ? 'Tavro is speaking' : 'Speaking',
    reconnecting: 'Reconnecting…',
    failed: 'Voice session failed',
  };

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
            Voice mode lets you speak with Tavro for general questions. Use text chat for workspace records and actions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void endConversation('close_button').then(onClose)}
          className="btn-ghost h-8 w-8 shrink-0 rounded-lg p-0"
          aria-label="Close voice assistant"
          title="Close voice assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]">
      <div className="flex min-h-[280px] flex-col items-center justify-center py-5 text-center">
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
              status === 'listening' || status === 'thinking' || status === 'speaking' ? 'bg-emerald-500' :
                status === 'reconnecting' || status === 'waiting-for-agent' || isConnecting ? 'bg-amber-400' :
                  status === 'failed' ? 'bg-rose-500' : 'bg-slate-400'
            }`}
            style={{ borderColor: 'var(--bg-card)' }}
          />
        </div>
        <p className="mt-5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {statusLabel[status]}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {status === 'idle' ? 'Your browser will ask for microphone permission.' :
            status === 'connecting' ? 'Connecting to your voice session…' :
              status === 'waiting-for-agent' ? 'Your microphone is ready. Tavro is joining the room.' :
                status === 'failed' ? 'No audio is being sent while the session is stopped.' :
                  isMuted ? 'Microphone muted' : isAgentReady ? 'Your microphone is on.' : 'Microphone is on'}
        </p>
        {isConnected && audioInputs.length > 1 && (
          <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Microphone
            <select
              aria-label="Choose microphone"
              value={selectedAudioInputId}
              onChange={(event) => void selectAudioInput(event.target.value)}
              className="max-w-[220px] rounded-lg border bg-[var(--bg-card)] px-2 py-1.5"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              {audioInputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        {audioDeviceError && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-300" role="status">{audioDeviceError}</p>
        )}
        {roomName && (
          <details className="mt-3 text-left text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <summary className="cursor-pointer">Diagnostics</summary>
            <p className="mt-1 break-all font-mono">Session ID: {roomName}</p>
          </details>
        )}
      </div>
      <aside className="flex min-h-[260px] max-h-[420px] flex-col overflow-hidden rounded-2xl border text-left" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Live conversation</h4>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Speech and Tavro replies appear here.</p>
          </div>
          {transcriptMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscriptMessages([])}
              className="rounded-lg px-2 py-1 text-[11px] hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions text">
          {transcriptMessages.length === 0 ? (
            <p className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {isAgentReady ? 'Start speaking to begin the conversation.' : 'Your conversation will appear here.'}
            </p>
          ) : transcriptMessages.map((message) => (
            <article key={`${message.speaker}:${message.id}`} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{message.speaker}</span>
                <time className="text-[10px]" style={{ color: 'var(--text-muted)' }} dateTime={new Date(message.timestamp).toISOString()}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5" style={{ color: 'var(--text-primary)' }}>{message.text}</p>
              {!message.final && <span className="mt-1 inline-block text-[10px]" style={{ color: 'var(--text-muted)' }}>Transcribing…</span>}
            </article>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </aside>
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300/70 bg-rose-500/10 px-3 py-2.5 text-left text-xs text-rose-700 dark:text-rose-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {audioPlaybackBlocked && isConnected && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200" role="status">
          <span>Your browser needs permission to play Tavro’s audio.</span>
          <button type="button" onClick={() => void enableAudioPlayback()} className="rounded-lg bg-amber-500/20 px-3 py-1.5 font-semibold hover:bg-amber-500/30">
            Enable audio
          </button>
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
              onClick={() => void endConversation('end_button')}
              className="flex h-12 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-700"
            >
              <PhoneOff className="h-4 w-4" />
              End conversation
            </button>
          </>
        ) : status === 'failed' ? (
          <>
            <button
              type="button"
              onClick={() => void endConversation('error_close_button')}
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
