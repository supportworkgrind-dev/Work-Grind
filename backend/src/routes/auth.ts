import { Request, RequestHandler, Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  verifyRegistrationCode,
  resendRegistrationCode,
  requestPhoneOtp,
  verifyPhoneOtp,
  requestPhoneChangeOtp,
  verifyPhoneChangeOtp,
  recoverPasswordByPhone,
  forgotPassword,
  resetPassword,
  changePassword,
  createCompany,
  joinCompany,
  getMe,
  validateInvite,
  startSocialPhoneVerification,
  verifySocialPhoneOtp,
} from '../controllers/auth.controller';
import {
  completeOAuthCallback,
  exchangeOAuthSession,
  startOAuth,
} from '../controllers/oauth.controller';
import { authenticate, authenticatePhoneVerification } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { normalizePhoneNumber } from '../services/phoneVerification';

const router = Router();
const phoneRateLimitKey = (req: Request) =>
  normalizePhoneNumber(req.body?.phone) || String(req.body?.email || 'invalid-phone').trim().toLowerCase();
const startOAuthRoute: RequestHandler = (req, res, next) => {
  if (req.query.intent === 'link') return authenticate(req, res, next);
  return startOAuth(req, res).catch(next);
};
const completeOAuthCallbackRoute: RequestHandler = (req, res, next) =>
  completeOAuthCallback(req, res).catch(next);
const exchangeOAuthSessionRoute: RequestHandler = (req, res, next) =>
  exchangeOAuthSession(req, res).catch(next);

router.post('/register', rateLimiter(15, 5), rateLimiter(60, 5, {
  keyGenerator: phoneRateLimitKey,
}), rateLimiter(60, 5, {
  keyGenerator: (req) => String(req.body?.email || 'invalid-email').trim().toLowerCase(),
}), register);
router.post('/login', rateLimiter(15, 10), rateLimiter(60, 10, {
  keyGenerator: (req) => String(req.body?.email || 'invalid-email').trim().toLowerCase(),
}), login);
router.post('/phone-otp/request', rateLimiter(15, 10), rateLimiter(60, 5, {
  keyGenerator: phoneRateLimitKey,
}), requestPhoneOtp);
router.post('/phone-otp/verify', rateLimiter(15, 10), rateLimiter(60, 10, {
  keyGenerator: phoneRateLimitKey,
}), verifyPhoneOtp);
router.post('/phone-otp/request-change', authenticate, rateLimiter(15, 5), rateLimiter(60, 5, {
  keyGenerator: (req) => String((req as any).user?.userId || 'invalid-user').trim().toLowerCase(),
}), requestPhoneChangeOtp);
router.post('/phone-otp/verify-change', authenticate, rateLimiter(15, 10), rateLimiter(60, 10, {
  keyGenerator: (req) => String((req as any).user?.userId || 'invalid-user').trim().toLowerCase(),
}), verifyPhoneChangeOtp);
router.post('/phone-otp/start-social-signup', authenticatePhoneVerification, rateLimiter(15, 5), rateLimiter(60, 3, {
  keyGenerator: (req) => String((req as any).user?.userId || 'invalid-user').trim().toLowerCase(),
}), startSocialPhoneVerification);
router.post('/phone-otp/verify-social-signup', authenticatePhoneVerification, rateLimiter(15, 10), rateLimiter(60, 5, {
  keyGenerator: (req) => String((req as any).user?.userId || 'invalid-user').trim().toLowerCase(),
}), verifySocialPhoneOtp);
router.post('/phone-otp/recover', rateLimiter(15, 10), rateLimiter(60, 10, {
  keyGenerator: phoneRateLimitKey,
}), recoverPasswordByPhone);
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
router.post('/join-company', authenticate, joinCompany);
router.get('/me', authenticate, getMe);

export default router;
