import { Request, RequestHandler, Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  verifyRegistrationCode,
  resendRegistrationCode,
  forgotPassword,
  resetPassword,
  changePassword,
  createCompany,
  saveWorkspaceSelection,
  saveOnboardingProgress,
  completeOnboarding,
  joinCompany,
  getMe,
  validateInvite,
} from '../controllers/auth.controller';
import {
  completeOAuthCallback,
  exchangeOAuthSession,
  startOAuth,
} from '../controllers/oauth.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { authenticateClient, ClientRequest } from '../controllers/clientPortal.controller';

const router = Router();
const startOAuthRoute: RequestHandler = (req, res, next) => {
  if (req.query.audience === 'client' && req.query.intent === 'link') {
    return authenticateClient(req as ClientRequest, res, (error?: unknown) => {
      if (error) return next(error);
      void startOAuth(req, res).catch(next);
    });
  }
  if (req.query.intent === 'link' || req.query.intent === 'publishing') {
    return authenticate(req, res, (error?: unknown) => {
      if (error) return next(error);
      void startOAuth(req, res).catch(next);
    });
  }
  return startOAuth(req, res).catch(next);
};
const completeOAuthCallbackRoute: RequestHandler = (req, res, next) =>
  completeOAuthCallback(req, res).catch(next);
const exchangeOAuthSessionRoute: RequestHandler = (req, res, next) =>
  exchangeOAuthSession(req, res).catch(next);

router.post('/register', rateLimiter(15, 5), rateLimiter(60, 5, {
  keyGenerator: (req) => String(req.body?.email || 'invalid-email').trim().toLowerCase(),
}), register);
router.post('/login', rateLimiter(15, 10), rateLimiter(60, 10, {
  keyGenerator: (req) => String(req.body?.email || 'invalid-email').trim().toLowerCase(),
}), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/verify-email', verifyEmail);
router.post('/verify-registration-code', rateLimiter(15, 10), verifyRegistrationCode);
router.post('/resend-registration-code', rateLimiter(60, 5), rateLimiter(60, 5, {
  keyGenerator: (req) => String(req.body?.email || 'invalid-email').trim().toLowerCase(),
}), resendRegistrationCode);
router.post('/forgot-password', rateLimiter(15, 10), rateLimiter(60, 5, {
  keyGenerator: (req) => String(req.body?.email || 'invalid-email').trim().toLowerCase(),
}), forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticate, rateLimiter(15, 5), changePassword);
router.get('/oauth/:provider/start', rateLimiter(15, 10), startOAuthRoute);
router.get('/oauth/:provider/callback', rateLimiter(15, 20), completeOAuthCallbackRoute);
router.post('/oauth/:provider/callback', rateLimiter(15, 20), completeOAuthCallbackRoute);
router.post('/oauth/exchange', rateLimiter(15, 10), exchangeOAuthSessionRoute);
router.get('/invite/:tokenOrCode', validateInvite);
router.post('/create-company', authenticate, createCompany);
router.put('/workspace-selection', authenticate, saveWorkspaceSelection);
router.patch('/onboarding/progress', authenticate, saveOnboardingProgress);
router.post('/onboarding/complete', authenticate, completeOnboarding);
router.post('/join-company', authenticate, joinCompany);
router.get('/me', authenticate, getMe);

export default router;
