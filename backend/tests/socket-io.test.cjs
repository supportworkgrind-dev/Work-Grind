const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('node:http');
const WebSocket = require('ws');
const { initSocket, isUserOnline, SOCKET_IO_PATH } = require('../dist/utils/socket');
const RealtimePresence = require('../dist/models/RealtimePresence').default;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

async function expectUnauthenticatedWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Socket.IO authentication response timed out.'));
    }, 5_000);

    socket.once('open', () => socket.send('40'));
    socket.on('message', (data) => {
      const packet = data.toString();
      if (!packet.startsWith('44')) return;
      clearTimeout(timeout);
      socket.close();
      resolve(packet);
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

test('Socket.IO serves the configured path, verifies auth on both transports, and supports local polling', async (t) => {
  const server = createServer();
  const io = initSocket(server);
  const port = await listen(server);
  const endpoint = `http://127.0.0.1:${port}${SOCKET_IO_PATH}/`;

  t.after(() => new Promise((resolve) => io.close(resolve)));

  assert.equal(io.engine.opts.path, SOCKET_IO_PATH);
  assert.deepEqual(io.engine.opts.transports, ['polling', 'websocket']);

  const pollingHandshake = await fetch(`${endpoint}?EIO=4&transport=polling&t=auth-check`);
  assert.equal(pollingHandshake.status, 200);
  const handshakePacket = await pollingHandshake.text();
  assert.equal(handshakePacket[0], '0');
  const { sid } = JSON.parse(handshakePacket.slice(1));

  const namespaceConnect = await fetch(`${endpoint}?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: '40',
  });

  test('presence remains online while any authenticated device lease is active', async (t) => {
    const originalExists = RealtimePresence.exists;
    const activeSocketIds = new Set(['tab-one', 'tab-two']);
    let receivedFilter;
    RealtimePresence.exists = async (filter) => {
      receivedFilter = filter;
      return activeSocketIds.size > 0;
    };
    t.after(() => { RealtimePresence.exists = originalExists; });

    assert.equal(await isUserOnline('user-id'), true);
    assert.equal(receivedFilter.userId, 'user-id');
    assert.ok(receivedFilter.expiresAt.$gt instanceof Date);

    activeSocketIds.delete('tab-one');
    assert.equal(await isUserOnline('user-id'), true);
    activeSocketIds.delete('tab-two');
    assert.equal(await isUserOnline('user-id'), false);
  });
  assert.equal(namespaceConnect.status, 200);

  const pollingAuthFailure = await fetch(
    `${endpoint}?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}`,
  );
  assert.equal(pollingAuthFailure.status, 200);
  assert.match(await pollingAuthFailure.text(), /No token/);

  const websocketAuthFailure = await expectUnauthenticatedWebSocket(
    `${endpoint.replace(/^http/, 'ws')}?EIO=4&transport=websocket`,
  );
  assert.match(websocketAuthFailure, /No token/);
});
