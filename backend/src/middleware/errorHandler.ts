import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status: number = err instanceof multer.MulterError
    ? err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    : err.status || err.statusCode || 500;

  // ── Server-side logging — full details for debugging ──────────────────────
  // Log to stderr so it is captured by process managers / log aggregators.
  // Never include passwords, tokens, or other secrets.
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path} → ${status}`, {
      message:  err.message,
      // Stack trace only in development — never expose to clients
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }

  if (/^\/api\/v1(?:\/|$)/.test(req.originalUrl.split('?')[0])) {
    const code = err.type === 'entity.parse.failed'
      ? 'INVALID_JSON'
      : status === 401 ? 'UNAUTHORIZED'
        : status === 403 ? 'FORBIDDEN'
          : status === 404 ? 'NOT_FOUND'
            : status === 429 ? 'RATE_LIMITED'
              : 'REQUEST_FAILED';
    res.status(status >= 500 ? 500 : status).json({
      success: false,
      error: { code, message: code === 'INVALID_JSON' ? 'The request body must contain valid JSON.' : 'The WorkGrind API could not complete this request.' },
    });
    return;
  }

  // ── Client response — safe, no internal details in production ────────────
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && status >= 500) {
    // Hide implementation details from clients in production
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    });
    return;
  }

  // In development OR for 4xx client errors, the message is safe to return
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Expose stack trace only in development — never in production
    ...(process.env.NODE_ENV === 'development' && err.stack && {
      debug: err.stack.split('\n').slice(0, 4).join('\n'),
    }),
  });
};
