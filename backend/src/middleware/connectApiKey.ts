import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { DeveloperApiKey, DeveloperApiRateWindow, type ConnectScope } from '../models/DeveloperAccess';
import Company from '../models/Company';
import User from '../models/User';
import { getEffectiveSubscription } from '../services/companySubscription';

export interface ConnectApiRequest extends Request {
  connectApiKey?: {
    id: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    scopes: ConnectScope[];
  };
}

const REQUESTS_PER_MINUTE = 120;

export async function authenticateConnectApiKey(req: ConnectApiRequest, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header('authorization') || '';
  const match = /^Bearer (wg_live_[a-f0-9]{16}_[A-Za-z0-9_-]{40,48})$/.exec(authorization);
  if (!match) {
    res.status(401).json({ success: false, error: { code: 'API_KEY_REQUIRED', message: 'Provide a valid WorkGrind API key as a Bearer token.' } });
    return;
  }

  try {
    const rawKey = match[1];
    const lookupId = rawKey.slice('wg_live_'.length, 'wg_live_'.length + 16);
    const record = await DeveloperApiKey.findOne({ lookupId, revokedAt: { $exists: false } }).select('+secretHash');
    if (!record) {
      res.status(401).json({ success: false, error: { code: 'INVALID_API_KEY', message: 'The API key is invalid or revoked.' } });
      return;
    }

    const expected = Buffer.from(record.secretHash, 'hex');
    const actual = Buffer.from(createHash('sha256').update(rawKey).digest('hex'), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      res.status(401).json({ success: false, error: { code: 'INVALID_API_KEY', message: 'The API key is invalid or revoked.' } });
      return;
    }

    const [company, creator] = await Promise.all([
      Company.exists({ _id: record.companyId, isActive: true }),
      User.exists({ _id: record.createdBy, companyId: record.companyId, isActive: true, role: { $in: ['owner', 'admin'] } }),
    ]);
    if (!company || !creator) {
      res.status(401).json({ success: false, error: { code: 'API_KEY_UNAVAILABLE', message: 'The API key is no longer authorized.' } });
      return;
    }

    const resource = req.path.split('/').filter(Boolean)[0];
    const subscription = await getEffectiveSubscription(record.createdBy.toString());
    if (!subscription.hasActiveAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Your WorkGrind subscription has ended. Renew it to continue using this workspace.',
          subscriptionStatus: subscription.status,
          plan: subscription.plan,
        },
      });
      return;
    }
    const entitlement = ['contacts', 'companies', 'deals'].includes(resource) ? 'crm' : ['projects', 'tasks'].includes(resource) ? 'tasksProjects' : undefined;
    if (entitlement) {
      if (!subscription.planConfig.entitlements[entitlement]) {
        res.status(403).json({ success: false, error: { code: 'FEATURE_NOT_AVAILABLE', message: `The workspace plan does not include ${entitlement}.` } });
        return;
      }
    }

    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    try {
      const window = await DeveloperApiRateWindow.findOneAndUpdate(
        { apiKeyId: record._id, windowStart },
        { $inc: { requestCount: 1 }, $setOnInsert: { expiresAt: new Date(windowStart.getTime() + 2 * 60_000) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      res.setHeader('X-RateLimit-Limit', String(REQUESTS_PER_MINUTE));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, REQUESTS_PER_MINUTE - (window?.requestCount || 0))));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(windowStart.getTime() / 1000) + 60));
      if ((window?.requestCount || 0) > REQUESTS_PER_MINUTE) {
        res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'API key request limit exceeded. Retry after the current one-minute window.' } });
        return;
      }
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const window = await DeveloperApiRateWindow.findOneAndUpdate(
        { apiKeyId: record._id, windowStart },
        { $inc: { requestCount: 1 } },
        { new: true },
      );
      if ((window?.requestCount || 0) > REQUESTS_PER_MINUTE) {
        res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'API key request limit exceeded. Retry after the current one-minute window.' } });
        return;
      }
    }

    req.connectApiKey = {
      id: record._id,
      companyId: record.companyId,
      createdBy: record.createdBy,
      scopes: record.scopes,
    };

    const startedAt = Date.now();
    res.on('finish', () => {
      const path = req.path.split('/').filter(Boolean).map((segment) => /^[a-f\d]{24}$/i.test(segment) ? ':id' : segment).join('/').slice(0, 200);
      void Promise.all([
        DeveloperApiKey.updateOne({ _id: record._id, revokedAt: { $exists: false } }, { $set: { lastUsedAt: new Date() } }),
        (async () => {
          const { DeveloperApiRequestLog } = await import('../models/DeveloperAccess');
          await DeveloperApiRequestLog.create({
            companyId: record.companyId,
            apiKeyId: record._id,
            method: req.method,
            path,
            statusCode: res.statusCode,
            durationMs: Math.max(0, Date.now() - startedAt),
          });
        })(),
      ]).catch(() => undefined);
    });
    next();
  } catch {
    res.status(503).json({ success: false, error: { code: 'API_AUTH_UNAVAILABLE', message: 'API key authentication is temporarily unavailable.' } });
  }
}

export function requireConnectScope(scope: ConnectScope) {
  return (req: ConnectApiRequest, res: Response, next: NextFunction): void => {
    if (!req.connectApiKey?.scopes.includes(scope)) {
      res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_SCOPE', message: `This API key requires the ${scope} scope.` } });
      return;
    }
    next();
  };
}
