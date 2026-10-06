import dotenv from 'dotenv';
import path from 'path';
import { getAllowedClientOrigins } from './utils/clientOrigins';

// Load environment variables immediately before any other module evaluation
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// ── Startup environment validation ───────────────────────────────────────────
// Runs immediately after dotenv loads. Reports every missing variable by NAME
// so the operator knows exactly what to add — values are never logged.
// Optional vars are noted but never crash the process.
(function validateStartupEnv() {
  const REQUIRED: Array<{ key: string; service: string }> = [
    { key: 'JWT_SECRET',         service: 'Authentication (JWT access tokens)' },
    { key: 'JWT_REFRESH_SECRET', service: 'Authentication (JWT refresh tokens)' },
    { key: 'MONGODB_URI',        service: 'Database (MongoDB Atlas)' },
  ];

  const OPTIONAL: Array<{ key: string; service: string; note?: string }> = [
    { key: 'CLIENT_JWT_SECRET',        service: 'Client Portal JWT',         note: 'Falls back to JWT_SECRET+_client if unset (weaker isolation)' },
    { key: 'GEMINI_API_KEY',           service: 'Gemini AI',                 note: 'AI features disabled if unset' },
    { key: 'GEMINI_MODEL',             service: 'Gemini AI model selection',  note: 'Defaults to gemini-2.5-flash' },
    { key: 'POLAR_ACCESS_TOKEN',       service: 'Polar Payments',            note: 'Payments disabled if unset' },
    { key: 'POLAR_WEBHOOK_SECRET',     service: 'Polar Webhook verification', note: 'Webhooks disabled if unset' },
    { key: 'POLAR_STARTER_PRODUCT_ID', service: 'Polar Starter plan',        note: 'Starter checkout disabled if unset' },
    { key: 'POLAR_PRO_PRODUCT_ID',     service: 'Polar Pro plan',            note: 'Pro checkout disabled if unset' },
    { key: 'R2_ACCOUNT_ID',            service: 'Cloudflare R2 Storage',     note: 'File uploads fall back to local disk if unset' },
    { key: 'R2_ACCESS_KEY_ID',         service: 'Cloudflare R2 Storage' },
    { key: 'R2_SECRET_ACCESS_KEY',     service: 'Cloudflare R2 Storage' },
    { key: 'R2_BUCKET_NAME',           service: 'Cloudflare R2 Storage' },
    { key: 'R2_ENDPOINT',              service: 'Cloudflare R2 Storage' },
    { key: 'SMTP_HOST',                service: 'Email (SMTP)',               note: 'Email delivery disabled if unset' },
    { key: 'SMTP_USER',                service: 'Email (SMTP)' },
    { key: 'SMTP_PASS',                service: 'Email (SMTP)' },
    { key: 'FROM_EMAIL',               service: 'Email sender address' },
    { key: 'FROM_NAME',                service: 'Email sender name' },
    { key: 'MFA_ENCRYPTION_KEY',       service: 'MFA secret encryption',     note: 'Falls back to JWT_SECRET if unset (less secure)' },
    { key: 'CLIENT_URL',               service: 'CORS / frontend URL' },
  ];

  const missing = REQUIRED.filter(({ key }) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error('');
    console.error('❌ ====================================================================');
    console.error('❌  WorkGrind startup: REQUIRED environment variables are missing.');
    console.error('❌  The server will continue but these features will fail at runtime.');
    console.error('❌ ====================================================================');
    for (const { key, service } of missing) {
      console.error(`❌  Missing: ${key}  →  required by: ${service}`);
    }
    console.error('❌  Set these variables in backend/.env and restart the server.');
    console.error('❌ ====================================================================');
    console.error('');
  }

  // Warn about placeholder values that were never replaced
  const PLACEHOLDERS = ['<db_username>', '<db_password>', '<password>', '<user>', '<cluster>',
                        'change_me', 'your_', 'sk-...', 'polar_at_...', 'whsec_...'];
  const withPlaceholders = [...REQUIRED, ...OPTIONAL].filter(({ key }) => {
    const val = process.env[key]?.trim() ?? '';
    return val && PLACEHOLDERS.some(p => val.includes(p));
  });
  if (withPlaceholders.length > 0) {
    console.warn('');
    console.warn('⚠️  The following variables appear to contain unreplaced placeholder values:');
    for (const { key } of withPlaceholders) {
      console.warn(`⚠️    ${key}`);
    }
    console.warn('⚠️  Replace placeholders with real values in backend/.env');
    console.warn('');
  }

})();

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB, isDbConfigMissing } from './utils/db';
import { initSocket } from './utils/socket';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logPolarConfig } from './config/subscription';
import { logR2Config }   from './services/r2Storage';
import { logGeminiConfig } from './services/geminiService';
import { runTaskDueReminderSweep } from './services/taskDueReminders';
import { cleanupExpiredVerificationCodes, migrateRefreshTokensAtRest } from './services/refreshTokenMigration';
import mongoose from 'mongoose';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import companyRoutes from './routes/companies';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import dmRoutes from './routes/directMessages';
import taskRoutes from './routes/tasks';
import projectRoutes from './routes/projects';
import meetingRoutes from './routes/meetings';
import calendarRoutes from './routes/calendar';
import fileRoutes from './routes/files';
import documentRoutes from './routes/documents';
import sheetsRoutes from './routes/sheets';
import notificationRoutes from './routes/notifications';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import aiAgentRoutes from './routes/aiAgent';
import superAdminRoutes from './routes/superAdmin';
import contactRoutes from './routes/contact';
import demoRoutes from './routes/demo';
import dailyFocusRoutes from './routes/dailyFocus';
import moderationRoutes from './routes/moderation';
import crmRoutes from './routes/crm';
import subscriptionRoutes from './routes/subscription';
import analyticsRoutes from './routes/analytics';
import workflowRoutes from './routes/workflows';
import integrationRoutes from './routes/integrations';
import clientPortalRoutes from './routes/clientPortal';
import approvalRoutes from './routes/approvals';
import boardRoutes from './routes/boards';
import developerRoutes from './routes/developer';
import connectApiRoutes from './routes/connectApi';
import callingRoutes from './routes/calls';
import rtcRoutes from './routes/rtc';

