import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/mongo-adapter';
import { createHash } from 'crypto';
import { connectDB } from './db';
import { getBearerToken, verifyAccessToken } from './jwt';
import CallSession from '../models/CallSession';
import Meeting from '../models/Meeting';
import MeetingAccessGrant from '../models/MeetingAccessGrant';
import Conversation from '../models/Conversation';
import RealtimePresence from '../models/RealtimePresence';
import { generateSignedAvatarUrl, isR2Configured } from '../services/r2Storage';
import User from '../models/User';
import { getAllowedClientOrigins } from './clientOrigins';
import { verifyCallSessionToken } from '../services/callSessionToken';
import { getEffectiveSubscription } from '../services/companySubscription';

let io: SocketServer;
let adapterReady: Promise<void> | null = null;
const ADAPTER_COLLECTION = 'socket.io-adapter-events';
const PRESENCE_LEASE_MS = 90_000;
const PRESENCE_HEARTBEAT_MS = 30_000;

export interface MeetingParticipant {
  socketId: string;
  userId: string;
  user: {
    _id: string;
    fullName: string;
    avatar?: string;
    email?: string;
    role?: string;
  };
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isHandRaised?: boolean;
  joinedAt: Date;
}

type GlobalCallTerminalStatus = 'completed' | 'missed' | 'rejected' | 'cancelled';
type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

const MEETING_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const userRoom = (userId: string) => `user:${userId}`;
const meetingParticipantFor = (socket: Pick<Socket, 'data'>, meetingId: string) =>
  (socket.data.meetingParticipants as Record<string, MeetingParticipant> | undefined)?.[meetingId];

export async function ensureSocketAdapterReady(): Promise<void> {
  if (!io) throw new Error('Socket.IO has not been initialized.');
  if (!adapterReady) {
    adapterReady = (async () => {
      const connection = await connectDB();
      const db = connection?.connection.db;
      if (!db) throw new Error('MongoDB is unavailable for realtime coordination.');

      try {
        await db.createCollection(ADAPTER_COLLECTION, { capped: true, size: 10 * 1024 * 1024 });
      } catch (error) {
        const mongoError = error as { code?: number };
        if (mongoError.code !== 48) throw error;
      }

      const metadata = await db.listCollections({ name: ADAPTER_COLLECTION }, { nameOnly: false }).next();
      if (!metadata?.options?.capped) {
        throw new Error('The Socket.IO adapter collection must be capped.');
      }
      io!.adapter(createAdapter(db.collection(ADAPTER_COLLECTION), { addCreatedAtField: true }));
      console.info('[Socket] Shared MongoDB realtime adapter ready.');
    })().catch((error: unknown) => {
      adapterReady = null;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
      console.error('[Socket] Shared realtime adapter initialization failed.', { errorName, errorCode });
      throw error;
    });
  }
  return adapterReady;
}

export async function terminateGlobalCall(
  sessionId: string,
  status: GlobalCallTerminalStatus,
): Promise<boolean> {
  const session = await CallSession.findOne({ sessionId, status: { $in: ['ringing', 'accepted'] } })
    .select('callerId calleeId acceptedAt answeredAt status');
  if (!session) return false;

  const endedAt = new Date();
  const answeredAt = session.answeredAt || session.acceptedAt;
  const ended = await CallSession.findOneAndUpdate(
    { _id: session._id, status: session.status },
    {
      $set: {
        status,
        endedAt,
        durationSeconds: answeredAt ? Math.max(0, Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000)) : 0,
      },
    },
    { new: true },
  ).select('callerId calleeId sessionId status');
  if (!ended) return false;

  const event = { sessionId: ended.sessionId, status: ended.status };
  emitToUser(ended.callerId.toString(), 'call:ended', event);
  emitToUser(ended.calleeId.toString(), 'call:ended', event);
  await Promise.all([
    publishUserPresence(ended.callerId.toString()),
    publishUserPresence(ended.calleeId.toString()),
  ]);
  return true;
}

function toCallingAvailability(status: PresenceStatus): 'offline' | 'busy' | 'away' | 'available' {
  if (status === 'offline') return 'offline';
  if (status === 'busy') return 'busy';
  if (status === 'away') return 'away';
  return 'available';
}

async function sendPendingIncomingCalls(socket: Socket, userId: string): Promise<void> {
  try {
    const pendingCalls = await CallSession.find({
      calleeId: userId,
      status: 'ringing',
      expiresAt: { $gt: new Date() },
    }).select('sessionId callerId expiresAt').lean();

    for (const call of pendingCalls) {
      const caller = await User.findOne({
        _id: call.callerId,
        isActive: true,
        isDeleted: { $ne: true },
      }).select('callingId fullName avatar avatarStorageKey').lean();
      if (!caller) continue;
      const avatar = isR2Configured() && caller.avatarStorageKey
        ? await generateSignedAvatarUrl(caller.avatarStorageKey)
        : caller.avatar;
      socket.emit('call:incoming', {
        sessionId: call.sessionId,
        caller: {
          callingId: caller.callingId,
          displayName: caller.fullName,
          avatar: avatar || null,
        },
        expiresAt: call.expiresAt,
      });
    }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('[Socket] Pending incoming call recovery failed.', { userId, errorName });
  }
}

