import rateLimit, { Store } from 'express-rate-limit';
import { Request, RequestHandler, Response } from 'express';
import { getRedisClient, withRedisTimeout, type RedisCommands } from '../config/redis';

type RateLimiterOptions = {
  message?: Record<string, unknown>;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
};

let storeSequence = 0;
let redisFallbackWarningLogged = false;

class RedisRateLimitStoreUnavailable extends Error {
  constructor() {
    super('Redis rate-limit store unavailable.');
    this.name = 'RedisRateLimitStoreUnavailable';
  }
}

export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;

  constructor(
    private readonly redis: RedisCommands,
    private readonly windowMs: number,
    keyPrefix: string,
  ) {
    this.prefix = keyPrefix;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}:${key}`;
    try {
      const result = await withRedisTimeout(
        this.redis.incrementRateLimitCounter(redisKey, this.windowMs),
        1_500,
      );
      if (!result || typeof result !== 'object') {
        throw new Error('Redis rate-limit increment returned an invalid response.');
      }
      const totalHits = Number(result.totalHits);
      const ttlMs = Number(result.ttlMs);
      if (!Number.isFinite(totalHits) || !Number.isFinite(ttlMs) || ttlMs < 0) {
        throw new Error('Redis rate-limit increment returned invalid counters.');
      }
      return { totalHits, resetTime: new Date(Date.now() + ttlMs) };
    } catch {
      throw new RedisRateLimitStoreUnavailable();
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await withRedisTimeout((async () => {
      const hits = await this.redis.decr(redisKey);
      if (hits <= 0) await this.redis.del(redisKey);
    })(), 1_500);
  }

  async resetKey(key: string): Promise<void> {
    await withRedisTimeout(this.redis.del(`${this.prefix}:${key}`), 1_500);
  }
}

export const rateLimiter = (
  windowMin: number,
  max: number,
  options: RateLimiterOptions = {},
  redisClient: RedisCommands | null = getRedisClient(),
) => {
  const windowMs = windowMin * 60 * 1000;
  const rateLimitOptions = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message || { success: false, message: 'Too many requests, please try again later.' },
    skip: options.skip,
    keyGenerator: options.keyGenerator,
  };

  // Keep a supported express-rate-limit MemoryStore active even when the shared
  // store is healthy, so a Redis outage never removes the request limit.
  const localLimiter = rateLimit(rateLimitOptions);
  if (!redisClient) {
    if (!redisFallbackWarningLogged) {
      console.warn('[Rate limit] Upstash is unavailable; process-local rate limits are active.');
      redisFallbackWarningLogged = true;
    }
    return localLimiter;
  }

  const redisLimiter = rateLimit({
    ...rateLimitOptions,
    passOnStoreError: false,
    store: new RedisRateLimitStore(redisClient, windowMs, `workgrind:rate-limit:${++storeSequence}`),
  });
  const redisFallback: RequestHandler = (req, res, next) => {
    redisLimiter(req, res, (error?: unknown) => {
      if (error instanceof RedisRateLimitStoreUnavailable) {
        if (!redisFallbackWarningLogged) {
          console.warn('[Rate limit] Redis is unavailable; process-local rate limits remain active.');
          redisFallbackWarningLogged = true;
        }
        return next();
      }
      return next(error);
    });
  };

  return (req: Request, res: Response, next: (error?: unknown) => void) => {
    localLimiter(req, res, (error?: unknown) => {
      if (error) return next(error);
      return redisFallback(req, res, next);
    });
  };
};
