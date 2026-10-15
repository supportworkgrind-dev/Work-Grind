import rateLimit, { Store } from 'express-rate-limit';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { getRedisClient, withRedisTimeout } from '../config/redis';

type RateLimiterOptions = {
  message?: Record<string, unknown>;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  allowInMemoryOnVercel?: boolean;
};

const incrementScript = `
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if hits == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = ARGV[1]
end
return { hits, ttl }
`;

let storeSequence = 0;
let missingRedisWarningLogged = false;

export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;

  constructor(
    private readonly redis: Redis,
    private readonly windowMs: number,
    keyPrefix: string,
  ) {
    this.prefix = keyPrefix;
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}:${key}`;
    const result = await withRedisTimeout((async () => {
      await this.ensureConnected();
      return this.redis.eval(incrementScript, 1, redisKey, String(this.windowMs)) as Promise<[number, number]>;
    })(), 1_500);
    const [totalHits, ttl] = result.map(Number);
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await withRedisTimeout((async () => {
      await this.ensureConnected();
      const hits = await this.redis.decr(redisKey);
      if (hits <= 0) await this.redis.del(redisKey);
    })(), 1_500);
  }

  async resetKey(key: string): Promise<void> {
    await withRedisTimeout((async () => {
      await this.ensureConnected();
      await this.redis.del(`${this.prefix}:${key}`);
    })(), 1_500);
  }
}

export const rateLimiter = (windowMin: number, max: number, options: RateLimiterOptions = {}) => {
  const windowMs = windowMin * 60 * 1000;
  const redis = getRedisClient();
  const { allowInMemoryOnVercel = false, ...rateLimitOptions } = options;
  let store: Store | undefined;
  if (redis) {
    store = new RedisRateLimitStore(redis, windowMs, `workgrind:rate-limit:${++storeSequence}`);
  } else if (process.env.VERCEL === '1' && !allowInMemoryOnVercel) {
    if (!missingRedisWarningLogged) {
      console.error('[Rate limit] REDIS_URL is required on Vercel; rate-limited requests will fail closed until configured.');
      missingRedisWarningLogged = true;
    }
    return (_req: Request, res: Response) => res.status(503).json({
      success: false,
      code: 'RATE_LIMIT_UNAVAILABLE',
      message: 'Request protection is temporarily unavailable. Please retry later.',
    });
  } else if (!redis && !missingRedisWarningLogged) {
    const message = process.env.VERCEL === '1'
      ? '[Rate limit] In-memory rate limiting is enabled only for explicitly exempted health checks.'
      : '[Rate limit] REDIS_URL is not configured; local development uses process-local rate limits.';
    console.warn(message);
    missingRedisWarningLogged = true;
  }

  return rateLimit({
    windowMs,
    max,
    passOnStoreError: false,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitOptions.message || { success: false, message: 'Too many requests, please try again later.' },
    skip: rateLimitOptions.skip,
    keyGenerator: rateLimitOptions.keyGenerator,
    store,
  });
};
