const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const {
  checkRedisHealth,
  closeRedisClient,
  getRedisClient,
  getRedisConfigurationIssue,
  isRedisConfigured,
  UpstashRedisCommands,
  withRedisTimeout,
} = require('../dist/config/redis');
const {
  deleteCacheKey,
  getOrSetJsonCache,
  namespacedCacheKey,
} = require('../dist/utils/cache');
const { RedisRateLimitStore, rateLimiter } = require('../dist/middleware/rateLimiter');
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const { startOAuth } = require('../dist/controllers/oauth.controller');

class MemoryRedis {
  values = new Map();
  calls = { get: 0, set: 0, del: 0, ping: 0 };
  fail = new Set();
  pingResult = 'PONG';

  async get(key) {
    this.calls.get += 1;
    if (this.fail.has('get')) throw Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
    return this.values.get(key) ?? null;
  }

  async set(key, value) {
    this.calls.set += 1;
    if (this.fail.has('set')) throw Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
    this.values.set(key, value);
    return 'OK';
  }

  async del(key) {
    this.calls.del += 1;
    if (this.fail.has('del')) throw Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
    return this.values.delete(key) ? 1 : 0;
  }

  async decr() {
    return 0;
  }

  async ping() {
    this.calls.ping += 1;
    if (this.fail.has('ping')) throw Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
    return this.pingResult;
  }

  async eval() {
    return [1, 60_000];
  }
}

test('cache miss loads MongoDB data and subsequent request reads JSON cache', async () => {
  const redis = new MemoryRedis();
  let loads = 0;
  const key = namespacedCacheKey('analytics:overview', 'tenant-a');
  const load = async () => ({ total: ++loads });

  assert.deepEqual(await getOrSetJsonCache(key, 20, load, redis), { total: 1 });
  assert.deepEqual(await getOrSetJsonCache(key, 20, load, redis), { total: 1 });
  assert.equal(loads, 1);
  assert.equal(redis.calls.get, 2);
  assert.equal(redis.calls.set, 1);
});

test('tenant-aware cache keys do not share data across workspaces', async () => {
  const redis = new MemoryRedis();
  const keyA = namespacedCacheKey('analytics:overview', 'tenant-a');
  const keyB = namespacedCacheKey('analytics:overview', 'tenant-b');
  await getOrSetJsonCache(keyA, 20, async () => ({ tenant: 'a' }), redis);
  await getOrSetJsonCache(keyB, 20, async () => ({ tenant: 'b' }), redis);

  assert.notEqual(keyA, keyB);
  assert.deepEqual(await getOrSetJsonCache(keyA, 20, async () => assert.fail('unexpected tenant A cache miss'), redis), { tenant: 'a' });
  assert.deepEqual(await getOrSetJsonCache(keyB, 20, async () => assert.fail('unexpected tenant B cache miss'), redis), { tenant: 'b' });
});

test('Redis read failures fall through to the source and write failures do not fail requests', async () => {
  const redis = new MemoryRedis();
  redis.fail.add('get');
  redis.fail.add('set');
  let loads = 0;
  const result = await getOrSetJsonCache('cache-key', 20, async () => ({ value: ++loads }), redis);
  assert.deepEqual(result, { value: 1 });
  assert.equal(loads, 1);
});

test('cache invalidation deletes the exact tenant key and forces a subsequent reload', async () => {
  const redis = new MemoryRedis();
  const keyA = namespacedCacheKey('analytics:overview', 'tenant-a');
  const keyB = namespacedCacheKey('analytics:overview', 'tenant-b');
  await getOrSetJsonCache(keyA, 20, async () => ({ value: 1 }), redis);
  await getOrSetJsonCache(keyB, 20, async () => ({ value: 2 }), redis);
  await deleteCacheKey(keyA, redis);
  let reloaded = 0;

  assert.deepEqual(await getOrSetJsonCache(keyA, 20, async () => ({ value: ++reloaded + 2 }), redis), { value: 3 });
  assert.deepEqual(await getOrSetJsonCache(keyB, 20, async () => assert.fail('other tenant cache should remain'), redis), { value: 2 });
  assert.equal(redis.calls.del, 1);
});

test('no configured Redis client falls back to the source loader', async () => {
  let loads = 0;
  const result = await getOrSetJsonCache('cache-key', 20, async () => ({ value: ++loads }), null);
  assert.deepEqual(result, { value: 1 });
  assert.equal(loads, 1);
});

