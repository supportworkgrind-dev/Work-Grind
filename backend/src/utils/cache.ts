import { getRedisClient, REDIS_OPERATION_TIMEOUT_MS, withRedisTimeout, type RedisCommands } from '../config/redis';

const CACHE_KEY_PREFIX = 'workgrind:cache:v1';

function logCacheFailure(operation: 'get' | 'set' | 'delete', error: unknown): void {
  const candidate = error as { name?: unknown; code?: unknown } | null;
  console.warn('[Cache] Redis operation failed; continuing without cached data.', {
    operation,
    errorName: typeof candidate?.name === 'string' ? candidate.name : 'RedisError',
    code: typeof candidate?.code === 'string' ? candidate.code : undefined,
  });
}

export function namespacedCacheKey(namespace: string, tenantId: string): string {
  return `${CACHE_KEY_PREFIX}:${namespace}:${tenantId}`;
}

export async function getOrSetJsonCache<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  redisClient: RedisCommands | null = getRedisClient(),
): Promise<T> {
  if (!redisClient || !Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
    return load();
  }

  try {
    const cached = await withRedisTimeout(redisClient.get(key));
    if (cached !== null) {
      try {
        return JSON.parse(cached) as T;
      } catch (error) {
        logCacheFailure('get', error);
        void deleteCacheKey(key, redisClient);
      }
    }
  } catch (error) {
    logCacheFailure('get', error);
  }

  const value = await load();
  try {
    const serialized = JSON.stringify(value);
    if (serialized !== undefined) {
      void withRedisTimeout(
        redisClient.set(key, serialized, 'EX', ttlSeconds),
        REDIS_OPERATION_TIMEOUT_MS,
      ).catch((error: unknown) => logCacheFailure('set', error));
    }
  } catch (error) {
    logCacheFailure('set', error);
  }
  return value;
}

export async function deleteCacheKey(
  key: string,
  redisClient: RedisCommands | null = getRedisClient(),
): Promise<void> {
  if (!redisClient) return;
  try {
    await withRedisTimeout(redisClient.del(key));
  } catch (error) {
    logCacheFailure('delete', error);
  }
}
