/**
 * WorkGrind Socket.IO client — singleton with deferred room-join pattern.
 *
 * Keeps the existing Chat/DM/channel socket behavior intact while guarding
 * against duplicate sockets during Strict Mode, HMR, login/logout, and token
 * switching. Calling events are reserved separately and do not enter the chat
 * room replay system.
 */

import { io, Socket } from 'socket.io-client';
import { clearAuthValues, getAuthValue } from './authSession';
import { refreshAuthTokens } from './tokenRefresh';

type RoomEvent = 'channel:join' | 'dm:join' | 'channel:leave' | 'dm:leave';
type SocketGlobalState = {
  socket: Socket | null;
  token: string | null;
  pendingRooms: Set<string>;
};

type SocketWithGlobal = typeof globalThis & {
  __workgrind_socket_state__?: SocketGlobalState;
};

const globalState = globalThis as SocketWithGlobal;
if (!globalState.__workgrind_socket_state__) {
  globalState.__workgrind_socket_state__ = {
    socket: null,
    token: null,
    pendingRooms: new Set<string>(),
  };
}

const state: SocketGlobalState = globalState.__workgrind_socket_state__!;

let socket = state.socket ?? null;
let currentSocketToken = state.token ?? null;
let authRecoveryAttempted = false;
const pendingRooms = state.pendingRooms;

const getSocketUrl = (): string => {
  const configuredSocket = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, '');
  const configuredApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '');
  const isLocalServiceUrl = (url: string | undefined): boolean =>
    Boolean(url && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url));
  const isDevTunnel = window.location.hostname.endsWith('.devtunnels.ms');

  if (isDevTunnel) {
    if (configuredSocket && !isLocalServiceUrl(configuredSocket)) return configuredSocket;
    if (configuredApi && !isLocalServiceUrl(configuredApi)) return configuredApi;
    return window.location.origin;
  }

  return configuredSocket || configuredApi || window.location.origin;
};

const makeRoomKey = (event: RoomEvent, id: string): string => `${event}::${id}`;

const isAuthFailureMessage = (message: string): boolean =>
  /invalid token|no token|unauthorized|jwt|expired|authentication/i.test(message);

const destroySocket = (target?: Socket | null) => {
  const socketToDestroy = target ?? socket;
  if (socketToDestroy) {
    socketToDestroy.removeAllListeners();
    socketToDestroy.disconnect();
  }

  if (socket === socketToDestroy) {
    socket = null;
    state.socket = null;
    currentSocketToken = null;
    state.token = null;
    authRecoveryAttempted = false;
  }
};

const invalidateSocketSession = (target: Socket, failedToken: string) => {
  if (socket !== target || getAuthValue('workgrind_access_token') !== failedToken) return;
  clearAuthValues();
  destroySocket(target);
  if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
    window.location.assign('/login');
  }
};

function flushPendingRooms(s: Socket) {
  Array.from(pendingRooms).forEach((key) => {
    const separatorIndex = key.indexOf('::');
    if (separatorIndex === -1) return;
    const event = key.slice(0, separatorIndex) as RoomEvent;
    const id = key.slice(separatorIndex + 2);
    if (event && id) {
      s.emit(event, id);
    }
  });
}

export const CALLING_SOCKET_EVENTS = [
  'call:invite',
  'call:accept',
  'call:reject',
  'call:end',
  'call:cancel',
  'call:busy',
  'call:ice-candidate',
  'call:offer',
  'call:answer',
] as const;

export function emitCallingEvent(event: (typeof CALLING_SOCKET_EVENTS)[number], payload: Record<string, unknown> = {}) {
  const s = getSocket();
  if (!s?.connected) return;
  s.emit(event, payload);
}

