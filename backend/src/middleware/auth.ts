import { Request, Response, NextFunction } from 'express';
import { getBearerToken, verifyAccessToken } from '../utils/jwt';
import User from '../models/User';
import { EntitlementId, PlanId } from '../config/subscription';
import { getEffectiveSubscription } from '../services/companySubscription';

export interface AuthRequest extends Request {
  user?: { userId: string; companyId: string; role: string; isSuperAdmin?: boolean; mfaPending?: boolean; mfaAuthenticated?: boolean };
}

const BILLING_AND_BOOTSTRAP_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/auth/create-company',
  '/api/auth/join-company',
  '/api/auth/oauth/google/start',
  '/api/auth/oauth/apple/start',
  '/api/subscription/status',
  '/api/subscription/checkout',
  '/api/subscription/cancel',
  '/api/subscription/change-plan',
  '/api/subscription/reactivate',
  '/api/subscription/coupon',
]);

function isSubscriptionExempt(req: Request): boolean {
  return BILLING_AND_BOOTSTRAP_PATHS.has(req.originalUrl.split('?')[0]);
}

function sendSubscriptionRequired(res: Response, sub: Awaited<ReturnType<typeof getEffectiveSubscription>>): void {
  res.status(403).json({
    success: false,
    code: 'SUBSCRIPTION_REQUIRED',
    message: 'Your WorkGrind subscription has ended. Renew it to continue using this workspace.',
    subscriptionStatus: sub.status,
    plan: sub.plan,
    source: sub.source,
    subscriptionEndDate: sub.subscriptionEndDate?.toISOString(),
    trialEndDate: sub.trialEndDate?.toISOString(),
    billingPath: '/billing',
  });
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    console.warn('[Auth] Request rejected because the access token is missing.', {
      method: req.method,
      path: req.path,
      reason: 'access_token_missing',
      httpStatus: 401,
    });
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }
  let failureStage = 'access_token_verification';
  try {
    const payload = verifyAccessToken(token);
    if (payload.mfaPending) {
      res.status(401).json({ success: false, message: 'Complete the required authentication step first.' });
      return;
    }
    failureStage = 'user_lookup';
    const user = await User.findById(payload.userId).select('isVerified isActive isDeleted');
    if (!user || !user.isVerified || !user.isActive || user.isDeleted) {
      res.status(403).json({ success: false, message: 'Account verification is required.' });
      return;
    }
    req.user = payload;
  } catch (err) {
    console.warn('[Auth] Request rejected because the access token is invalid.', {
      method: req.method,
      path: req.path,
      stage: failureStage,
      errorName: err instanceof Error ? err.name : 'UnknownError',
      httpStatus: 401,
    });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  if (!isSubscriptionExempt(req)) {
    try {
      const sub = await getEffectiveSubscription(req.user!.userId);
      if (!sub.hasActiveAccess) {
        sendSubscriptionRequired(res, sub);
        return;
      }
    } catch (err) {
      console.error(`[Auth] Subscription access check failed for ${req.method} ${req.originalUrl}:`, err);
      res.status(503).json({ success: false, code: 'SUBSCRIPTION_CHECK_UNAVAILABLE', message: 'Unable to verify workspace subscription. Please try again.' });
      return;
    }
  }
  next();
};

export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role || '')) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return; }
  next();
};

export const requireCompany = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.companyId) { res.status(403).json({ success: false, message: 'Company membership required' }); return; }
  next();
};

export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication token required' });
    return;
  }

  try {
    const token = getBearerToken(header);
    if (!token) {
      console.error(`[Auth] 401 No token provided for super admin route ${req.method} ${req.originalUrl}`);
      res.status(401).json({ success: false, message: 'Authentication token required' });
      return;
    }
    const payload = verifyAccessToken(token);
    if (payload.mfaPending) {
      res.status(401).json({ success: false, message: 'Complete multi-factor authentication first.' });
      return;
    }
    req.user = payload;

    // Direct DB check for absolute security: verify isSuperAdmin and active status
    const dbUser = await User.findById(payload.userId).select('isSuperAdmin isActive isVerified mfaEnabled');
    if (!dbUser || !dbUser.isSuperAdmin || !dbUser.isActive) {
      res.status(403).json({ success: false, message: 'Access denied. Super administrator privileges required.' });
      return;
    }
    if (!dbUser.isVerified || (dbUser.mfaEnabled && !payload.mfaAuthenticated)) {
      res.status(403).json({ success: false, message: 'Account verification and multi-factor authentication are required.' });
      return;
    }

    req.user.isSuperAdmin = true;
    next();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Auth] 401 Invalid or expired administrative token for ${req.method} ${req.originalUrl}: ${errorMessage}`);
    res.status(401).json({ success: false, message: 'Invalid or expired administrative token' });
  }
};


/**
 * requireSubscription
 * Checks the company's subscription (or user's personal trial if no company).
 * Always reads fresh from the database — never trusts the JWT payload.
 */
export const requireSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user?.userId) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  try {
    const sub = await getEffectiveSubscription(req.user.userId);

    if (!sub.hasActiveAccess) {
      sendSubscriptionRequired(res, sub);
      return;
    }
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * requirePlan
 * Checks the company's plan is at the required level or higher.
 * Plan hierarchy: free < starter < pro
 */
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2 };

export const requirePlan = (...plans: PlanId[]) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    try {
      const sub = await getEffectiveSubscription(req.user.userId);

      if (!sub.hasActiveAccess) {
        sendSubscriptionRequired(res, sub);
        return;
      }

      const userRank     = PLAN_RANK[sub.plan] ?? 0;
      const requiredRank = Math.min(...plans.map((p) => PLAN_RANK[p] ?? 0));

      if (userRank < requiredRank) {
        res.status(403).json({
          success:       false,
          code:          'PLAN_UPGRADE_REQUIRED',
          message:       `This feature requires the ${plans.join(' or ')} plan.`,
          currentPlan:   sub.plan,
          requiredPlans: plans,
        });
        return;
      }
      next();
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

/** Resolve the current subscription from MongoDB and enforce one feature entitlement. */
export const requireEntitlement = (entitlement: EntitlementId) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    try {
      const sub = await getEffectiveSubscription(req.user.userId);
      if (!sub.planConfig.entitlements[entitlement]) {
        res.status(403).json({
          success: false,
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `${sub.planConfig.name} does not include this feature. Upgrade your workspace plan to continue.`,
          currentPlan: sub.plan,
          requiredEntitlement: entitlement,
          requiresUpgrade: true,
        });
        return;
      }
      next();
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
