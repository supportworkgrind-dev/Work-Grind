'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, LoaderCircle, Mic, MicOff, PhoneOff, ShieldCheck, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { getSocket } from '@/lib/socket';
import { getRtcConfiguration, logRtcIceDiagnostics } from '@/lib/rtcConfig';
import { useAuthStore } from '@/store/useAuthStore';
import type { ActiveCall } from '@/store/useCallingStore';

export function ActiveCallPanel({ call, onHangUp }: { call: ActiveCall; onHangUp: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [remoteVideoAvailable, setRemoteVideoAvailable] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [networkWarning, setNetworkWarning] = useState('');
  const [connected, setConnected] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  useEffect(() => {
    if (call.status !== 'accepted') return;
    const socket = getSocket();
    if (!socket) { setMediaError('Secure call signaling is unavailable.'); return; }

    let disposed = false;
    let peer: RTCPeerConnection | null = null;
    let offerStarted = false;
    let signalQueue = Promise.resolve();
    let disconnectedTimer: number | undefined;
    const pendingCandidates: RTCIceCandidateInit[] = [];

    const emitSignal = (
      signal:
        | RTCSessionDescriptionInit
        | { type: 'candidate'; candidate: RTCIceCandidateInit }
        | { type: 'media-state'; videoEnabled: boolean },
    ) => {
      socket.emit('call:signal', { sessionId: call.sessionId, signal });
    };

    const flushCandidates = async () => {
      if (!peer?.remoteDescription) return;
      while (pendingCandidates.length) {
        const candidate = pendingCandidates.shift();
        if (candidate) await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const createOffer = async () => {
      if (call.direction !== 'outgoing' || offerStarted || !peer) return;
      offerStarted = true;
      try {
        const offer = await peer.createOffer();
        if (disposed) return;
        await peer.setLocalDescription(offer);
        if (peer.localDescription) {
          emitSignal({ type: peer.localDescription.type, sdp: peer.localDescription.sdp || '' } as RTCSessionDescriptionInit);
        }
      } catch {
        setMediaError('The audio connection could not be negotiated.');
      }
    };

    const joinCallRoom = () => socket.emit('call:join', { sessionId: call.sessionId, sessionToken: call.sessionToken });
    const onJoined = ({ sessionId, peerPresent }: { sessionId: string; peerPresent: boolean }) => {
      if (sessionId === call.sessionId && peerPresent) void createOffer();
    };
    const onPeerReady = ({ sessionId }: { sessionId: string }) => {
      if (sessionId === call.sessionId) void createOffer();
    };

    const onSignal = ({ sessionId, signal }: { sessionId: string; signal: any }) => {
      if (sessionId !== call.sessionId || !signal) return;
      if (signal.type === 'media-state' && typeof signal.videoEnabled === 'boolean') {
        setRemoteVideoAvailable(signal.videoEnabled);
        return;
      }
      if (!peer) return;
      signalQueue = signalQueue.then(async () => {
        if (disposed || !peer) return;
        if ((signal.type === 'offer' || signal.type === 'answer') && typeof signal.sdp === 'string') {
          await peer.setRemoteDescription(new RTCSessionDescription({ type: signal.type, sdp: signal.sdp }));
          if (process.env.NODE_ENV === 'development') {
            console.debug('[Calling WebRTC] Remote description applied:', signal.type);
          }
          await flushCandidates();
          if (signal.type === 'offer') {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            if (peer.localDescription) {
              emitSignal({ type: peer.localDescription.type, sdp: peer.localDescription.sdp || '' } as RTCSessionDescriptionInit);
            }
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const candidate = signal.candidate as RTCIceCandidateInit;
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
            if (process.env.NODE_ENV === 'development') console.debug('[Calling WebRTC] Remote ICE candidate added.');
          }
          else pendingCandidates.push(candidate);
        }
      }).catch(() => {
        if (!disposed) setMediaError('The secure audio connection was interrupted.');
      });
    };

    const setupMedia = async () => {
      try {
        const rtcConfiguration = await getRtcConfiguration();
        const mediaResults = await Promise.allSettled([
          navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
          navigator.mediaDevices.getUserMedia({ audio: false, video: true }),
        ]);
        const [audioResult, videoResult] = mediaResults;
        const stream = new MediaStream();
        if (audioResult.status === 'fulfilled') {
          audioResult.value.getAudioTracks().forEach((track) => stream.addTrack(track));
        } else {
          throw new Error('Microphone access is required to join this call.');
        }
        if (videoResult.status === 'fulfilled') {
          videoResult.value.getVideoTracks().forEach((track) => stream.addTrack(track));
        } else {
          setCameraEnabled(false);
          setMediaError('Camera access is unavailable. You can continue with audio.');
        }
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        peer = new RTCPeerConnection({ iceServers: rtcConfiguration.iceServers });
        stream.getTracks().forEach((track) => peer?.addTrack(track, stream));
        if (process.env.NODE_ENV === 'development') {
          console.info('[Calling WebRTC] Local tracks published:', stream.getTracks().map(({ kind }) => kind));
          if (!rtcConfiguration.turnConfigured) {
            console.warn('[Calling WebRTC] TURN is not configured; peers behind restrictive NATs may not connect.');
          }
        }
        if (!rtcConfiguration.turnConfigured) {
          setNetworkWarning('TURN is not configured. Calls may fail on restrictive networks.');
        }
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            if (process.env.NODE_ENV === 'development') {
              console.debug('[Calling WebRTC] ICE candidate gathered:', event.candidate.type);
            }
            emitSignal({ type: 'candidate', candidate: event.candidate.toJSON() });
          }
        };
        peer.onicegatheringstatechange = () => {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[Calling WebRTC] ICE gathering state:', peer?.iceGatheringState);
            if (peer?.iceGatheringState === 'complete') void logRtcIceDiagnostics(peer, 'Calling WebRTC');
          }
        };
        peer.ontrack = (event) => {
          const remoteStream = remoteStreamRef.current ?? new MediaStream();
          remoteStreamRef.current = remoteStream;
          const tracks = event.streams[0]?.getTracks() ?? [event.track];
          for (const track of tracks) {
            if (!remoteStream.getTracks().some((remoteTrack) => remoteTrack.id === track.id)) {
              remoteStream.addTrack(track);
            }
          }
          if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }
          if (event.track.kind === 'video') {
            setRemoteVideoAvailable(event.track.readyState === 'live');
            event.track.onmute = () => setRemoteVideoAvailable(false);
            event.track.onunmute = () => setRemoteVideoAvailable(true);
            event.track.onended = () => setRemoteVideoAvailable(false);
          }
          if (audioRef.current) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.muted = false;
            audioRef.current.volume = 1;
          }
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          if (process.env.NODE_ENV === 'development') {
            console.info('[Calling WebRTC] Remote track received:', event.track.kind);
          }
          void audioRef.current?.play().catch(() => {
            if (!disposed) setMediaError('Audio playback was blocked. Allow audio playback in your browser and try again.');
          });
          void remoteVideoRef.current?.play().catch((error: unknown) => {
            if (!disposed) console.warn('[Calling WebRTC] Remote video playback was blocked:', error);
          });
        };
        peer.oniceconnectionstatechange = () => {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[Calling WebRTC] ICE state:', peer?.iceConnectionState);
            if (peer?.iceConnectionState === 'connected' || peer?.iceConnectionState === 'completed') {
              void logRtcIceDiagnostics(peer, 'Calling WebRTC');
            }
          }
          if (peer?.iceConnectionState === 'failed') {
            setMediaError('ICE connection failed. Configure reachable TURN servers and verify firewall access.');
          }
        };
        peer.onconnectionstatechange = () => {
          if (!peer) return;
          if (process.env.NODE_ENV === 'development') {
            console.debug('[Calling WebRTC] Peer state:', peer.connectionState);
          }
          if (peer.connectionState === 'connected') {
            if (disconnectedTimer) window.clearTimeout(disconnectedTimer);
            disconnectedTimer = undefined;
            setConnected(true);
            setMediaError('');
            setNetworkWarning('');
          } else if (peer.connectionState === 'failed') {
            setConnected(false);
            setMediaError('The peer-to-peer media connection failed. Check the network and TURN configuration.');
          } else if (peer.connectionState === 'disconnected' && !disconnectedTimer) {
            disconnectedTimer = window.setTimeout(() => {
              if (peer?.connectionState === 'disconnected') {
                setConnected(false);
                setMediaError('The other user’s audio connection was interrupted.');
              }
              disconnectedTimer = undefined;
            }, 5000);
          } else if (peer.connectionState === 'connecting') {
            setConnected(false);
          }
        };
        socket.on('call:joined', onJoined);
        socket.on('call:peer-ready', onPeerReady);
        socket.on('call:signal', onSignal);
        socket.on('connect', joinCallRoom);
        if (socket.connected) joinCallRoom();
      } catch (error) {
        setMediaError(error instanceof Error
          ? error.message
          : 'Media setup failed. Check microphone/camera permissions and TURN configuration.');
      }
    };

    void setupMedia();
    const durationTimer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => {
      disposed = true;
      window.clearInterval(durationTimer);
      if (disconnectedTimer) window.clearTimeout(disconnectedTimer);
      socket.off('call:joined', onJoined);
      socket.off('call:peer-ready', onPeerReady);
      socket.off('call:signal', onSignal);
      socket.off('connect', joinCallRoom);
      socket.emit('call:leave', { sessionId: call.sessionId });
      peer?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      if (audioRef.current) audioRef.current.srcObject = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
  }, [call.sessionId, call.sessionToken, call.direction, call.status]);

  function toggleMute() {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  }

  function toggleCamera() {
    const nextEnabled = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = nextEnabled; });
    setCameraEnabled(nextEnabled);
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('call:signal', {
        sessionId: call.sessionId,
        signal: { type: 'media-state', videoEnabled: nextEnabled },
      });
    }

  }

  function toggleSpeaker() {
    const nextEnabled = !speakerEnabled;
    setSpeakerEnabled(nextEnabled);
    if (audioRef.current) audioRef.current.muted = !nextEnabled;
  }

  const elapsed = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <section className="relative mx-auto w-full overflow-hidden rounded-[2rem] border theme-border theme-bg-card p-4 shadow-[var(--shadow-lg)] sm:p-6 lg:p-8" aria-live="polite">
      <audio ref={audioRef} autoPlay playsInline muted={false} />
      {call.status === 'accepted' && (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          <div className="relative aspect-video overflow-hidden rounded-2xl border theme-border bg-slate-950">
            <video ref={remoteVideoRef} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover ${remoteVideoAvailable ? '' : 'hidden'}`} />
            {!remoteVideoAvailable && (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Avatar name={call.peer.displayName} src={call.peer.avatar || undefined} size="xl" shape="circle" />
                <span className="text-xs text-white/70">Waiting for {call.peer.displayName}&apos;s video</span>
              </div>
            )}
            <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white">{call.peer.displayName}</span>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-2xl border theme-border bg-slate-950">
            <video ref={localVideoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${cameraEnabled ? '' : 'hidden'}`} />
            {!cameraEnabled && (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Avatar name={currentUser?.fullName || 'You'} src={currentUser?.avatar} size="xl" shape="circle" />
                <span className="text-xs text-white/70">Camera off</span>
              </div>
            )}
            <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white">{currentUser?.fullName || 'You'} (You)</span>
          </div>
        </div>
      )}
      <div className="relative flex flex-col items-center rounded-3xl border p-7 text-center sm:p-10" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-accent-strip)' }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent" />
        {call.status !== 'accepted' && <div className="relative"><Avatar name={call.peer.displayName} src={call.peer.avatar || undefined} size="xl" shape="circle" className="h-20 w-20 ring-4 ring-white/70 shadow-lg sm:h-24 sm:w-24" /><span className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${connected ? 'bg-emerald-500' : call.status === 'ringing' ? 'animate-pulse bg-amber-400' : 'bg-slate-400'}`} /></div>}
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider theme-text-secondary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <Activity className={`h-3.5 w-3.5 ${connected ? 'text-emerald-500' : 'text-[var(--accent)]'}`} />
          {call.direction === 'outgoing' && call.status === 'ringing' ? 'Calling WorkGrind ID' : call.status === 'accepted' ? connected ? 'Connected · secure audio/video' : 'Connecting media' : 'Call ended'}
        </div>
        <h2 className="mt-3 text-xl font-bold tracking-tight theme-text-primary sm:text-2xl">{call.peer.displayName}</h2>
        <p className="mt-1 font-mono text-xs tracking-wider theme-text-muted">{call.peer.callingId}</p>
        {call.status === 'accepted' && (
          <p className="mt-4 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums theme-text-secondary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>{elapsed}</p>
        )}
        {call.status === 'accepted' && !connected && !mediaError && <div className="mt-4 flex items-center justify-center gap-2 text-xs theme-text-muted"><LoaderCircle className="h-4 w-4 animate-spin" />Waiting for secure peer-to-peer media</div>}
      </div>
      {mediaError && <p role="alert" className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-xs leading-relaxed text-rose-600">{mediaError}</p>}
      {networkWarning && <p role="status" className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700">{networkWarning}</p>}
      <div className="mx-auto mt-5 flex w-fit max-w-full items-center justify-center gap-2 rounded-full border p-2 shadow-[var(--shadow-md)] theme-bg-card theme-border sm:gap-3">
        {call.status === 'accepted' && <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} title={muted ? 'Unmute' : 'Mute'} className={`flex h-11 w-11 items-center justify-center rounded-full border theme-border transition-colors ${muted ? 'bg-rose-500/10 text-rose-600' : 'theme-text-primary hover:bg-[var(--bg-hover)]'}`}>{muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>}
        {call.status === 'accepted' && <button type="button" onClick={toggleCamera} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} className={`flex h-11 w-11 items-center justify-center rounded-full border theme-border transition-colors ${cameraEnabled ? 'theme-text-primary hover:bg-[var(--bg-hover)]' : 'bg-rose-500/10 text-rose-600'}`}>{cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}</button>}
        {call.status === 'accepted' && <button type="button" onClick={toggleSpeaker} aria-label={speakerEnabled ? 'Mute speaker' : 'Enable speaker'} title={speakerEnabled ? 'Speaker on' : 'Speaker off'} className={`flex h-11 w-11 items-center justify-center rounded-full border theme-border transition-colors ${speakerEnabled ? 'theme-text-primary hover:bg-[var(--bg-hover)]' : 'bg-rose-500/10 text-rose-600'}`}>{speakerEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>}
        <button type="button" onClick={onHangUp} aria-label={call.status === 'ringing' ? 'Cancel call' : 'End call'} className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-700"><PhoneOff className="h-5 w-5" /></button>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] theme-text-muted"><ShieldCheck className="h-3.5 w-3.5" />Encrypted peer-to-peer media; no recording is created</p>
    </section>
  );
}
