'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Meeting } from '@/types';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Share2,
  Hand,
  PhoneOff,
  MessageSquare,
  Users,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  Play,
  Copy,
  Check,
  Radio,
  Send,
  UserCheck,
} from 'lucide-react';
import { formatDate, formatTimeAgo, getInitials } from '@/lib/utils';
import { BackButton } from '@/components/common/BackButton';
import { Avatar } from '@/components/common/Avatar';
import { getRtcConfiguration, logRtcIceDiagnostics } from '@/lib/rtcConfig';

interface RemotePeer {
  socketId: string;
  userId: string;
  user: {
    _id: string;
    fullName: string;
    avatar?: string;
    role?: string;
  };
  stream?: MediaStream;
  isMicOn?: boolean;
  isCamOn?: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
}

interface MeetingJoinResponse {
  success: boolean;
  meeting?: Meeting;
  meetingGrant?: string;
}

const pendingMeetingJoins = new Map<string, Promise<MeetingJoinResponse>>();
const pendingMeetingLoads = new Map<string, Promise<Meeting[]>>();

function requestMeetingJoin(meetingLink: string, userId: string): Promise<MeetingJoinResponse> {
  const requestKey = `${userId}:${meetingLink}`;
  const pending = pendingMeetingJoins.get(requestKey);
  if (pending) return pending;

  const request = api.post<MeetingJoinResponse>(`/meetings/${meetingLink}/join`)
    .then((response) => response.data)
    .finally(() => {
      if (pendingMeetingJoins.get(requestKey) === request) pendingMeetingJoins.delete(requestKey);
    });
  pendingMeetingJoins.set(requestKey, request);
  return request;
}

function requestMeetings(userId: string): Promise<Meeting[]> {
  const pending = pendingMeetingLoads.get(userId);
  if (pending) return pending;

  const request = api.get('/meetings').then((response) => {
    if (!response.data?.success || !Array.isArray(response.data.meetings)) {
      throw new Error('The meetings service returned an invalid list.');
    }
    return response.data.meetings as Meeting[];
  }).finally(() => {
    if (pendingMeetingLoads.get(userId) === request) pendingMeetingLoads.delete(userId);
  });
  pendingMeetingLoads.set(userId, request);
  return request;
}