const app = express();
const server = http.createServer(app);
const isVercelRuntime = process.env.VERCEL === '1';
let serverlessInitialization: Promise<boolean> | null = null;
let serverlessInitialized = false;

// Trust the Vercel proxy chain in serverless; locally trust only the frontend
// development proxy so clients cannot spoof forwarded IP headers.
app.set('trust proxy', isVercelRuntime ? true : 'loopback');

async function ensureServerlessInitialization(): Promise<boolean> {
  if (mongoose.connection.readyState === 1 && serverlessInitialized) return true;
  if (!serverlessInitialization) {
    serverlessInitialization = (async () => {
      const connection = await connectDB();
      if (!connection || mongoose.connection.readyState !== 1) return false;
      if (!serverlessInitialized) {
        await migrateRefreshTokensAtRest();
        await cleanupExpiredVerificationCodes();
        serverlessInitialized = true;
      }
      return true;
    })()
      .catch((error: unknown) => {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error('[Startup] Serverless initialization failed.', { errorName });
        return false;
      })
      .finally(() => {
        serverlessInitialization = null;
      });
  }
  return serverlessInitialization;
}

if (isVercelRuntime) {
  app.use(async (_req, res, next) => {
    if (await ensureServerlessInitialization()) {
      next();
      return;
    }
    res.status(503).json({
      status: 'unavailable',
      code: isDbConfigMissing() ? 'DB_NOT_CONFIGURED' : 'DB_UNAVAILABLE',
      message: 'WorkGrind data storage is unavailable. Check the backend database configuration and connectivity.',
    });
  });
}

const sendHealthStatus = (_req: express.Request, res: express.Response) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'unavailable',
    service: 'WorkGrind API',
    database: databaseReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', sendHealthStatus);

// Global Middlewares

// ── Helmet — security headers ─────────────────────────────────────────────────
// crossOriginResourcePolicy is set to 'same-site' so that uploaded files
// (served via the authenticated download endpoint) are not embeddable
// cross-origin. 'cross-origin' would allow any site to embed our assets.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Strict CSP disabled here because it requires per-app tuning;
    // the frontend (Next.js) manages its own CSP headers.
    contentSecurityPolicy: false,
    // HSTS only makes sense over HTTPS; in production this should be
    // enabled. We keep it on so it activates automatically when the
    // reverse-proxy terminates TLS.
    hsts: {
      maxAge: 31_536_000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME-type sniffing attacks
    noSniff: true,
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Don't expose the X-Powered-By: Express header
    hidePoweredBy: true,
    // Control referrer exposure
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman in dev)
      if (!origin) return callback(null, true);

      const allowedOrigins = getAllowedClientOrigins();

      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Logging — dev-only verbose, production minimal ──────────────────────────
// OAuth callback query strings contain one-time authorization codes and state;
// never write those callback URLs to request logs.
const skipOAuthCallbackLogs = (req: express.Request) =>
  /^\/api\/auth\/oauth\/(?:google|apple)\/callback(?:\?|$)/.test(req.originalUrl);
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev', { skip: skipOAuthCallbackLogs }));
} else {
  app.use(morgan('combined', { skip: skipOAuthCallbackLogs }));
}

app.use(express.json({ limit: '20mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '20mb',
  })
);