async function isInActiveMeeting(userId: string): Promise<boolean> {
  return Boolean(await Meeting.exists({
    status: 'active',
    $or: [
      { hostId: userId },
      { participants: { $elemMatch: { userId, status: 'joined' } } },
    ],
  }));
}

export async function getUserPresence(userId: string): Promise<{
  userId: string;
  status: PresenceStatus;
  availability: 'offline' | 'busy' | 'away' | 'available';
  inCall: boolean;
  inMeeting: boolean;
} | null> {
  const user = await User.findOne({ _id: userId, isActive: true, isDeleted: { $ne: true } })
    .select('status')
    .lean();
  if (!user) return null;

  const connected = Boolean(await RealtimePresence.exists({
    userId,
    expiresAt: { $gt: new Date() },
  }));
  const inMeeting = connected && await isInActiveMeeting(userId);
  const inCall = connected && Boolean(await CallSession.exists({
    status: { $in: ['ringing', 'accepted'] },
    $or: [{ callerId: userId }, { calleeId: userId }],
  }));
  const status: PresenceStatus = !connected
    ? 'offline'
    : inCall || inMeeting || user.status === 'busy'
      ? 'busy'
      : user.status === 'away'
        ? 'away'
        : 'online';

  return {
    userId,
    status,
    availability: toCallingAvailability(status),
    inCall,
    inMeeting,
  };
}

export async function publishUserPresence(userId: string): Promise<void> {
  try {
    const [user, presence] = await Promise.all([
      User.findOne({ _id: userId, isActive: true, isDeleted: { $ne: true } })
        .select('companyId callingId blockedUsers')
        .lean(),
      getUserPresence(userId),
    ]);
    if (!user || !presence) return;

    if (user.companyId) {
      io?.to(`company:${user.companyId.toString()}`).emit('user:presence', presence);
      io?.to(`company:${user.companyId.toString()}`).emit('user:status-changed', {
        userId,
        status: presence.status,
      });
    }
    const dmConversations = await Conversation.find({ isGroup: false, participants: userId })
      .select('participants')
      .lean();
    const dmPeerIds = new Set(
      dmConversations.flatMap((conversation) =>
        conversation.participants
          .map((participantId) => participantId.toString())
          .filter((participantId) => participantId !== userId),
      ),
    );
    const peers = await User.find({
      _id: { $in: Array.from(dmPeerIds) },
      isActive: true,
      isDeleted: { $ne: true },
    }).select('_id blockedUsers').lean();
    for (const peer of peers) {
      const blockedByUser = user.blockedUsers?.some((blockedId) => blockedId.equals(peer._id));
      const blockedByPeer = (peer.blockedUsers || []).some((blockedId) => blockedId.equals(user._id));
      if (!blockedByUser && !blockedByPeer) {
        emitToUser(peer._id.toString(), 'user:presence', presence);
      }
    }
    if (user.callingId) {
      io?.emit('calling:availability', {
        callingId: user.callingId,
        availability: presence.availability,
      });
    }
  } catch (error) {
    console.error('[Socket] Failed to publish user presence:', error);
  }
}

async function sendPresenceSnapshot(socket: Socket, userId: string, companyId: string): Promise<void> {
  try {
    const [workspaceUsers, dmConversations, requester] = await Promise.all([
      User.find({ companyId, isActive: true, isDeleted: { $ne: true } }).select('_id').lean(),
      Conversation.find({ isGroup: false, participants: userId }).select('participants').lean(),
      User.findById(userId).select('blockedUsers').lean(),
    ]);
    const dmPeerIds = new Set(
      dmConversations.flatMap((conversation) =>
        conversation.participants
          .map((participantId) => participantId.toString())
          .filter((participantId) => participantId !== userId),
      ),
    );
    const peerUsers = await User.find({ _id: { $in: Array.from(dmPeerIds) }, isActive: true, isDeleted: { $ne: true } })
      .select('_id status blockedUsers')
      .lean();
    const blockedByRequester = new Set((requester?.blockedUsers || []).map((blockedId) => blockedId.toString()));
    const visiblePeers = peerUsers.filter((peer) =>
      !blockedByRequester.has(peer._id.toString()) &&
      !(peer.blockedUsers || []).some((blockedId) => blockedId.toString() === userId),
    );
    const relevantUsers = new Map([
      ...workspaceUsers.map((user) => [user._id.toString(), user] as const),
      ...visiblePeers.map((user) => [user._id.toString(), user] as const),
    ]);
    const users = (await Promise.all(Array.from(relevantUsers, async ([id, user]) => {
      return getUserPresence(id);
    })))
      .filter((presence): presence is NonNullable<typeof presence> => presence !== null);
    socket.emit('presence:snapshot', { users });
  } catch (error) {
    console.error('[Socket] Failed to create presence snapshot:', error);
  }
}