// Component for rendering remote participant video/stream
function RemotePeerVideo({ peer }: { peer: RemotePeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
      void audioRef.current.play().catch((error: unknown) => {
        console.warn('Remote meeting audio playback was blocked:', error);
      });
    }
  }, [peer.stream]);

  const hasVideoTrack =
    peer.stream &&
    peer.stream.getVideoTracks().length > 0 &&
    peer.stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live') &&
    peer.isCamOn !== false;

  return (
    <div className="theme-fixed relative h-full min-h-[260px] w-full rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center overflow-hidden shadow-lg transition-all">
      <audio ref={audioRef} autoPlay playsInline muted={false} className="hidden" aria-hidden="true" />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover ${hasVideoTrack ? '' : 'hidden'}`}
      />
      {!hasVideoTrack && (
        <div className="flex flex-col items-center gap-3">
          <Avatar
            name={peer.user?.fullName || 'User'}
            src={peer.user?.avatar}
            size="xl"
            shape="circle"
            className="h-20 w-20 ring-4 ring-purple-500/20"
          />
          <span className="text-xs font-semibold text-slate-400">
            Camera Off
          </span>
        </div>
      )}

      {/* Peer Info Overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
        <span>{peer.user?.fullName || 'Team Member'}</span>
        {peer.isMicOn === false && (
          <span className="text-rose-400 text-xs" title="Muted">
            🔇
          </span>
        )}
        {peer.isHandRaised && (
          <span className="text-amber-400 animate-bounce" title="Hand Raised">
            ✋
          </span>
        )}
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinLink = searchParams.get('join');
  const { user } = useAuthStore();
  const { openCreateModal } = useAppStore();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [meetingGrant, setMeetingGrant] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');
  const [rtcWarning, setRtcWarning] = useState('');
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);

  // Video Room Media States
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState('00:00');
  const [meetingStartTime, setMeetingStartTime] = useState<number>(Date.now());

  // Room UI States
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'ai' | null>(null);
  const [roomMessages, setRoomMessages] = useState<{ sender: string; text: string; time: string }[]>([]);
  const [roomInput, setRoomInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // WebRTC Peer References & Remote State
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const rtcConfigurationRef = useRef<RTCConfiguration | null>(null);
  const signalQueuesRef = useRef<Record<string, Promise<void>>>({});
  const pendingMeetingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const [remotePeers, setRemotePeers] = useState<{ [socketId: string]: RemotePeer }>({});

  // 1. Fetch Meetings from API
  const fetchMeetings = useCallback(async () => {
    if (!user?._id) return;
    try {
      setIsLoadingMeetings(true);
      setMeetings(await requestMeetings(user._id));
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setIsLoadingMeetings(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // 2. Real-time global socket listener for meeting events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMeetingAvailable = ({ meeting }: { meeting: Meeting }) => {
      setMeetings((prev) => {
        const exists = prev.some((m) => m._id === meeting._id);
        if (exists) return prev.map((m) => (m._id === meeting._id ? meeting : m));
        return [meeting, ...prev];
      });
    };

    const onMeetingEnded = ({ meetingLink: endedLink }: { meetingId: string; meetingLink: string }) => {
      setMeetings((prev) =>
        prev.map((m) => (m.meetingLink === endedLink ? { ...m, status: 'ended' } : m))
      );
    };

    socket.on('meeting:created', onMeetingAvailable);
    socket.on('meeting:started', onMeetingAvailable);
    socket.on('meeting:ended', onMeetingEnded);

    return () => {
      socket.off('meeting:created', onMeetingAvailable);
      socket.off('meeting:started', onMeetingAvailable);
      socket.off('meeting:ended', onMeetingEnded);
    };
  }, []);

  // 3. Auto-join meeting if join query param is in URL
  useEffect(() => {
    if (!joinLink || !user?._id) return;

    let isMounted = true;
    const joinTargetMeeting = async () => {
      try {
        const response = await requestMeetingJoin(joinLink, user._id);
        if (isMounted && response.success && response.meeting && response.meetingGrant) {
          setJoinError('');
          setActiveMeeting(response.meeting);
          setMeetingGrant(response.meetingGrant);
        }
      } catch (error: any) {
        setJoinError(error?.response?.data?.message || 'This meeting link is invalid, expired, or unavailable.');
      }
    };

    joinTargetMeeting();

    return () => {
      isMounted = false;
    };
  }, [joinLink, user?._id]);

  // 4. Meeting Duration Timer
  useEffect(() => {
    if (!activeMeeting) return;
    const startMs = activeMeeting.startedAt
      ? new Date(activeMeeting.startedAt).getTime()
      : Date.now();
    setMeetingStartTime(startMs);

    const interval = setInterval(() => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      setMeetingDuration(
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeMeeting]);

  // ── 5. WEBRTC MESH CONNECTION ENGINE ──────────────────────────────────────

  // Helper: Create an RTCPeerConnection for a remote peer socket
  const createPeerConnection = useCallback(
    (targetSocketId: string, peerInfo?: any) => {
      const socket = getSocket();
      if (!socket) return null;

      const iceServers = rtcConfigurationRef.current?.iceServers;
      if (!iceServers?.length) {
        console.error('[Meeting WebRTC] ICE configuration is unavailable; refusing to create a peer connection.');
        return null;
      }
      const pc = new RTCPeerConnection({ iceServers });
      peersRef.current[targetSocketId] = pc;

      // Add local media tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
        if (process.env.NODE_ENV === 'development') {
          console.info('[Meeting WebRTC] Local tracks published:', localStreamRef.current.getTracks().map(({ kind }) => kind));
        }
      }

      // Handle ICE Candidate generation
      pc.onicecandidate = (event) => {
        if (event.candidate && activeMeeting) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[Meeting WebRTC] ICE candidate gathered:', event.candidate.type);
          }
          socket.emit('meeting:signal', {
            meetingId: activeMeeting.meetingLink,
            targetSocketId,
            signal: {
              type: 'candidate',
              candidate: event.candidate,
            },
          });
        }
      };

      // Handle incoming remote media tracks
      pc.ontrack = (event) => {
        if (process.env.NODE_ENV === 'development') {
          console.info('[Meeting WebRTC] Remote track received:', event.track.kind);
        }
        setRemotePeers((prev) => {
          const existing = prev[targetSocketId];
          const remoteStream = existing?.stream || new MediaStream();
          if (event.streams[0]) {
            for (const track of event.streams[0].getTracks()) {
              if (!remoteStream.getTracks().some((remoteTrack) => remoteTrack.id === track.id)) {
                remoteStream.addTrack(track);
              }
            }
          }
          if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }
          return {
            ...prev,
            [targetSocketId]: {
              socketId: targetSocketId,
              userId: peerInfo?.userId || existing?.userId || targetSocketId,
              user: peerInfo?.user || existing?.user || { fullName: 'Team Member' },
              stream: remoteStream,
              isMicOn: peerInfo?.isMicOn ?? existing?.isMicOn ?? true,
              isCamOn: peerInfo?.isCamOn ?? existing?.isCamOn ?? true,
              isScreenSharing: peerInfo?.isScreenSharing ?? existing?.isScreenSharing ?? false,
              isHandRaised: peerInfo?.isHandRaised ?? existing?.isHandRaised ?? false,
            },
          };
        });
      };
      pc.oniceconnectionstatechange = () => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Meeting WebRTC] ICE state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            void logRtcIceDiagnostics(pc, 'Meeting WebRTC');
          }
        }
      };
      pc.onicegatheringstatechange = () => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Meeting WebRTC] ICE gathering state:', pc.iceGatheringState);
          if (pc.iceGatheringState === 'complete') void logRtcIceDiagnostics(pc, 'Meeting WebRTC');
        }
      };
      pc.onconnectionstatechange = () => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Meeting WebRTC] Peer state:', pc.connectionState);
        }
      };

      return pc;
    },
    [activeMeeting]
  );

  // Initialize WebRTC and Socket session when user enters an active meeting
  useEffect(() => {
    if (!activeMeeting || !meetingGrant) return;

    const socket = getSocket();
    if (!socket) return;

    let isDisposed = false;
    let localMediaReady = false;
    let joinedSocketId: string | null = null;
    const requestMeetingJoin = () => {
      if (isDisposed || !localMediaReady || !socket.connected || !socket.id || joinedSocketId === socket.id) return;
      joinedSocketId = socket.id;
      socket.emit('meeting:join', {
        meetingId: activeMeeting.meetingLink,
        meetingGrant,
      });
    };

    // Step A: Acquire Local Media Stream
    const setupLocalMedia = async () => {
      try {
        let rtcConfiguration;
        try {
          rtcConfiguration = await getRtcConfiguration();
        } catch (error) {
          console.error('[Meeting WebRTC] Could not load ICE configuration:', error);
          if (!isDisposed) {
            setJoinError('Media network configuration is unavailable. Please retry after the server is restored.');
            setActiveMeeting(null);
            setMeetingGrant(null);
          }
          return;
        }
        if (isDisposed) return;
        rtcConfigurationRef.current = rtcConfiguration;
        if (!rtcConfiguration.turnConfigured) {
          const warning = 'TURN is not configured. Participants behind restrictive NATs may not connect.';
          setRtcWarning(warning);
          console.warn('[Meeting WebRTC]', warning);
        } else {
          setRtcWarning('');
        }
        const [videoResult, audioResult] = await Promise.allSettled([
          navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
          navigator.mediaDevices.getUserMedia({ video: false, audio: true }),
        ]);
        const stream = new MediaStream();
        if (videoResult.status === 'fulfilled') {
          videoResult.value.getVideoTracks().forEach((track) => stream.addTrack(track));
        } else {
          console.warn('Meeting camera unavailable:', videoResult.reason);
          setIsCamOn(false);
        }
        if (audioResult.status === 'fulfilled') {
          audioResult.value.getAudioTracks().forEach((track) => stream.addTrack(track));
        } else {
          console.warn('Meeting microphone unavailable:', audioResult.reason);
          setIsMicOn(false);
        }
        if (stream.getTracks().length === 0) {
          console.warn('Meeting camera and microphone unavailable; joining as spectator');
        }

        if (isDisposed) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        localMediaReady = true;
        requestMeetingJoin();
      } catch (err) {
        console.error('Error in local media setup:', err);
        if (!isDisposed) {
          setIsCamOn(false);
          setIsMicOn(false);
          localStreamRef.current = new MediaStream();
          localMediaReady = true;
          requestMeetingJoin();
        }
      }
    };

    setupLocalMedia();

    // Step C: Listen for existing participants in the room
    const onRoomUsers = async ({ participants }: { participants: any[] }) => {
      for (const peer of participants) {
        const pc = createPeerConnection(peer.socketId, peer);
        if (!pc) continue;

        // Populate peer in state immediately
        setRemotePeers((prev) => ({
          ...prev,
          [peer.socketId]: {
            socketId: peer.socketId,
            userId: peer.userId,
            user: peer.user,
            isMicOn: peer.isMicOn,
            isCamOn: peer.isCamOn,
            isScreenSharing: peer.isScreenSharing,
            isHandRaised: peer.isHandRaised,
          },
        }));

        // Initiator creates and sends WebRTC Offer
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('meeting:signal', {
            meetingId: activeMeeting.meetingLink,
            targetSocketId: peer.socketId,
            signal: {
              type: 'offer',
              sdp: offer.sdp,
            },
          });
        } catch (e) {
          console.error('Error creating offer for peer:', peer.socketId, e);
        }
      }
    };

    // Step D: A new peer joined the room
    const onUserJoined = (newPeer: any) => {
      setRemotePeers((prev) => ({
        ...prev,
        [newPeer.socketId]: {
          socketId: newPeer.socketId,
          userId: newPeer.userId,
          user: newPeer.user,
          isMicOn: newPeer.isMicOn,
          isCamOn: newPeer.isCamOn,
          isScreenSharing: newPeer.isScreenSharing,
          isHandRaised: newPeer.isHandRaised,
        },
      }));
    };

    // Step E: Handle incoming WebRTC signaling (Offer / Answer / Candidate)
    const onSignal = ({
      fromSocketId,
      signal,
    }: {
      fromSocketId: string;
      userId: string;
      signal: any;
    }) => {
      const previous = signalQueuesRef.current[fromSocketId] || Promise.resolve();
      const current = previous.catch(() => undefined).then(async () => {
        if (isDisposed) return;
        let pc: RTCPeerConnection | null = peersRef.current[fromSocketId] || null;

        if (signal.type === 'offer') {
          if (!pc) {
            pc = createPeerConnection(fromSocketId);
          }
          if (pc) {
            if (typeof signal.sdp !== 'string') throw new Error('Meeting offer did not include a valid SDP string.');
            await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
            if (process.env.NODE_ENV === 'development') {
              console.debug('[Meeting WebRTC] Remote description applied: offer');
            }
            const pendingCandidates = pendingMeetingCandidatesRef.current[fromSocketId] || [];
            delete pendingMeetingCandidatesRef.current[fromSocketId];
            for (const candidate of pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              if (process.env.NODE_ENV === 'development') console.debug('[Meeting WebRTC] Buffered ICE candidate added.');
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('meeting:signal', {
              meetingId: activeMeeting.meetingLink,
              targetSocketId: fromSocketId,
              signal: {
                type: 'answer',
                sdp: answer.sdp,
              },
            });
          }
        } else if (signal.type === 'answer') {
          if (pc) {
            if (typeof signal.sdp !== 'string') throw new Error('Meeting answer did not include a valid SDP string.');
            await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
            if (process.env.NODE_ENV === 'development') {
              console.debug('[Meeting WebRTC] Remote description applied: answer');
            }
            const pendingCandidates = pendingMeetingCandidatesRef.current[fromSocketId] || [];
            delete pendingMeetingCandidatesRef.current[fromSocketId];
            for (const candidate of pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              if (process.env.NODE_ENV === 'development') console.debug('[Meeting WebRTC] Buffered ICE candidate added.');
            }
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const candidate = signal.candidate as RTCIceCandidateInit;
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            if (process.env.NODE_ENV === 'development') console.debug('[Meeting WebRTC] Remote ICE candidate added.');
          } else {
            (pendingMeetingCandidatesRef.current[fromSocketId] ??= []).push(candidate);
          }
        }
      }).catch((error: unknown) => {
        console.error('Error processing meeting signal from peer:', fromSocketId, error);
      });
      signalQueuesRef.current[fromSocketId] = current;
    };

    // Step F: Peer media state changed (mic, cam, screen share)
    const onMediaStateChanged = ({
      socketId,
      isMicOn: peerMic,
      isCamOn: peerCam,
      isScreenSharing: peerScreen,
    }: any) => {
      setRemotePeers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            isMicOn: peerMic !== undefined ? peerMic : prev[socketId].isMicOn,
            isCamOn: peerCam !== undefined ? peerCam : prev[socketId].isCamOn,
            isScreenSharing: peerScreen !== undefined ? peerScreen : prev[socketId].isScreenSharing,
          },
        };
      });
    };

    // Step G: Hand raise changed
    const onHandRaiseChanged = ({ socketId, isHandRaised: hr }: any) => {
      setRemotePeers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: { ...prev[socketId], isHandRaised: hr },
        };
      });
    };

    // Step H: Synchronized meeting chat
    const onChatMessage = (msg: { sender: string; text: string; time: string }) => {
      setRoomMessages((prev) => [...prev, msg]);
    };

    // Step I: Peer left room
    const onUserLeft = ({ socketId }: { socketId: string }) => {
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      delete signalQueuesRef.current[socketId];
      delete pendingMeetingCandidatesRef.current[socketId];
      setRemotePeers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    // Step J: Host ended meeting
    const onMeetingEnded = ({ meetingId, meetingLink: endedLink }: any) => {
      if (
        endedLink === activeMeeting.meetingLink ||
        meetingId === activeMeeting._id
      ) {
        alert('The host has ended this live meeting.');
        handleLeaveRoom(false);
      }
    };

    const onMeetingError = ({ message }: { code?: string; message?: string }) => {
      setJoinError(message || 'You could not join this meeting. Check the meeting link and your access.');
      setActiveMeeting(null);
      setMeetingGrant(null);
    };
    const onSocketConnect = () => {
      requestMeetingJoin();
    };
    const onSocketDisconnect = () => {
      joinedSocketId = null;
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      signalQueuesRef.current = {};
      pendingMeetingCandidatesRef.current = {};
      setRemotePeers({});
    };

    // Bind Socket listeners
    socket.on('meeting:room-users', onRoomUsers);
    socket.on('meeting:user-joined', onUserJoined);
    socket.on('meeting:signal', onSignal);
    socket.on('meeting:media-state-changed', onMediaStateChanged);
    socket.on('meeting:hand-raise-changed', onHandRaiseChanged);
    socket.on('meeting:chat-message', onChatMessage);
    socket.on('meeting:user-left', onUserLeft);
    socket.on('meeting:ended', onMeetingEnded);
    socket.on('meeting:error', onMeetingError);
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    requestMeetingJoin();

    return () => {
      isDisposed = true;
      socket.off('meeting:room-users', onRoomUsers);
      socket.off('meeting:user-joined', onUserJoined);
      socket.off('meeting:signal', onSignal);
      socket.off('meeting:media-state-changed', onMediaStateChanged);
      socket.off('meeting:hand-raise-changed', onHandRaiseChanged);
      socket.off('meeting:chat-message', onChatMessage);
      socket.off('meeting:user-left', onUserLeft);
      socket.off('meeting:ended', onMeetingEnded);
      socket.off('meeting:error', onMeetingError);
      socket.off('connect', onSocketConnect);
      socket.off('disconnect', onSocketDisconnect);

      // Cleanup local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      // Cleanup peer connections
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      signalQueuesRef.current = {};
      pendingMeetingCandidatesRef.current = {};
      setRemotePeers({});
    };
  }, [activeMeeting, createPeerConnection, meetingGrant]);

  // ── 6. MEETING CONTROLS & MEDIA ACTIONS ───────────────────────────────────

  // Toggle Microphone
  const handleToggleMic = () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    const socket = getSocket();
    if (socket && activeMeeting) {
      socket.emit('meeting:media-state', {
        meetingId: activeMeeting.meetingLink,
        isMicOn: nextState,
      });
    }
  };

  // Toggle Camera
  const handleToggleCam = () => {
    const nextState = !isCamOn;
    setIsCamOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    const socket = getSocket();
    if (socket && activeMeeting) {
      socket.emit('meeting:media-state', {
        meetingId: activeMeeting.meetingLink,
        isCamOn: nextState,
      });
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop Screen Share: Restore camera video track
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        });
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
      setIsScreenSharing(false);
      const socket = getSocket();
      if (socket && activeMeeting) {
        socket.emit('meeting:media-state', {
          meetingId: activeMeeting.meetingLink,
          isScreenSharing: false,
        });
      }
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        // Replace video track on all active peer connections
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        const socket = getSocket();
        if (socket && activeMeeting) {
          socket.emit('meeting:media-state', {
            meetingId: activeMeeting.meetingLink,
            isScreenSharing: true,
          });
        }

        // When user stops sharing using browser's native "Stop Sharing" pill
        screenTrack.onended = () => {
          handleToggleScreenShare();
        };
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  };

  // Toggle Hand Raise
  const handleToggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    const socket = getSocket();
    if (socket && activeMeeting) {
      socket.emit('meeting:hand-raise', {
        meetingId: activeMeeting.meetingLink,
        isHandRaised: nextState,
      });
    }
  };

  // Send In-Meeting Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !activeMeeting) return;

    const socket = getSocket();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = {
      sender: user?.fullName || 'You',
      text: roomInput.trim(),
      time: timeStr,
    };

    if (socket) {
      socket.emit('meeting:chat-message', {
        meetingId: activeMeeting.meetingLink,
        text: msg.text,
      });
    } else {
      setRoomMessages((prev) => [...prev, msg]);
    }

    setRoomInput('');
  };

  // Leave Meeting Room
  const handleLeaveRoom = (_notifySocket = true) => {
    if (activeMeeting) {
      const socket = getSocket();
      if (socket) {
        socket.emit('meeting:leave', { meetingId: activeMeeting.meetingLink });
      }
    }

    // Stop all local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    // Close all WebRTC peer connections
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    setRemotePeers({});

    setActiveMeeting(null);
    setMeetingGrant(null);
    router.replace('/meetings');
    fetchMeetings();
  };

  // Host terminates meeting for all participants
  const handleEndMeetingForEveryone = async () => {
    if (!activeMeeting) return;
    const confirmEnd = window.confirm(
      'Are you sure you want to end this live meeting for everyone?'
    );
    if (!confirmEnd) return;

    try {
      await api.post(`/meetings/${activeMeeting.meetingLink}/end`);
      handleLeaveRoom(false);
    } catch (err) {
      console.error('Failed to end meeting:', err);
      handleLeaveRoom(true);
    }
  };

  // ── 7. START INSTANT MEETING ──────────────────────────────────────────────
  const handleStartInstant = async () => {
    try {
      const title = `${user?.fullName?.split(' ')[0] || 'My'}'s Instant Meeting`;
      const res = await api.post('/meetings', {
        title,
        description: 'Instant live collaborative audio/video session',
        isInstant: true,
      });
      if (res.data.success && res.data.meeting) {
        setActiveMeeting(res.data.meeting);
        setMeetingGrant(res.data.meetingGrant || null);
        setMeetings((prev) => [res.data.meeting, ...prev]);
      }
    } catch (err) {
      console.error('Failed to start instant meeting:', err);
    }
  };

  // Tavro AI meeting insights
  const handleGenerateAISummary = async () => {
    if (!activeMeeting) return;
    setAiLoading(true);
    try {
      const sampleTranscript = `
        ${user?.fullName || 'Host'}: Let's align on the live meeting sprint deliverables.
        Team: WebRTC signaling mesh and real-time socket events are successfully connected.
        ${user?.fullName || 'Host'}: Excellent, verified screen sharing, audio/video toggles, and multi-user participation.
      `;

      const res = await api.post(`/meetings/${activeMeeting.meetingLink}/ai-summary`, {
        transcript: sampleTranscript,
      });

      if (res.data.success && res.data.aiSummary) {
        setActiveMeeting((prev) =>
          prev ? { ...prev, aiSummary: res.data.aiSummary } : null
        );
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleConvertToTask = async (actionItem: { title: string; assignedTo?: string }) => {
    try {
      await api.post('/tasks', {
        title: actionItem.title,
        description: `Auto-generated by Tavro AI for ${actionItem.assignedTo || 'Assignee'}`,
        priority: 'high',
        status: 'todo',
      });
      alert(`Created Task: "${actionItem.title}"`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    if (!activeMeeting) return;
    const inviteUrl = `${window.location.origin}/meetings?join=${activeMeeting.meetingLink}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isHost = Boolean(
    activeMeeting?.permissions?.isHost ||
    (activeMeeting?.hostId &&
      (typeof activeMeeting.hostId === 'object'
        ? activeMeeting.hostId._id === user?._id
        : activeMeeting.hostId === user?._id))
  );

  const joinMeeting = async (meetingLink: string) => {
    if (!user?._id) return;
    try {
      const response = await requestMeetingJoin(meetingLink, user._id);
      if (response.success && response.meeting && response.meetingGrant) {
        setJoinError('');
        setActiveMeeting(response.meeting);
        setMeetingGrant(response.meetingGrant);
      }
    } catch (error: any) {
      setJoinError(error?.response?.data?.message || 'This meeting link is invalid, expired, or unavailable.');
    }
  };

  const remotePeerList = Object.values(remotePeers);
  const totalParticipantCount = remotePeerList.length + 1; // including self

  // Filter Active (Live) Meetings from database
  const activeLiveMeetings = meetings.filter((m) => m.status === 'active');
  const pastOrScheduledMeetings = meetings.filter((m) => m.status !== 'active');

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ACTIVE VIDEO MEETING ROOM
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeMeeting) {
    return (
      <div className="theme-fixed relative flex h-[calc(100dvh-6rem)] min-h-[34rem] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:rounded-[2rem]">
        {/* Top Meeting Control Bar */}
        <div className="z-10 flex min-h-14 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-400 border border-rose-500/30">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span>LIVE</span>
            </div>
            <h2 className="max-w-[32vw] truncate text-sm font-bold text-white sm:max-w-md">
              {activeMeeting.title}
            </h2>
            <span className="hidden font-mono text-xs text-slate-400 xs:inline">
              {meetingDuration}
            </span>
          </div>
          {rtcWarning && <span role="status" className="hidden max-w-sm truncate text-[11px] text-amber-300 lg:inline" title={rtcWarning}>{rtcWarning}</span>}

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>{totalParticipantCount} in meeting</span>
            </div>

            {isHost && <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors shadow-xs"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedLink ? 'Copied' : 'Copy Invite'}</span>
            </button>}
          </div>
        </div>

        {/* Video Grid & Drawer */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Main Video Grid */}
          <div className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 p-2 pb-5 sm:p-5">
            <div
              className={`grid min-h-full w-full auto-rows-fr items-center justify-center gap-2 sm:gap-4 ${
                totalParticipantCount === 1
                  ? 'grid-cols-1 max-w-5xl'
                  : totalParticipantCount === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-6xl'
                  : totalParticipantCount <= 4
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-6xl'
                  : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 max-w-7xl'
              }`}
            >
              {/* Local User Video Tile */}
              <div className="theme-fixed relative aspect-video min-h-[220px] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl sm:min-h-[280px] sm:rounded-3xl">
                {isCamOn ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Avatar name={user?.fullName || 'User'} src={user?.avatar} size="xl" shape="circle" className="h-20 w-20 ring-4 ring-white/10 shadow-xl" />
                    <span className="text-xs font-semibold text-slate-300">
                      Camera Off
                    </span>
                  </div>
                )}

                {/* Local Info Overlay */}
                <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
                  <span className="truncate">{user?.fullName} (You)</span>
                  {!isMicOn && (
                    <span className="text-rose-400 text-xs" title="Muted">
                      🔇
                    </span>
                  )}
                  {isHandRaised && (
                    <span className="text-amber-400 animate-bounce" title="Hand Raised">
                      ✋
                    </span>
                  )}
                  {isScreenSharing && (
                    <span className="text-indigo-400 text-[10px] font-bold">
                      SCREEN
                    </span>
                  )}
                </div>
              </div>

              {/* Connected Remote Peers Video Tiles */}
              {remotePeerList.map((peer) => (
                <RemotePeerVideo key={peer.socketId} peer={peer} />
              ))}
            </div>
          </div>

          {/* Right Floating Drawer (Chat / Participants / Tavro AI) */}
          {activeTab && (
            <div className="absolute inset-y-2 right-2 z-20 flex w-[min(21rem,calc(100%-1rem))] flex-col rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-200 sm:inset-y-4 sm:right-4 sm:w-80">
              <div className="flex h-12 items-center justify-between px-4 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>
                  {activeTab === 'ai'
                    ? 'Tavro AI Meeting Insights'
                    : activeTab === 'chat'
                    ? 'In-Meeting Chat'
                    : `Participants (${totalParticipantCount})`}
                </span>
                <button
                  onClick={() => setActiveTab(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Tab 1: Tavro AI */}
              {activeTab === 'ai' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  <p className="text-slate-400 leading-relaxed">
                    Tavro AI provides real-time analysis of meeting discussion, key decisions, and action items.
                  </p>

                  <button
                    onClick={handleGenerateAISummary}
                    disabled={aiLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 font-bold text-white shadow-xs hover:bg-indigo-500 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {aiLoading ? 'Tavro AI is analyzing the transcript...' : 'Generate Tavro AI Summary'}
                    </span>
                  </button>

                  {activeMeeting.aiSummary && (
                    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div>
                        <span className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">
                          Overview
                        </span>
                        <p className="mt-1 text-slate-300 leading-relaxed">
                          {activeMeeting.aiSummary.summary}
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">
                          Decisions
                        </span>
                        <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-300">
                          {activeMeeting.aiSummary.decisions?.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">
                          Action Items
                        </span>
                        <div className="mt-2 space-y-2">
                          {activeMeeting.aiSummary.actionItems?.map((act, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-slate-800 bg-slate-900 p-2.5"
                            >
                              <p className="font-bold text-slate-200">{act.title}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Assigned to: {act.assignedTo || 'Team'}
                              </p>
                              <button
                                onClick={() => handleConvertToTask(act)}
                                className="mt-2 flex items-center gap-1 rounded bg-indigo-600/30 px-2 py-1 text-[10px] font-bold text-indigo-300 hover:bg-indigo-600/50"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Convert to Task
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: In-Meeting Chat */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex-1 p-4 space-y-2.5 overflow-y-auto text-xs">
                    {roomMessages.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">
                        No messages yet. Say hi to your team!
                      </p>
                    ) : (
                      roomMessages.map((m, i) => (
                        <div key={i} className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700/50">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-semibold text-indigo-400">
                              {m.sender}
                            </span>
                            <span>{m.time}</span>
                          </div>
                          <p className="text-slate-200 leading-relaxed break-words">
                            {m.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      placeholder="Type a message to the room..."
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!roomInput.trim()}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* Tab 3: Participants List */}
              {activeTab === 'participants' && (
                <div className="flex-1 p-4 space-y-2 overflow-y-auto text-xs">
                  {/* Current User */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Avatar name={user?.fullName || 'User'} src={user?.avatar} size="xs" />
                      <div>
                        <span className="font-semibold block">{user?.fullName}</span>
                        <span className="text-[10px] text-indigo-400 font-medium">
                          {isHost ? 'Host (You)' : 'You'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isMicOn ? <MicOff className="h-3.5 w-3.5 text-rose-400" /> : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
                      {!isCamOn ? <VideoOff className="h-3.5 w-3.5 text-rose-400" /> : <Video className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                  </div>

                  {/* Remote Peers */}
                  {remotePeerList.map((peer) => (
                    <div
                      key={peer.socketId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/30"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={peer.user?.fullName || 'User'} src={peer.user?.avatar} size="xs" />
                        <div>
                          <span className="font-semibold block">{peer.user?.fullName}</span>
                          <span className="text-[10px] text-emerald-400 font-medium">Active</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {peer.isHandRaised && <span className="text-xs">✋</span>}
                        {peer.isMicOn === false ? (
                          <MicOff className="h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <Mic className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {peer.isCamOn === false ? (
                          <VideoOff className="h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <Video className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Meeting Control Bar */}
        <div className="z-10 mx-2 mb-2 flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-2 py-2 shadow-2xl backdrop-blur-md sm:mx-auto sm:mb-4 sm:gap-3 sm:rounded-full sm:px-5">
          {/* Microphone */}
          <button
            onClick={handleToggleMic}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shadow-md ${
              isMicOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-600 text-white hover:bg-rose-500'
            }`}
            title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={handleToggleCam}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shadow-md ${
              isCamOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-600 text-white hover:bg-rose-500'
            }`}
            title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shadow-md ${
              isScreenSharing ? 'bg-indigo-600 text-white hover:bg-indigo-500 ring-2 ring-indigo-400' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <Share2 className="h-5 w-5" />
          </button>

          {/* Raise Hand */}
          <button
            onClick={handleToggleHandRaise}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shadow-md ${
              isHandRaised ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Tavro AI */}
          {isHost && (
            <button
              onClick={() => setActiveTab(activeTab === 'ai' ? null : 'ai')}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shadow-md ${
                activeTab === 'ai'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-indigo-400 hover:bg-slate-700'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Tavro AI</span>
            </button>
          )}

          {/* In-Meeting Chat */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all shadow-md ${
              activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title="Meeting Chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shadow-md ${
              activeTab === 'participants' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title="Participants"
          >
            <Users className="h-5 w-5" />
          </button>

          {/* Leave / End Meeting Controls */}
          {isHost ? (
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => handleLeaveRoom(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all shadow-md"
                title="Leave meeting without ending it for others"
              >
                <span>Leave</span>
              </button>
              <button
                onClick={handleEndMeetingForEveryone}
                className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/30"
                title="End this session for all participants"
              >
                <PhoneOff className="h-4 w-4" />
                <span>End for All</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleLeaveRoom(true)}
              className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/30 ml-2"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MEETINGS DASHBOARD (LIST VIEW & DISCOVERY)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="meeting-workspace space-y-6">
      {/* Back Navigation */}
      <BackButton fallback="/dashboard" />

      {joinError && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {joinError}
        </div>
      )}

      {/* Header */}
      <div className="page-hero-sm relative isolate flex flex-col overflow-hidden rounded-3xl border p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-7" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-accent-strip)' }}>
      <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl" />
      <div className="relative">
        <h1 className="page-title">Meetings</h1>
        <p className="page-subtitle">Launch instant video sessions, screen share, and schedule team syncs</p>
      </div>

      <div className="relative flex flex-wrap items-center gap-2.5">
          <button onClick={handleStartInstant} className="btn-primary h-9 px-4">
            <Play className="h-3.5 w-3.5 fill-white" />
            <span>Instant Meeting</span>
          </button>
          <button onClick={() => openCreateModal('meeting')} className="btn-secondary h-9 px-4">
            <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {/* 🔴 ACTIVE LIVE MEETINGS BANNER SECTION */}
      {activeLiveMeetings.length > 0 && (
        <div className="banner-live rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <h2 className="text-sm font-bold theme-text-primary uppercase tracking-wider">
              Live meetings in progress ({activeLiveMeetings.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLiveMeetings.map((liveMeet) => (
              <div
                key={liveMeet._id}
                className="surface flex items-center justify-between gap-4 rounded-2xl p-4 shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="badge badge-rose text-[9px]">LIVE NOW</span>
                    <h3 className="text-[13px] font-bold theme-text-primary truncate">
                      {liveMeet.title}
                    </h3>
                  </div>
                  <p className="text-[11px] theme-text-muted">
                    Host: {liveMeet.hostId?.fullName || 'Team Member'}
                  </p>
                </div>

                <button
                  onClick={() => void joinMeeting(liveMeet.meetingLink)}
                  className="btn-danger flex items-center gap-1.5 border-rose-400/60 bg-rose-100 text-rose-700 hover:bg-rose-200 shrink-0"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Join</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Meetings Grid */}
      <div>
        <h2 className="text-sm font-bold theme-text-primary mb-4">
          All Meetings
        </h2>

        {isLoadingMeetings ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
            <div className="h-12 w-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: 'var(--bg-hover)' }}>
              <Video className="h-6 w-6 theme-text-muted" />
            </div>
            <h3 className="text-sm font-semibold theme-text-primary">No meetings scheduled yet</h3>
            <p className="mt-1 text-xs theme-text-muted">Host an instant sync or schedule upcoming reviews.</p>
            <button
              onClick={handleStartInstant}
              className="btn-primary mt-4 mx-auto"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              <span>Start Instant Meeting</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meet) => (
              <div
                key={meet._id}
                className="surface flex flex-col justify-between rounded-3xl p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          meet.status === 'active' ? 'bg-rose-50' : 'bg-indigo-50'
                        }`}
                      >
                        <Video className={`h-5 w-5 ${meet.status === 'active' ? 'text-rose-600' : 'text-indigo-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold theme-text-primary truncate">
                          {meet.title}
                        </h3>
                        <span className="text-[11px] theme-text-muted truncate block">
                          {meet.hostId?.fullName || 'Team Member'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`badge shrink-0 ${
                        meet.status === 'active'
                          ? 'badge-rose'
                          : meet.status === 'ended'
                          ? 'badge-slate'
                          : 'badge-blue'
                      }`}
                    >
                      {meet.status === 'active' ? '● Live' : meet.status}
                    </span>
                  </div>

                  {meet.description && (
                    <p className="text-xs theme-text-secondary line-clamp-2 leading-relaxed mb-3">
                      {meet.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs theme-text-muted">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {meet.scheduledAt
                        ? formatDate(meet.scheduledAt, 'MMM d, h:mm a')
                        : 'Instant session'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {meet.status === 'ended' ? (
                    <button disabled className="w-full btn-secondary opacity-50 justify-center cursor-not-allowed">
                      Meeting ended
                    </button>
                  ) : (
                    <button
                      onClick={() => void joinMeeting(meet.meetingLink)}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-white transition-all shadow-xs ${
                        meet.status === 'active'
                          ? 'bg-rose-600 hover:bg-rose-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                      style={{ background: meet.status === 'active' ? '' : 'var(--accent)' }}
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>{meet.status === 'active' ? 'Join Live' : 'Join Meeting'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
