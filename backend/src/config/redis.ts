import Redis from 'ioredis';

export interface RedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
  status?: string;
  connect?(): Promise<void>;
}

const connectTimeoutMs = 1_000;
const operationTimeoutMs = 350;
let client: Redis | null = null;
let initializationFailed = false;
let missingConfigurationLogged = false;

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url || initializationFailed) {
    if (!url && !missingConfigurationLogged) {
      console.info('[Redis] REDIS_URL is not configured; using MongoDB-backed operations.');
      missingConfigurationLogged = true;
    }
    return null;
  }
  if (client?.status === 'end') client = null;
  if (client) return client;

  try {
    client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: connectTimeoutMs,
      retryStrategy: (attempt) => attempt <= 2 ? Math.min(attempt * 100, 300) : null,
      autoResendUnfulfilledCommands: false,
    });
    client.on('error', (error: NodeJS.ErrnoException) => {
      console.warn('[Redis] Connection error.', {
        errorName: error.name || 'RedisError',
        code: error.code,
      });
    });
    return client;
  } catch (error) {
    initializationFailed = true;
    console.warn('[Redis] Client initialization failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return null;
  }
}

export const REDIS_OPERATION_TIMEOUT_MS = operationTimeoutMs;

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
  const configured = Boolean(process.env.REDIS_URL?.trim());
  if (!redisClient) {
    return { configured, status: 'disconnected', ping: configured ? 'failed' : 'not_configured', latencyMs: null };
  }

  const startedAt = Date.now();
  try {
    const result = await withRedisTimeout((async () => {
      if (redisClient.status === 'wait' && redisClient.connect) {
        await redisClient.connect();
      }
      return redisClient.ping();
    })(), 1_500);
    if (result !== 'PONG') {
      return { configured, status: 'disconnected', ping: 'failed', latencyMs: null };
    }
    return { configured, status: 'connected', ping: 'PONG', latencyMs: Date.now() - startedAt };
  } catch {
    return { configured, status: 'disconnected', ping: 'failed', latencyMs: null };
  }
}