export async function broadcastCallingAvailability(userId: string): Promise<void> {
  await publishUserPresence(userId);
}

const authorizeMeetingSocket = async (socket: Pick<Socket, 'data'>, meetingLink: unknown) => {
  if (typeof meetingLink !== 'string' || meetingLink.length < 20 || meetingLink.length > 128) return null;
  const grants = socket.data.meetingGrants as Record<string, string> | undefined;
  const grant = grants?.[meetingLink];
  const userId = socket.data.userId as string;
  if (!grant) return null;
  try {
    const meeting = await Meeting.findOne({ meetingLink, status: 'active' }).select('_id companyId hostId startedAt scheduledAt');
    if (!meeting) return null;
    const expirationAnchor = meeting.startedAt || meeting.scheduledAt;
    if (expirationAnchor && Date.now() - new Date(expirationAnchor).getTime() > MEETING_LINK_TTL_MS) return null;
    const user = await User.findOne({
      _id: userId,
      isActive: true,
      isDeleted: { $ne: true },
    }).select('_id fullName avatar avatarStorageKey companyId').lean();
    if (!user) return null;
    if (isR2Configured() && user.avatarStorageKey) {
      user.avatar = await generateSignedAvatarUrl(user.avatarStorageKey);
    }
    const tokenHash = createHash('sha256').update(grant).digest('hex');
    const accessGrant = await MeetingAccessGrant.findOne({
      meetingId: meeting._id,
      userId,
      tokenHash,
      expiresAt: { $gt: new Date() },
    }).select('_id').lean();
    if (!accessGrant) return null;
    return { meeting, user, isHost: meeting.hostId.toString() === userId };
  } catch {
    return null;
  }
};