test('Redis is reported connected only after PING returns PONG', async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  try {
    const connected = await checkRedisHealth(new MemoryRedis());
    assert.equal(connected.status, 'connected');
    assert.equal(connected.ping, 'PONG');

    const badPing = new MemoryRedis();
    badPing.pingResult = 'NOT_PONG';
    const disconnected = await checkRedisHealth(badPing);
    assert.equal(disconnected.status, 'disconnected');
    assert.equal(disconnected.ping, 'failed');

    const failedPing = new MemoryRedis();
    failedPing.fail.add('ping');
    assert.equal((await checkRedisHealth(failedPing)).status, 'disconnected');
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test('Redis health and command timeouts do not hang on an unavailable provider', async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  try {
    const hangingClient = { ping: () => new Promise(() => {}) };
    const health = await checkRedisHealth(hangingClient);
    assert.equal(health.status, 'disconnected');
    await assert.rejects(withRedisTimeout(new Promise(() => {}), 10), /timed out/i);
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test('Upstash configuration requires both credentials and an HTTPS REST URL', () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const previousLegacyUrl = process.env.REDIS_URL;
  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.REDIS_URL = 'redis://legacy.example.test:6379';
    assert.equal(isRedisConfigured(), false);

    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    assert.equal(isRedisConfigured(), false);
    assert.match(getRedisConfigurationIssue(), /must both be configured/);
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    assert.equal(isRedisConfigured(), true);
    assert.equal(getRedisConfigurationIssue(), null);

    process.env.UPSTASH_REDIS_REST_URL = 'redis://example.upstash.io:6379';
    assert.equal(isRedisConfigured(), false);
    assert.match(getRedisConfigurationIssue(), /absolute HTTPS URL/);
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    if (previousLegacyUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousLegacyUrl;
  }
});

test('valid Upstash REST settings initialize the HTTP client without Redis TCP configuration', async (context) => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  context.after(async () => {
    await closeRedisClient();
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  });

  assert.ok(getRedisClient() instanceof UpstashRedisCommands);
});

test('Upstash adapter maps cache, expiry, and rate-limit operations', async () => {
  const calls = [];
  const upstash = {
    get: async (key) => { calls.push(['get', key]); return 'cached'; },
    set: async (...args) => { calls.push(['set', ...args]); return 'OK'; },
    del: async (key) => { calls.push(['del', key]); return 1; },
    decr: async (key) => { calls.push(['decr', key]); return 0; },
    ping: async () => 'PONG',
    eval: async (...args) => { calls.push(['eval', ...args]); return [1, 60_000]; },
  };
  const redis = new UpstashRedisCommands(upstash);

  assert.equal(await redis.get('cache-key'), 'cached');
  await redis.set('cache-key', 'value', 'EX', 30);
  assert.equal(await redis.del('cache-key'), 1);
  assert.equal(await redis.decr('rate-key'), 0);
  assert.equal(await redis.ping(), 'PONG');
  assert.deepEqual(await redis.eval('return 1', ['rate-key'], ['60000']), [1, 60_000]);
  assert.deepEqual(calls[1], ['set', 'cache-key', 'value', { ex: 30 }]);
  assert.deepEqual(calls[4], ['eval', 'return 1', ['rate-key'], ['60000']]);
});

test('rate limiting atomically counts requests and enforces the configured maximum', async (context) => {
  const counts = new Map();
  const redis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    decr: async () => 0,
    ping: async () => 'PONG',
    eval: async (_script, [key], [windowMs]) => {
      const hits = (counts.get(key) || 0) + 1;
      counts.set(key, hits);
      return [hits, Number(windowMs)];
    },
  };
  const app = express();
  app.get('/oauth/start', rateLimiter(1, 1, {}, redis), (_req, res) => res.status(302).set('Location', 'https://provider.example.test').end());
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/oauth/start`;

  const allowed = await fetch(url, { redirect: 'manual' });
  const limited = await fetch(url);
  assert.equal(allowed.status, 302);
  assert.equal(limited.status, 429);
});

test('Redis rate-limit failures stop protected handlers instead of failing open', async (context) => {
  const redis = {
    eval: async () => { throw new Error('Upstash unavailable'); },
    decr: async () => 0,
    del: async () => 0,
  };
  let protectedHandlerCalls = 0;
  const app = express();
  app.get('/protected', rateLimiter(1, 1, {}, redis), (_req, res) => {
    protectedHandlerCalls += 1;
    res.sendStatus(200);
  });
  app.use((error, _req, res, _next) => res.status(503).json({ code: 'RATE_LIMIT_UNAVAILABLE' }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/protected`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'RATE_LIMIT_UNAVAILABLE');
  assert.equal(protectedHandlerCalls, 0);
});

test('OAuth start succeeds behind a healthy Upstash-backed rate limiter', async (context) => {
  const previous = {
    VERCEL: process.env.VERCEL,
    BACKEND_URL: process.env.BACKEND_URL,
    CLIENT_URL: process.env.CLIENT_URL,
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
    LINKEDIN_CALLBACK_URL: process.env.LINKEDIN_CALLBACK_URL,
  };
  const originalCreate = OAuthTransaction.create;
  process.env.VERCEL = '1';
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.CLIENT_URL = 'https://workgrind.example.test';
  process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
  process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/oauth/linkedin/callback';
  OAuthTransaction.create = async () => ({});
  context.after(() => {
    OAuthTransaction.create = originalCreate;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const app = express();
  const redis = new MemoryRedis();
  app.get('/api/auth/oauth/:provider/start', rateLimiter(15, 10, {}, redis), (req, res, next) => {
    startOAuth(req, res).catch(next);
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/auth/oauth/linkedin/start?intent=signup&accountType=company&organizationType=business`,
    { headers: { accept: 'application/json' }, redirect: 'manual' },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.authUrl, /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization/);
});

test('Vercel rate-limited requests fail closed without Upstash credentials', async (context) => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  context.after(() => {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  });
  const app = express();
  app.get('/protected', rateLimiter(1, 1, {}, null), (_req, res) => res.sendStatus(200));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/protected`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'RATE_LIMIT_UNAVAILABLE');
});
