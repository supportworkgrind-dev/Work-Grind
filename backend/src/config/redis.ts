import { Redis } from '@upstash/redis';

export interface RedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  incrementRateLimitCounter(key: string, windowMs: number): Promise<RateLimitCounterResult>;
  ping(): Promise<string>;
}

export interface RateLimitCounterResult {
  totalHits: number;
  ttlMs: number;
}

type RedisConfiguration = {
  url: string;
  token: string;
};

const operationTimeoutMs = 350;
let client: RedisCommands | null = null;
let initializationFailed = false;
let missingConfigurationLogged = false;

export function getRedisConfigurationIssue(): string | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url && !token) return null;
  if (!url || !token) {
    return 'Optional Upstash Redis settings are incomplete; configure both URL and token or remove both.';
  }

  try {
    if (new URL(url).protocol !== 'https:') {
      return 'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL.';
    }
  } catch {
    return 'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL.';
  }
  return null;
}

function getRedisConfiguration(): RedisConfiguration | null {
  if (getRedisConfigurationIssue()) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

export function isRedisConfigured(): boolean {
  return getRedisConfiguration() !== null;
}

export class UpstashRedisCommands implements RedisCommands {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get<string>(key);
  }

  set(key: string, value: string, expiryMode: 'EX', ttlSeconds: number): Promise<unknown> {
    if (expiryMode !== 'EX') throw new Error('Unsupported Redis expiry mode.');
    return this.redis.set(key, value, { ex: ttlSeconds });
  }

  del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async incrementRateLimitCounter(key: string, windowMs: number): Promise<RateLimitCounterResult> {
    if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
      throw new Error('Redis rate-limit window must be a positive integer.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const totalHits = Number(await this.redis.incr(key));
      if (!Number.isSafeInteger(totalHits) || totalHits < 1) {
        throw new Error('Redis rate-limit increment returned an invalid counter.');
      }

      await this.redis.pexpire(key, windowMs, 'NX');
      let ttlMs = Number(await this.redis.pttl(key));

      if (ttlMs === -2) continue;
      if (ttlMs === -1) {
        await this.redis.pexpire(key, windowMs, 'NX');
        ttlMs = Number(await this.redis.pttl(key));
      }

      if (!Number.isFinite(ttlMs) || ttlMs < 0) {
        throw new Error('Redis rate-limit increment returned an invalid expiry.');
      }
      return { totalHits, ttlMs };
    }

    throw new Error('Redis rate-limit counter expired while being updated.');
  }

  ping(): Promise<string> {
    return this.redis.ping();
  }
}

export function getRedisClient(): RedisCommands | null {
  if (initializationFailed) return null;
  if (client) return client;

  const configuration = getRedisConfiguration();
  if (!configuration) {
    if (!missingConfigurationLogged) {
      console.info('[Redis] Upstash is not configured; cache bypass and process-local rate limiting are active.');
      missingConfigurationLogged = true;
    }
    return null;
  }

  try {
    const upstash = new Redis({
      ...configuration,
      automaticDeserialization: false,
      retry: { retries: 0 },
    });
    client = new UpstashRedisCommands(upstash);
    return client;
  } catch (error) {
    initializationFailed = true;
    console.warn('[Redis] Upstash client initialization failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return null;
  }
}

export const REDIS_OPERATION_TIMEOUT_MS = operationTimeoutMs;

export async function closeRedisClient(): Promise<void> {
  client = null;
  initializationFailed = false;
}

export function withRedisTimeout<T>(operation: Promise<T>, timeoutMs = operationTimeoutMs): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Redis operation timed out.')), timeoutMs);
    timer.unref?.();
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface RedisHealth {
  configured: boolean;
  status: 'connected' | 'disconnected';
  ping: 'PONG' | 'failed' | 'not_configured';
  latencyMs: number | null;
}

export async function checkRedisHealth(redisClient: RedisCommands | null = getRedisClient()): Promise<RedisHealth> {
  const configured = isRedisConfigured();
  if (!redisClient) {
    return { configured, status: 'disconnected', ping: configured ? 'failed' : 'not_configured', latencyMs: null };
  }

  const startedAt = Date.now();
  try {
    const result = await withRedisTimeout(redisClient.ping(), 1_500);
    if (result !== 'PONG') {
      return { configured, status: 'disconnected', ping: 'failed', latencyMs: null };
    }
    return { configured, status: 'connected', ping: 'PONG', latencyMs: Date.now() - startedAt };
  } catch {
    return { configured, status: 'disconnected', ping: 'failed', latencyMs: null };
  }
}
