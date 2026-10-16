const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { rateLimiter } = require('../dist/middleware/rateLimiter');

test('login remains rate-limited without an external store', async (context) => {
  let loginCalls = 0;
  const app = express();
  app.use(express.json());
  app.post('/api/auth/login', rateLimiter(15, 1), (_req, res) => {
    loginCalls += 1;
    res.json({ success: true });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
  const request = () => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.test', password: 'test-only' }),
  });

  const allowed = await request();
  const limited = await request();
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { success: true });
  assert.equal(limited.status, 429);
  assert.equal(loginCalls, 1);
});

test('route-specific rate limit options remain supported by the local store', async (context) => {
  const app = express();
  app.get('/oauth/:provider/start', rateLimiter(15, 1, {
    message: { success: false, code: 'RATE_LIMITED' },
    skip: (req) => req.params.provider === 'test-skip',
  }), (_req, res) => res.sendStatus(204));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}/oauth`;

  assert.equal((await fetch(`${baseUrl}/google/start`)).status, 204);
  const limited = await fetch(`${baseUrl}/google/start`);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { success: false, code: 'RATE_LIMITED' });
  assert.equal((await fetch(`${baseUrl}/test-skip/start`)).status, 204);
  assert.equal((await fetch(`${baseUrl}/test-skip/start`)).status, 204);
});
