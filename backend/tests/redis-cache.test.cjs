const assert = require('node:assert/strict');
const test = require('node:test');
const {
  checkRedisHealth,
  withRedisTimeout,
} = require('../dist/config/redis');
const {
  deleteCacheKey,
  getOrSetJsonCache,
  namespacedCacheKey,
} = require('../dist/utils/cache');

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

  async ping() {
    this.calls.ping += 1;
    if (this.fail.has('ping')) throw Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
    return this.pingResult;
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
  const previousUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = 'rediss://user:secret@example.invalid:6379';
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
    if (previousUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousUrl;
  }
});

test('Redis health and command timeouts do not hang on an unavailable provider', async () => {
  const previousUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = 'rediss://user:secret@example.invalid:6379';
  try {
    const hangingClient = { ping: () => new Promise(() => {}) };
    const health = await checkRedisHealth(hangingClient);
    assert.equal(health.status, 'disconnected');
    await assert.rejects(withRedisTimeout(new Promise(() => {}), 10), /timed out/i);
  } finally {
    if (previousUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousUrl;
  }
});
