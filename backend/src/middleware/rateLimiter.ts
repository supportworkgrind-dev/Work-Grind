import rateLimit from 'express-rate-limit';
import { Request } from 'express';

type RateLimiterOptions = {
  message?: Record<string, unknown>;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
};

export const rateLimiter = (windowMin: number, max: number, options: RateLimiterOptions = {}) => rateLimit({
  windowMs: windowMin * 60 * 1000, max,
  standardHeaders: true, legacyHeaders: false,
  message: options.message || { success: false, message: 'Too many requests, please try again later.' },
  skip: options.skip,
  keyGenerator: options.keyGenerator,
});