// Static directory for file uploads — served through authenticated download endpoint
// DO NOT serve uploads as open static files; use /api/files/:id/download instead.
// The express.static below is intentionally removed to prevent:
//   1. Unauthenticated access to uploaded files
//   2. Path traversal attacks (e.g. GET /uploads/../.env)
//   3. Direct URL sharing bypassing company isolation
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── DB readiness check ────────────────────────────────────────────────────────
// Return 503 immediately if Mongoose is not connected, instead of letting
// queries hang for 10 seconds until Mongoose's buffer timeout fires.
// The /health and /api/health endpoints are exempted so the load-balancer
// can still detect the server is up while the database reconnects.
app.use((req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/api/health'
  ) {
    return next(); // always allow health checks through
  }
  const isConnectApi = req.originalUrl.split('?')[0].startsWith('/api/v1');

  // If the URI had a placeholder, fail immediately with a clear message
  if (isDbConfigMissing()) {
    return res.status(503).json(isConnectApi
      ? { success: false, error: { code: 'DB_NOT_CONFIGURED', message: 'WorkGrind data storage is not configured.' } }
      : { success: false, code: 'DB_NOT_CONFIGURED', message: 'Database is not configured. Replace <db_username> in backend/.env with your MongoDB Atlas username, then restart the server.' });
  }

  const state = mongoose.connection.readyState;
  if (state === 1) return next();
  // Reject requests while disconnected, connecting, or disconnecting.
  return res.status(503).json(isConnectApi
    ? { success: false, error: { code: 'DB_UNAVAILABLE', message: 'WorkGrind data storage is unavailable. Retry shortly.' } }
    : { success: false, code: 'DB_UNAVAILABLE', message: 'Database connection is unavailable. Please try again in a moment.' });
});

// Rate limiters
app.use('/api/auth', rateLimiter(15, 100));
// Stricter limits for sensitive auth sub-routes (brute-force protection)
app.use('/api/auth/login',          rateLimiter(15, 10));   // 10 login attempts per 15 min
app.use('/api/auth/forgot-password', rateLimiter(60, 5));   // 5 resets per hour
    app.use('/api/calls', callingRoutes);
    app.use('/api/rtc', rtcRoutes);
app.use('/api/ai',                  rateLimiter(60, 30));   // 30 AI requests per hour (cost protection)
app.use('/api/super-admin/auth',    rateLimiter(15, 5));    // 5 super-admin login attempts
app.use('/api/client-portal/auth',  rateLimiter(15, 10));   // 10 client login attempts per 15 min
app.use('/api/analytics',           rateLimiter(15, 60));   // 60 analytics requests per 15 min
app.use('/api/workflows',           rateLimiter(15, 120));  // reasonable workflow management limit
app.use('/api/v1',                 rateLimiter(15, 600, { message: { success: false, error: { code: 'RATE_LIMITED', message: 'API request limit exceeded. Retry later.' } } }));
app.use('/api',                     rateLimiter(15, 600, { skip: (req) => req.originalUrl.startsWith('/api/v1') }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/direct-messages', dmRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai', aiAgentRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/daily-focus', dailyFocusRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/developer', developerRoutes);
app.use('/api/v1', connectApiRoutes);
app.use('/api/calls', callingRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  sendHealthStatus(_req, res);
});

// Global Error Handler
app.use(errorHandler);

// Start the API and realtime server only after MongoDB is ready.
const PORT = process.env.PORT || 5000;

async function startServer(): Promise<void> {
  try {
    const connection = await connectDB();
    if (!connection || mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection did not become ready.');
    }

    console.log('✅ MongoDB connected');
    await migrateRefreshTokensAtRest();
    await cleanupExpiredVerificationCodes();
    try {
      const { seedDatabase } = await import('./utils/seed');
      await seedDatabase();
      console.log('✅ Database seed completed');
    } catch (err) {
      console.error('⚠️ Database seed error:', err);
    }

    initSocket(server);

    const runDueReminderSweep = () => {
      if (mongoose.connection.readyState !== 1) return;
      void runTaskDueReminderSweep().catch(() => console.error('[Tasks] Due reminder sweep failed'));
    };
    runDueReminderSweep();
    const reminderInterval = setInterval(runDueReminderSweep, 15 * 60 * 1000);
    reminderInterval.unref();

    const cleanupVerificationCodes = () => {
      if (mongoose.connection.readyState !== 1) return;
      void cleanupExpiredVerificationCodes().catch(() => console.error('[Auth] Expired verification-code cleanup failed.'));
    };
    const verificationCleanupInterval = setInterval(cleanupVerificationCodes, 60 * 60 * 1000);
    verificationCleanupInterval.unref();

    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      const onError = (error: Error) => {
        server.off('listening', onListening);
        reject(error);
      };
      server.once('listening', onListening);
      server.once('error', onError);
      server.listen(PORT);
    });

    console.log(`🚀 WorkGrind API & Realtime Server running on port ${PORT}`);
    logPolarConfig();
    logR2Config();
    logGeminiConfig();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('❌ WorkGrind startup aborted; MongoDB/API server is not ready.', { errorName });
    process.exitCode = 1;
    await mongoose.disconnect().catch(() => undefined);
  }
}

if (!isVercelRuntime) void startServer();

export default app;