export const getSocket = (): Socket | null => {
  if (typeof window === 'undefined') return null;

  const token = getAuthValue('workgrind_access_token');
  if (!token) {
    if (socket) {
      destroySocket();
    }
    return null;
  }

  if (socket && currentSocketToken === token && !socket.disconnected) {
    return socket;
  }

  if (socket && currentSocketToken !== token) {
    destroySocket();
  }

  if (!socket) {
    const SOCKET_URL = getSocketUrl();
    const isProxiedDevTunnel = typeof window !== 'undefined'
      && window.location.hostname.endsWith('.devtunnels.ms')
      && SOCKET_URL === window.location.origin;

    socket = io(SOCKET_URL, {
      path: '/socket.io',
      addTrailingSlash: !isProxiedDevTunnel,
      // Socket.IO receives the raw access JWT; the backend validates it with
      // the same verifier used for Bearer tokens on authenticated API routes.
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    state.socket = socket;
    currentSocketToken = token;
    state.token = token;

    socket.on('connect', () => {
      authRecoveryAttempted = false;
      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket] Connected:', socket?.id);
      }
      flushPendingRooms(socket!);
    });

    socket.on('reconnect', (attempt: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket] Reconnected after', attempt, 'attempts');
      }
      flushPendingRooms(socket!);
    });

    socket.on('disconnect', (reason: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket] Disconnected:', reason);
      }
    });

    socket.on('subscription:required', () => {
      window.dispatchEvent(new CustomEvent('workgrind:subscription-required'));
      destroySocket(socket);
    });

    socket.on('connect_error', (err: Error) => {
      const message = err?.message || 'Unknown socket error';
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Socket] Connection error:', message);
      }

      if (message === 'subscription_required') {
        const blockedSocket = socket;
        window.dispatchEvent(new CustomEvent('workgrind:subscription-required'));
        destroySocket(blockedSocket);
        return;
      }

      if (isAuthFailureMessage(message)) {
        const failedSocket = socket;
        const failedToken = currentSocketToken;
        if (!failedSocket || !failedToken) return;

        const latestToken = getAuthValue('workgrind_access_token');
        if (latestToken && latestToken !== failedToken) {
          failedSocket.disconnect();
          failedSocket.auth = { token: latestToken };
          currentSocketToken = latestToken;
          state.token = latestToken;
          authRecoveryAttempted = false;
          failedSocket.connect();
          return;
        }

        failedSocket.disconnect();
        if (authRecoveryAttempted) {
          invalidateSocketSession(failedSocket, failedToken);
          return;
        }
        authRecoveryAttempted = true;
        void refreshAuthTokens(failedToken).then(({ accessToken }) => {
          if (socket !== failedSocket || getAuthValue('workgrind_access_token') !== accessToken) return;
          failedSocket.auth = { token: accessToken };
          currentSocketToken = accessToken;
          state.token = accessToken;
          failedSocket.connect();
        }).catch(() => {
          invalidateSocketSession(failedSocket, failedToken);
        });
      }
    });
  }

  return socket;
};

/**
 * Join a room (channel or DM).
 * Safe to call immediately — if the socket isn't connected yet the join will
 * be replayed automatically once the connection is established.
 */
export function joinRoom(event: 'channel:join' | 'dm:join', id: string): void {
  if (!id) return;

  const key = makeRoomKey(event, id);
  pendingRooms.add(key);

  const s = getSocket();
  if (s?.connected) {
    s.emit(event, id);
  }
}

/**
 * Leave a room and stop re-joining it after reconnects.
 */
export function leaveRoom(event: 'channel:leave' | 'dm:leave', id: string): void {
  if (!id) return;

  const joinEvent = event.replace('leave', 'join') as 'channel:join' | 'dm:join';
  pendingRooms.delete(makeRoomKey(joinEvent, id));

  const s = getSocket();
  if (s?.connected) {
    s.emit(event, id);
  }
}

export function refreshSocketAuth(token: string): void {
  if (!socket || !token || getAuthValue('workgrind_access_token') !== token || currentSocketToken === token) return;

  currentSocketToken = token;
  state.token = token;
  authRecoveryAttempted = false;
  socket.auth = { token };
  socket.disconnect().connect();
}

export const disconnectSocket = (): void => {
  pendingRooms.clear();
  destroySocket();
};