export const initSocket = (server: HTTPServer) => {
  if (io) return io;
  io = new SocketServer(server, {
    path: process.env.VERCEL === '1' ? '/socket.io' : '/api/socket-io/socket.io',
    cors: { origin: getAllowedClientOrigins(), credentials: true },
    transports: ['websocket'],
  });

  io.use(async (socket: Socket, next) => {
    let decoded: ReturnType<typeof verifyAccessToken>;
    try {
      const socketAuthToken = socket.handshake.auth?.token;
      const authorization = socket.handshake.headers.authorization ?? socket.request.headers.authorization;
      const rawAuth = typeof socketAuthToken === 'string' ? socketAuthToken : authorization;
      const token = typeof rawAuth === 'string' ? getBearerToken(rawAuth) : null;
      if (!token) {
        console.error(`[Socket] 401 No token provided for socket ${socket.id}`);
        return next(new Error('No token'));
      }
      decoded = verifyAccessToken(token);
      if (
        typeof decoded.userId !== 'string' || !decoded.userId ||
        typeof decoded.companyId !== 'string' ||
        typeof decoded.role !== 'string' || !decoded.role
      ) {
        return next(new Error('Invalid token'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Socket] 401 Invalid token for socket ${socket.id}: ${errorMessage}`);
      return next(new Error('Invalid token'));
    }

    try {
      await ensureSocketAdapterReady();
      const user = await User.findOne({
        _id: decoded.userId,
        companyId: decoded.companyId,
        isActive: true,
        isDeleted: { $ne: true },
      }).select('_id companyId role').lean();
      if (!user) return next(new Error('Invalid user session'));
      const subscription = await getEffectiveSubscription(decoded.userId);
      if (!subscription.hasActiveAccess) return next(new Error('subscription_required'));
      socket.data.subscriptionStatus = subscription.status;
      socket.data.subscriptionEndDate = subscription.status === 'trialing'
        ? subscription.trialEndDate
        : subscription.status === 'past_due' ? undefined : subscription.subscriptionEndDate;
      socket.data.userId = decoded.userId;
      socket.data.companyId = decoded.companyId;
      socket.data.userRole = user.role || decoded.role;
      socket.data.wasOnline = await RealtimePresence.exists({
        userId: decoded.userId,
        expiresAt: { $gt: new Date() },
      }).then(Boolean);
      await RealtimePresence.findOneAndUpdate(
        { socketId: socket.id },
        {
          userId: decoded.userId,
          companyId: decoded.companyId,
          socketId: socket.id,
          expiresAt: new Date(Date.now() + PRESENCE_LEASE_MS),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      next();
    } catch (err) {
      console.error(`[Socket] Subscription access check failed for socket ${socket.id}:`, err);
      next(new Error('subscription_check_unavailable'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    const companyId = socket.data.companyId as string;
    const userRole = socket.data.userRole as string;
    let callSignalQueue = Promise.resolve();
    let subscriptionExpiryTimer: NodeJS.Timeout | undefined;

    const disconnectForExpiredSubscription = async () => {
      try {
        const subscription = await getEffectiveSubscription(userId);
        if (!subscription.hasActiveAccess) {
          socket.emit('subscription:required', {
            code: 'SUBSCRIPTION_REQUIRED',
            subscriptionStatus: subscription.status,
            plan: subscription.plan,
          });
          socket.disconnect(true);
          return;
        }
        const endDate = subscription.status === 'trialing'
          ? subscription.trialEndDate
          : subscription.status === 'past_due' ? undefined : subscription.subscriptionEndDate;
        if (endDate) {
          const delay = Math.max(0, Math.min(endDate.getTime() - Date.now() + 25, 2_147_000_000));
          subscriptionExpiryTimer = setTimeout(() => {
            void disconnectForExpiredSubscription();
          }, delay);
        }
      } catch (error) {
        console.error(`[Socket] Subscription expiry check failed for user ${userId}:`, error);
        subscriptionExpiryTimer = setTimeout(() => {
          void disconnectForExpiredSubscription();
        }, 60_000);
      }
    };
    const initialEndDate = socket.data.subscriptionEndDate as Date | undefined;
    if (initialEndDate) {
      const delay = Math.max(0, Math.min(initialEndDate.getTime() - Date.now() + 25, 2_147_000_000));
      subscriptionExpiryTimer = setTimeout(() => {
        void disconnectForExpiredSubscription();
      }, delay);
    }

    socket.use((packet, next) => {
      void getEffectiveSubscription(userId).then((subscription) => {
        if (subscription.hasActiveAccess) {
          next();
          return;
        }
        socket.emit('subscription:required', {
          code: 'SUBSCRIPTION_REQUIRED',
          subscriptionStatus: subscription.status,
          plan: subscription.plan,
        });
        socket.disconnect(true);
        next(new Error('subscription_required'));
      }).catch((error) => {
        console.error(`[Socket] Subscription access check failed for user ${userId}:`, error);
        next(new Error('subscription_check_unavailable'));
      });
    });

    const wasOnline = Boolean(socket.data.wasOnline);
    if (!wasOnline) io.to(`company:${companyId}`).emit('user:online', { userId });
    socket.join(userRoom(userId));
    socket.join(`company:${companyId}`);
    void sendPresenceSnapshot(socket, userId, companyId);
    void publishUserPresence(userId);
    void sendPendingIncomingCalls(socket, userId);

    const presenceHeartbeat = setInterval(() => {
      void RealtimePresence.updateOne(
        { socketId: socket.id, userId },
        { $set: { expiresAt: new Date(Date.now() + PRESENCE_LEASE_MS) } },
      ).catch((error: unknown) => {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error('[Socket] Presence heartbeat failed.', { userId, errorName });
      });
    }, PRESENCE_HEARTBEAT_MS);
    presenceHeartbeat.unref();

    socket.on('board:join', async (boardId: unknown) => {
      if (typeof boardId !== 'string' || !/^[a-f\d]{24}$/i.test(boardId)) return;
      try {
        const { verifyBoardSocketAccess } = await import('../controllers/whiteboard.controller');
        if (!await verifyBoardSocketAccess(boardId, companyId, userId, userRole)) return;
        const { default: User } = await import('../models/User');
        const member = await User.findOne({ _id: userId, companyId, isActive: true }).select('fullName avatar').lean();
        if (!member) return;
        const room = `board:${boardId}`;
        socket.join(room);
        const participant = { userId, fullName: member.fullName, avatar: member.avatar };
        socket.to(room).emit('board:collaborator-joined', participant);
        const peers = await io.in(room).fetchSockets();
        const peerIds = Array.from(new Set(peers.map((peer) => peer.data.userId as string)));
        const peerUsers = await User.find({ _id: { $in: peerIds }, companyId, isActive: true }).select('fullName avatar').lean();
        socket.emit('board:presence', peerUsers.map((peer) => ({ userId: peer._id.toString(), fullName: peer.fullName, avatar: peer.avatar })));
      } catch {
        // Deny room access if authorization or membership lookup fails.
      }
    });

    socket.on('board:leave', (boardId: unknown) => {
      if (typeof boardId !== 'string' || !/^[a-f\d]{24}$/i.test(boardId)) return;
      const room = `board:${boardId}`;
      socket.leave(room);
      socket.to(room).emit('board:collaborator-left', { userId });
    });

    socket.on('board:cursor', (payload: any) => {
      const boardId = typeof payload?.boardId === 'string' ? payload.boardId : '';
      const room = `board:${boardId}`;
      if (!socket.rooms.has(room) || !/^[a-f\d]{24}$/i.test(boardId)) return;
      const now = Date.now();
      const lastAt = (socket.data.boardCursorAt as number | undefined) ?? 0;
      if (now - lastAt < 33) return;
      socket.data.boardCursorAt = now;
      const x = Number(payload.x);
      const y = Number(payload.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1_000_000 || Math.abs(y) > 1_000_000) return;
      socket.to(room).emit('board:cursor', { userId, x, y });
    });
    
    void (async () => {
      const onlineLeases = await RealtimePresence.find({
        companyId,
        expiresAt: { $gt: new Date() },
      }).distinct('userId');
      socket.emit('users:online-list', onlineLeases.map((id) => id.toString()));
    })().catch((error: unknown) => {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error('[Socket] Online-user snapshot failed.', { userId, errorName });
    });

    socket.on('channel:join', async (id: string) => {
      // SECURITY: Verify the socket's company owns this channel before joining.
      // Without this check, any authenticated user could join any channel room
      // by sending a channel:join event with an arbitrary channel ID.
      try {
        const { default: Channel } = await import('../models/Channel');
        const channel = await Channel.findOne({
          _id: id,
          companyId,
          isArchived: false,
          $or: [{ type: 'public' }, { members: userId }],
        }).select('_id').lean();
        if (channel) {
          socket.join(`channel:${id}`);
        }
        // Silently drop unauthorized join attempts — no error to avoid fingerprinting
      } catch {
        // Channel not found or DB error — deny silently
      }
    });
    socket.on('channel:leave', (id: string) => socket.leave(`channel:${id}`));

    socket.on('presence:sync', () => {
      void sendPresenceSnapshot(socket, userId, companyId);
    });

    socket.on('dm:join', async (id: string) => {
      // SECURITY: Verify the socket's user is a participant in this conversation.
      try {
        const { default: Conversation } = await import('../models/Conversation');
        const conv = await Conversation.findOne({
          _id: id,
          participants: userId,
          $or: [
            { isGroup: false },
            { isGroup: true, companyId },
          ],
        }).select('_id').lean();
        if (conv) {
          socket.join(`dm:${id}`);
        }
        // Deny silently
      } catch {
        // Conversation not found or DB error — deny silently
      }
    });
    socket.on('dm:leave', (id: unknown) => {
      if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) return;
      socket.leave(`dm:${id}`);
    });
    
    socket.on('typing:start', ({ channelId, dmId, userName }: any) => {
      if (channelId) socket.to(`channel:${channelId}`).emit('typing:start', { userId, userName, channelId });
      if (dmId) socket.to(`dm:${dmId}`).emit('typing:start', { userId, userName, dmId });
    });
    socket.on('typing:stop', ({ channelId, dmId }: any) => {
      if (channelId) socket.to(`channel:${channelId}`).emit('typing:stop', { userId, channelId });
      if (dmId) socket.to(`dm:${dmId}`).emit('typing:stop', { userId, dmId });
    });

    socket.on('user:status', async (payload: { status?: unknown }) => {
      const status = payload?.status;
      if (!['online', 'away', 'busy', 'offline'].includes(String(status))) return;
      try {
        await User.updateOne({ _id: userId, isActive: true, isDeleted: { $ne: true } }, { $set: { status } });
        await publishUserPresence(userId);
      } catch (error) {
        console.error('[Socket] Failed to update user status:', error);
      }
    });

    socket.on('message:read', ({ channelId, dmId, messageId }: any) => {
      if (channelId) socket.to(`channel:${channelId}`).emit('message:read', { userId, channelId, messageId });
      if (dmId) socket.to(`dm:${dmId}`).emit('dm:read', { userId, dmId, messageId });
    });

    // ── REAL-TIME WEBRTC MEETING MANAGEMENT & SIGNALING ──────────────────────

    socket.on('meeting:join', async (payload: { meetingId?: string; meetingGrant?: string }) => {
      const meetingId = payload?.meetingId;
      const grant = payload?.meetingGrant;
      if (typeof meetingId !== 'string' || typeof grant !== 'string' || grant.length > 256) return;
      const grantMap = (socket.data.meetingGrants ??= {}) as Record<string, string>;
      grantMap[meetingId] = grant;
      const access = await authorizeMeetingSocket(socket, meetingId);
      if (!access) {
        delete grantMap[meetingId];
        socket.leave(`meeting:${meetingId}`);
        delete (socket.data.meetingParticipants as Record<string, MeetingParticipant> | undefined)?.[meetingId];
        socket.emit('meeting:error', { message: 'This meeting link or access grant is no longer valid.' });
        return;
      }
      await socket.join(`meeting:${meetingId}`);
      const roomKey = `meeting:${meetingId}`;

      const participant: MeetingParticipant = {
        socketId: socket.id,
        userId,
        user: { _id: userId, fullName: access.user.fullName, avatar: access.user.avatar },
        isMicOn: true,
        isCamOn: true,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date(),
      };
      const meetingParticipants = (socket.data.meetingParticipants ??= {}) as Record<string, MeetingParticipant>;
      meetingParticipants[meetingId] = participant;
      const roomSockets = await io.in(roomKey).fetchSockets();
      const existingParticipants = roomSockets
        .filter((peer) => peer.id !== socket.id)
        .map((peer) => meetingParticipantFor(peer, meetingId))
        .filter((peer): peer is MeetingParticipant => Boolean(peer));
      socket.emit('meeting:room-users', { meetingId, participants: existingParticipants });
      socket.to(roomKey).emit('meeting:user-joined', participant);
      void publishUserPresence(userId);
    });

    // WebRTC signaling: relay offer, answer, and ICE candidates between peers
    socket.on('meeting:signal', async (payload: { meetingId?: string; targetSocketId?: string; signal?: any }) => {
      const { meetingId, targetSocketId, signal } = payload || {};
      if (typeof targetSocketId !== 'string' || !signal || typeof signal !== 'object' || JSON.stringify(signal).length > 250_000) return;
      const access = await authorizeMeetingSocket(socket, meetingId);
      const room = typeof meetingId === 'string' ? `meeting:${meetingId}` : '';
      const roomSockets = room ? await io.in(room).fetchSockets() : [];
      const target = roomSockets.find((peer) => peer.id === targetSocketId);
      if (!access || typeof meetingId !== 'string' || !socket.rooms.has(`meeting:${meetingId}`) ||
          !target || !await authorizeMeetingSocket(target, meetingId)) return;
      let safeSignal: any = null;
      if ((signal.type === 'offer' || signal.type === 'answer') && typeof signal.sdp === 'string' && signal.sdp.length <= 200_000) {
        safeSignal = { type: signal.type, sdp: signal.sdp };
      } else if (signal.type === 'candidate' && signal.candidate && typeof signal.candidate.candidate === 'string' && signal.candidate.candidate.length <= 4096) {
        safeSignal = {
          type: 'candidate',
          candidate: {
            candidate: signal.candidate.candidate,
            sdpMid: typeof signal.candidate.sdpMid === 'string' ? signal.candidate.sdpMid.slice(0, 100) : null,
            sdpMLineIndex: Number.isInteger(signal.candidate.sdpMLineIndex) ? signal.candidate.sdpMLineIndex : null,
            usernameFragment: typeof signal.candidate.usernameFragment === 'string' ? signal.candidate.usernameFragment.slice(0, 100) : null,
          },
        };
      }
      if (safeSignal) {
        socket.to(targetSocketId).emit('meeting:signal', { fromSocketId: socket.id, userId, signal: safeSignal });
      }
    });

    // Global voice calls use a dedicated, database-authorized room. They do
    // not join or expose workspace, meeting, CRM, or other business-data rooms.
    socket.on('call:join', async (payload: { sessionId?: string; sessionToken?: string }) => {
      const sessionId = payload?.sessionId;
      const sessionToken = payload?.sessionToken;
      if (typeof sessionId !== 'string' || sessionId.length > 64 || typeof sessionToken !== 'string' || sessionToken.length > 4096) return;
      try {
        const token = verifyCallSessionToken(sessionToken);
        if (token.sessionId !== sessionId || token.userId !== userId) return;
        const session = await CallSession.findOne({ sessionId }).select('callerId calleeId status expiresAt');
        if (!session) return;
        const isCaller = session.callerId.toString() === userId;
        const isCallee = session.calleeId.toString() === userId;
        if (!isCaller && !isCallee) return;
        if (session.status === 'ringing') {
          if (session.expiresAt <= new Date()) {
            await terminateGlobalCall(sessionId, 'missed');
            return;
          }
          if (!isCaller) return;
        } else if (session.status !== 'accepted') {
          socket.emit('call:ended', { sessionId, status: session.status });
          return;
        }
        if (!await User.exists({ _id: userId, isActive: true, isDeleted: { $ne: true } })) return;

        const room = `call:${sessionId}`;
        const existingSockets = await io.in(room).fetchSockets();
        const allowedPeerId = isCaller ? session.calleeId.toString() : session.callerId.toString();
        if (existingSockets.length > 1 || existingSockets.some((peer) => peer.data.userId !== allowedPeerId)) return;
        await socket.join(room);
        socket.data.callSessionIds ??= new Set<string>();
        (socket.data.callSessionIds as Set<string>).add(sessionId);
        const joinedSockets = await io.in(room).fetchSockets();
        socket.emit('call:joined', { sessionId, status: session.status, peerPresent: joinedSockets.length > 1 });
        socket.to(room).emit('call:peer-ready', { sessionId });
      } catch {
        socket.emit('call:error', { code: 'CALL_SESSION_UNAVAILABLE', message: 'This call session is unavailable.' });
      }
    });

    socket.on('call:signal', (payload: { sessionId?: string; signal?: any }) => {
      callSignalQueue = callSignalQueue.then(async () => {
        const sessionId = payload?.sessionId;
        const signal = payload?.signal;
        if (typeof sessionId !== 'string' || !socket.rooms.has(`call:${sessionId}`)) return;
        if (!(socket.data.callSessionIds instanceof Set) || !socket.data.callSessionIds.has(sessionId)) return;
        const now = Date.now();
        const recentSignals = ((socket.data.callSignalTimes as number[] | undefined) || []).filter((time) => now - time < 10_000);
        if (recentSignals.length >= 500) {
          socket.emit('call:error', { code: 'CALL_SIGNAL_RATE_LIMITED', message: 'Too many call signaling messages were sent.' });
          return;
        }
        recentSignals.push(now);
        socket.data.callSignalTimes = recentSignals;
        if (!await CallSession.exists({ sessionId, status: 'accepted', $or: [{ callerId: userId }, { calleeId: userId }] })) return;
        if (!signal || typeof signal !== 'object' || JSON.stringify(signal).length > 250_000) return;

        let safeSignal: Record<string, unknown> | null = null;
        if ((signal.type === 'offer' || signal.type === 'answer') && typeof signal.sdp === 'string' && signal.sdp.length <= 200_000) {
          safeSignal = { type: signal.type, sdp: signal.sdp };
        } else if (signal.type === 'media-state' && typeof signal.videoEnabled === 'boolean') {
          safeSignal = { type: 'media-state', videoEnabled: signal.videoEnabled };
        } else if (signal.type === 'candidate' && signal.candidate && typeof signal.candidate === 'object') {
          const candidate = signal.candidate;
          if (typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096) return;
          safeSignal = {
            type: 'candidate',
            candidate: {
              candidate: candidate.candidate,
              sdpMid: typeof candidate.sdpMid === 'string' ? candidate.sdpMid.slice(0, 100) : null,
              sdpMLineIndex: Number.isInteger(candidate.sdpMLineIndex) ? candidate.sdpMLineIndex : null,
              usernameFragment: typeof candidate.usernameFragment === 'string' ? candidate.usernameFragment.slice(0, 100) : null,
            },
          };
        }
        if (safeSignal) socket.to(`call:${sessionId}`).emit('call:signal', { sessionId, signal: safeSignal });
      }).catch((error: unknown) => {
        console.error('[Socket] Call signal relay failed:', error);
        socket.emit('call:error', { code: 'CALL_SIGNAL_FAILED', message: 'Call signaling could not be delivered.' });
      });
    });

    socket.on('call:leave', async (payload: { sessionId?: string }) => {
      const sessionId = payload?.sessionId;
      const room = typeof sessionId === 'string' ? `call:${sessionId}` : '';
      if (!room || !(socket.data.callSessionIds instanceof Set) || !socket.data.callSessionIds.has(sessionId!)) return;
      socket.data.callSessionIds.delete(sessionId!);
      socket.leave(room);
    });

    // Track & broadcast media state (mic, cam, screen share)
    socket.on('meeting:media-state', async (payload: any) => {
      const { meetingId, isMicOn, isCamOn, isScreenSharing } = payload || {};
      const access = await authorizeMeetingSocket(socket, meetingId);
      const p = typeof meetingId === 'string' ? meetingParticipantFor(socket, meetingId) : undefined;
      if (p && p.userId !== userId) return;
      if (!access || !p) return;
      if (typeof isMicOn === 'boolean') p.isMicOn = isMicOn;
      if (typeof isCamOn === 'boolean') p.isCamOn = isCamOn;
      if (typeof isScreenSharing === 'boolean') p.isScreenSharing = isScreenSharing;
      socket.to(`meeting:${meetingId}`).emit('meeting:media-state-changed', {
        socketId: socket.id, userId,
        isMicOn: p.isMicOn, isCamOn: p.isCamOn, isScreenSharing: p.isScreenSharing,
      });
    });

    // Hand raise toggle
    socket.on('meeting:hand-raise', async (payload: any) => {
      const { meetingId, isHandRaised } = payload || {};
      const access = await authorizeMeetingSocket(socket, meetingId);
      const p = typeof meetingId === 'string' ? meetingParticipantFor(socket, meetingId) : undefined;
      if (p && p.userId !== userId) return;
      if (!access || !p || typeof isHandRaised !== 'boolean') return;
      p.isHandRaised = isHandRaised;
      io.to(`meeting:${meetingId}`).emit('meeting:hand-raise-changed', {
        socketId: socket.id, userId, isHandRaised: p.isHandRaised,
      });
    });

    // Synchronized meeting chat
    socket.on('meeting:chat-message', async (payload: any) => {
      const { meetingId, text } = payload || {};
      const access = await authorizeMeetingSocket(socket, meetingId);
      const participant = typeof meetingId === 'string' ? meetingParticipantFor(socket, meetingId) : undefined;
      if (participant && participant.userId !== userId) return;
      if (!access || !participant || typeof text !== 'string' || !text.trim()) return;
      const safeText = text.trim().slice(0, 2000);
      io.to(`meeting:${meetingId}`).emit('meeting:chat-message', {
        socketId: socket.id,
        sender: participant.user.fullName,
        text: safeText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    // Participant voluntarily leaves room
    socket.on('meeting:leave', async (payload: { meetingId?: string } = {}) => {
      const meetingId = payload.meetingId;
      if (typeof meetingId !== 'string') return;
      const access = await authorizeMeetingSocket(socket, meetingId);
      socket.leave(`meeting:${meetingId}`);
      delete (socket.data.meetingGrants as Record<string, string> | undefined)?.[meetingId];
      delete (socket.data.meetingParticipants as Record<string, MeetingParticipant> | undefined)?.[meetingId];
      if (access) socket.to(`meeting:${meetingId}`).emit('meeting:user-left', { socketId: socket.id, userId });
      void publishUserPresence(userId);
    });

    // Host terminates meeting for all participants
    socket.on('meeting:end-session', async (payload: { meetingId?: string } = {}) => {
      const meetingId = payload.meetingId;
      if (typeof meetingId !== 'string') return;
      const access = await authorizeMeetingSocket(socket, meetingId);
      if (!access?.isHost) return;
      const endedAt = new Date();
      const meeting = await Meeting.findOneAndUpdate(
        { _id: access.meeting._id, status: 'active', hostId: userId },
        {
          status: 'ended',
          endedAt,
          duration: access.meeting.startedAt
            ? Math.round((endedAt.getTime() - new Date(access.meeting.startedAt).getTime()) / 60000)
            : 0,
        },
        { new: true },
      ).select('hostId participants.userId');
      if (!meeting) return;
      const roomSockets = await io.in(`meeting:${meetingId}`).fetchSockets();
      const participantUserIds = new Set(
        [
          meeting.hostId.toString(),
          ...meeting.participants.map((participant) => participant.userId.toString()),
          ...roomSockets.map((participant) => participant.data.userId as string),
        ],
      );
      io.to(`meeting:${meetingId}`).emit('meeting:ended', { meetingId, meetingLink: meetingId });
      for (const participantUserId of participantUserIds) {
        emitToUser(participantUserId, 'meeting:ended', { meetingId, meetingLink: meetingId });
      }
      void Promise.all(Array.from(participantUserIds, (participantUserId) => publishUserPresence(participantUserId)));
    });

    // Disconnect cleanup
    socket.on('disconnect', async () => {
      if (subscriptionExpiryTimer) clearTimeout(subscriptionExpiryTimer);
      if (presenceHeartbeat) clearInterval(presenceHeartbeat);
      for (const room of socket.rooms) {
        if (!room.startsWith('meeting:')) continue;
        const meetingId = room.slice('meeting:'.length);
        if (meetingParticipantFor(socket, meetingId)) {
          socket.to(room).emit('meeting:user-left', { socketId: socket.id, userId });
        }
      }
      await RealtimePresence.deleteOne({ socketId: socket.id, userId });
      const stillOnline = await RealtimePresence.exists({ userId, expiresAt: { $gt: new Date() } });
      if (!stillOnline) io.to(`company:${companyId}`).emit('user:offline', { userId });

      const callSessionIds = socket.data.callSessionIds instanceof Set
        ? Array.from(socket.data.callSessionIds as Set<string>)
        : [];
      for (const sessionId of callSessionIds) {
        try {
          const room = `call:${sessionId}`;
          const peers = await io.in(room).fetchSockets();
          if (peers.some((peer) => peer.data.userId === userId)) continue;
          const session = await CallSession.findOne({
            sessionId,
            status: { $in: ['ringing', 'accepted'] },
          }).select('callerId calleeId status');
          if (!session) continue;
          const status: GlobalCallTerminalStatus = session.status === 'accepted'
            ? 'completed'
            : session.callerId.toString() === userId ? 'cancelled' : 'missed';
          await terminateGlobalCall(sessionId, status);
        } catch (error) {
          console.error('[Socket] Failed to finalize disconnected call:', error);
        }
      }
      void publishUserPresence(userId);
    });
  });
  return io;
};

export const getIO = () => io;

export async function isUserOnline(userId: string): Promise<boolean> {
  return Boolean(await RealtimePresence.exists({ userId, expiresAt: { $gt: new Date() } }));
}

export function disconnectCompanySockets(companyId: string): void {
  if (!io) return;
  io.to(`company:${companyId}`).emit('subscription:required', {
    code: 'SUBSCRIPTION_REQUIRED',
    billingPath: '/billing',
  });
  io.in(`company:${companyId}`).disconnectSockets(true);
}
export async function hasCallSessionSockets(sessionId: string): Promise<boolean> {
  if (!io) throw new Error('Socket.IO has not been initialized.');
  const sockets = await io.in(`call:${sessionId}`).fetchSockets();
  return sockets.length > 0;
}
export async function getMeetingParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  if (!io) return [];
  const sockets = await io.in(`meeting:${meetingId}`).fetchSockets();
  return sockets
    .map((socket) => meetingParticipantFor(socket, meetingId))
    .filter((participant): participant is MeetingParticipant => Boolean(participant));
}
export const emitToCompany = (cid: string, ev: string, data: any) => io?.to(`company:${cid}`).emit(ev, data);
export const emitToChannel = (cid: string, ev: string, data: any) => io?.to(`channel:${cid}`).emit(ev, data);
export const emitToDM = (cid: string, ev: string, data: any) => io?.to(`dm:${cid}`).emit(ev, data);
export const emitToUser = (uid: string, ev: string, data: any) => io?.to(userRoom(uid)).emit(ev, data);
