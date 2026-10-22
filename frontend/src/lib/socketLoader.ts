/**
 * Lazy entry point to the Socket.IO client for code that is loaded on every
 * route (the auth store and the API client). Importing `./socket` statically
 * put socket.io-client into the root bundle of public pages that never open a
 * socket.
 *
 * Calls are chained on the same module promise, so connect/disconnect run in
 * the order they were requested even while the chunk is still loading.
 */

type SocketModule = typeof import('./socket');

let socketModule: Promise<SocketModule> | null = null;

const loadSocketModule = (): Promise<SocketModule> => (socketModule ??= import('./socket'));

/**
 * Shell components import ./socket directly and may have opened the socket
 * without going through this loader; lib/socket keeps its singleton on
 * globalThis, so check there too before deciding there is nothing to do.
 */
const socketMayExist = (): boolean =>
  socketModule !== null ||
  Boolean((globalThis as { __workgrind_socket_state__?: { socket: unknown } }).__workgrind_socket_state__?.socket);

export function connectSocketLazily(): void {
  void loadSocketModule()
    .then((mod) => { mod.getSocket(); })
    .catch(() => { socketModule = null; });
}

export function disconnectSocketLazily(): void {
  if (!socketMayExist()) return;
  void loadSocketModule().then((mod) => mod.disconnectSocket()).catch(() => undefined);
}

export function refreshSocketAuthLazily(token: string): void {
  if (!socketMayExist()) return;
  void loadSocketModule().then((mod) => mod.refreshSocketAuth(token)).catch(() => undefined);
}
