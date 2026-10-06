import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import User, { IUser } from '../models/User';
import OAuthTransaction, { IOAuthTransaction, OAuthProvider } from '../models/OAuthTransaction';
import OAuthExchange, { IOAuthExchange } from '../models/OAuthExchange';
import { AuthRequest } from '../middleware/auth';
import { createWorkGrindUser } from '../services/callingId';
import { TRIAL_DAYS } from '../config/subscription';
import { sendWelcomeEmail } from '../utils/email';
import { sessionForUser } from './auth.controller';
import { generatePhoneVerificationToken } from '../utils/jwt';
import {
  buildAuthorizationUrl,
  createOAuthToken,
  exchangeAuthorizationCode,
  getClientRedirect,
  getOAuthConfiguration,
  getOAuthConfigurationIssue,
  hashOAuthValue,
  identityTokenHasVerifiedEmail,
  OAuthServiceError,
  OidcClaims,
} from '../services/oauth';

const providerField: Record<OAuthProvider, 'googleId' | 'appleId'> = {
  google: 'googleId',
  apple: 'appleId',
};
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const maskPhone = (phone: string) => `${phone.slice(0, 3)}••••${phone.slice(-3)}`;
const safeError = (value: string) =>
  ['cancelled', 'mfa_required', 'provider_unavailable', 'invalid_request', 'account_exists',
    'identity_in_use', 'verified_email_required', 'try_again'].includes(value)
    ? value
    : 'try_again';

const knownOAuthFailures = new Set([
  'account_exists',
  'account_unavailable',
  'cancelled',
  'invalid_request',
  'identity_in_use',
  'invalid_email',
  'invalid_return_to',
  'link_email_mismatch',
  'mfa_required',
  'provider_error',
  'provider_already_linked',
  'verified_email_required',
  'Identity token nonce was invalid.',
  'Identity token claims were invalid.',
  'Identity token signing key was not recognized.',
  'Identity provider keys are unavailable.',
  'Invalid provider keys.',
  'Malformed identity token.',
  'Provider did not return an identity token.',
  'Unsupported identity token.',
]);

function logOAuthFailure(provider: OAuthProvider | 'oauth', stage: string, error: unknown) {
  if (error instanceof OAuthServiceError) {
    console.error('[OAuth] Callback step failed.', {
      provider,
      stage,
      reason: error.diagnosticCode,
      ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
    });
    return;
  }

  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    console.error('[OAuth] Callback step failed.', { provider, stage, reason: 'duplicate_key' });
    return;
  }

  if (error instanceof Error && knownOAuthFailures.has(error.message)) {
    console.error('[OAuth] Callback step failed.', {
      provider,
      stage,
      reason: error.message.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
    });
    return;
  }

  const reason = error instanceof Error && error.name === 'AbortError'
    ? 'provider_timeout'
    : error instanceof Error && error.name === 'TypeError'
      ? 'provider_network_error'
      : error instanceof Error && ['MongoError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'MongooseError'].includes(error.name)
        ? 'database_error'
        : 'unexpected_error';
  console.error('[OAuth] Callback step failed.', { provider, stage, reason });
}

function errorRedirect(res: Response, code: string, returnTo?: string, link = false) {
  const destination = getClientRedirect(link && returnTo ? returnTo : '/auth/callback');
  if (!destination) {
    res.status(503).json({ success: false, code: 'OAUTH_UNAVAILABLE', message: 'Sign-in is temporarily unavailable.' });
    return;
  }
  destination.searchParams.set(link ? 'oauth_error' : 'error', safeError(code));
  res.redirect(303, destination.toString());
}

function clearStateCookie(res: Response, provider: OAuthProvider) {
  const sameSite = provider === 'apple' || process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
  const secure = sameSite === 'None' ? '; Secure' : '';
  res.append('Set-Cookie', `wg_oauth_${provider}_state=; Path=/api/auth/oauth; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure}`);
}

function readStateCookie(req: Request, provider: OAuthProvider) {
  const name = `wg_oauth_${provider}_state`;
  const cookies = req.headers.cookie?.split(';') || [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

function stateCookieMatches(cookieValue: string, state: string) {
  const actual = Buffer.from(cookieValue);
  const expected = Buffer.from(state);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const startOAuth = async (req: Request, res: Response): Promise<void> => {
  const provider = req.params.provider as OAuthProvider;
  if (provider !== 'google' && provider !== 'apple') {
    res.status(404).json({ success: false, code: 'OAUTH_PROVIDER_UNAVAILABLE', message: 'This sign-in provider is unavailable.' });
    return;
  }
  const intent = req.query.intent === 'link' ? 'link' : 'login';
  const authRequest = req as AuthRequest;
  const userId = intent === 'link' ? authRequest.user?.userId : undefined;
  const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/dashboard';
  const redirect = getClientRedirect(returnTo);
  const configuration = getOAuthConfiguration(provider);
  if ((intent === 'link' && !userId) || !redirect || !configuration) {
    if (!configuration) {
      console.error(`[OAuth] ${provider} sign-in unavailable: ${getOAuthConfigurationIssue(provider) || 'configuration could not be loaded.'}`);
    }
    res.status(!configuration ? 503 : 400).json({
      success: false,
      code: !configuration ? 'OAUTH_NOT_CONFIGURED' : 'OAUTH_INVALID_REQUEST',
      message: !configuration
        ? `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured on this server.`
        : 'The sign-in request could not be started.',
    });
    return;
  }

  const state = createOAuthToken();
  const nonce = createOAuthToken();
  const codeVerifier = createOAuthToken();
  try {
    await OAuthTransaction.create({
      stateHash: hashOAuthValue(state),
      provider,
      nonce,
      codeVerifier,
      returnTo: redirect.pathname + redirect.search,
      intent,
      ...(userId ? { userId } : {}),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    res.setHeader('Cache-Control', 'no-store');
    const sameSite = provider === 'apple' || process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
    const secure = sameSite === 'None' ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      `wg_oauth_${provider}_state=${encodeURIComponent(state)}; Path=/api/auth/oauth; Max-Age=600; HttpOnly; SameSite=${sameSite}${secure}`,
    );
    const authUrl = buildAuthorizationUrl(provider, configuration, state, nonce, codeVerifier);
    if (intent !== 'link' && req.accepts('html')) {
      res.redirect(303, authUrl);
      return;
    }
    res.json({ success: true, authUrl });
  } catch {
    console.error('[OAuth] Sign-in setup failed.', { provider, stage: 'transaction_creation', reason: 'database_error' });
    res.status(503).json({ success: false, code: 'OAUTH_UNAVAILABLE', message: 'Sign-in could not be started. Please try again.' });
  }
};

async function useExistingSocialUser(user: IUser | null, field: 'googleId' | 'appleId', subject: string): Promise<IUser> {
  if (!user || !user.isActive || user.isDeleted || !user.isVerified) throw new Error('account_unavailable');
  if (user.isSuperAdmin || user.mfaEnabled) throw new Error('mfa_required');

  const currentIdentity = user.get(field) as string | undefined;
  if (currentIdentity && currentIdentity !== subject) throw new Error('identity_in_use');
  if (!currentIdentity) {
    user.set(field, subject);
    await user.save();
  }
  return user;
}

async function findOrCreateSocialUser(
  provider: OAuthProvider,
  claims: OidcClaims,
) {
  const field = providerField[provider];
  const existing = await User.findOne({ [field]: claims.sub });
  if (existing) return useExistingSocialUser(existing, field, claims.sub);

  if (!claims.email || !identityTokenHasVerifiedEmail(claims)) throw new Error('verified_email_required');
  const email = claims.email.trim().toLowerCase();
  if (!validEmail(email) || email.length > 254) throw new Error('invalid_email');
  const emailUser = await User.findOne({ email });
  if (emailUser) {
    const providerOwner = await User.findOne({ [field]: claims.sub });
    if (providerOwner && providerOwner._id.toString() !== emailUser._id.toString()) {
      throw new Error('identity_in_use');
    }
    return useExistingSocialUser(emailUser, field, claims.sub);
  }

  const now = new Date();
  const fullName = (claims.name || email.split('@')[0] || 'WorkGrind user')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'WorkGrind user';
  try {
    const user = await createWorkGrindUser({
      fullName,
      email,
      [field]: claims.sub,
      ...(provider === 'google' && claims.picture ? { avatar: claims.picture.slice(0, 2048) } : {}),
      isVerified: true,
      isActive: true,
      isDeleted: false,
      isSuperAdmin: false,
      role: 'owner',
      accountType: 'individual',
      phoneVerified: false,
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'free',
      trialStartDate: now,
      trialEndDate: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    });
    void sendWelcomeEmail(user.email, user.fullName).then((result) => {
      if (!result.success) console.error('[Auth] Welcome email delivery failed.');
    });
    return user;
  } catch (error: any) {
    // A parallel first sign-in may have won the unique email/provider index race.
    if (error?.code === 11000) {
      const racedUser = await User.findOne({ [field]: claims.sub });
      if (racedUser) return useExistingSocialUser(racedUser, field, claims.sub);
      const racedEmailUser = await User.findOne({ email });
      if (racedEmailUser) return useExistingSocialUser(racedEmailUser, field, claims.sub);
    }
    throw error;
  }
}

async function finishLink(provider: OAuthProvider, transactionUserId: string, claims: OidcClaims) {
  const field = providerField[provider];
  const user = await User.findById(transactionUserId);
  if (!user || !user.isActive || user.isDeleted || !user.isVerified) throw new Error('account_unavailable');
  if (claims.email && (!identityTokenHasVerifiedEmail(claims) ||
      claims.email.trim().toLowerCase() !== user.email.toLowerCase())) {
    throw new Error('link_email_mismatch');
  }
  if (!claims.email && provider === 'google') throw new Error('verified_email_required');
  const existing = await User.findOne({ [field]: claims.sub });
  if (existing && existing._id.toString() !== user._id.toString()) throw new Error('identity_in_use');
  const currentIdentity = user.get(field) as string | undefined;
  if (currentIdentity && currentIdentity !== claims.sub) throw new Error('provider_already_linked');
  user.set(field, claims.sub);
  await user.save();
}

export const completeOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const provider = req.params.provider as OAuthProvider;
  if (provider !== 'google' && provider !== 'apple') {
    res.status(404).json({ success: false, message: 'Not found.' });
    return;
  }
  clearStateCookie(res, provider);
  const state = typeof req.query.state === 'string' ? req.query.state :
    typeof req.body?.state === 'string' ? req.body.state : '';
  const browserState = readStateCookie(req, provider);
  if (!state || state.length > 256 || !stateCookieMatches(browserState, state)) {
    logOAuthFailure(provider, 'state_validation', new Error('invalid_request'));
    errorRedirect(res, 'invalid_request');
    return;
  }
  let transaction: IOAuthTransaction | null;
  try {
    transaction = await OAuthTransaction.findOneAndDelete({
      stateHash: hashOAuthValue(state),
      provider,
      expiresAt: { $gt: new Date() },
    });
  } catch (error) {
    logOAuthFailure(provider, 'transaction_lookup', error);
    errorRedirect(res, 'try_again');
    return;
  }
  if (!transaction) {
    logOAuthFailure(provider, 'transaction_lookup', new Error('invalid_request'));
    errorRedirect(res, 'invalid_request');
    return;
  }
  const providerError = typeof req.query.error === 'string' ? req.query.error :
    typeof req.body?.error === 'string' ? req.body.error : '';
  if (providerError) {
    logOAuthFailure(provider, 'provider_callback', new Error(providerError === 'access_denied' ? 'cancelled' : 'provider_error'));
    errorRedirect(res, providerError === 'access_denied' ? 'cancelled' : 'try_again', transaction.returnTo, transaction.intent === 'link');
    return;
  }
  const code = typeof req.query.code === 'string' ? req.query.code :
    typeof req.body?.code === 'string' ? req.body.code : '';
  const configuration = getOAuthConfiguration(provider);
  if (!configuration || !code || code.length > 4096) {
    logOAuthFailure(provider, 'callback_configuration_or_code', new Error('invalid_request'));
    errorRedirect(res, 'provider_unavailable', transaction.returnTo, transaction.intent === 'link');
    return;
  }
  let stage = 'authorization_code_exchange_and_id_token_validation';
  try {
    const { claims } = await exchangeAuthorizationCode(
      provider,
      configuration,
      code,
      transaction.codeVerifier,
      transaction.nonce,
    );
    if (transaction.intent === 'link') {
      await finishLink(provider, transaction.userId?.toString() || '', claims);
      const destination = getClientRedirect(transaction.returnTo);
      if (!destination) throw new Error('invalid_return_to');
      destination.searchParams.set('oauth', 'linked');
      res.redirect(303, destination.toString());
      return;
    }

    stage = 'user_lookup_or_creation';
    const user = await findOrCreateSocialUser(provider, claims);
    const exchangeCode = createOAuthToken();
    stage = 'exchange_code_persistence';
    await OAuthExchange.create({
      codeHash: hashOAuthValue(exchangeCode),
      userId: user._id,
      returnTo: transaction.returnTo,
      expiresAt: new Date(Date.now() + 2 * 60_000),
    });
    const destination = getClientRedirect('/auth/callback');
    if (!destination) throw new Error('invalid_return_to');
    destination.searchParams.set('code', exchangeCode);
    res.redirect(303, destination.toString());
  } catch (error: any) {
    logOAuthFailure(provider, stage, error);
    const destination = transaction.intent === 'link'
      ? transaction.returnTo
      : undefined;
    const errorCode = error?.message === 'account_exists'
      ? 'account_exists'
      : error?.message === 'mfa_required' ? 'mfa_required'
      : error?.message === 'identity_in_use' ? 'identity_in_use'
      : error?.message === 'verified_email_required' ? 'verified_email_required'
      : error?.message === 'cancelled' ? 'cancelled' : 'try_again';
    errorRedirect(res, errorCode, destination, transaction.intent === 'link');
  }
};

export const exchangeOAuthSession = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (code.length < 32 || code.length > 128) {
    logOAuthFailure('oauth', 'exchange_code_validation', new Error('invalid_request'));
    res.status(400).json({ success: false, code: 'OAUTH_CODE_INVALID', message: 'This sign-in link is invalid or expired. Please try again.' });
    return;
  }
  let exchange: IOAuthExchange | null;
  try {
    exchange = await OAuthExchange.findOneAndDelete({
      codeHash: hashOAuthValue(code),
      expiresAt: { $gt: new Date() },
    });
  } catch (error) {
    logOAuthFailure('oauth', 'exchange_code_lookup', error);
    res.status(503).json({ success: false, code: 'OAUTH_UNAVAILABLE', message: 'Sign-in could not be completed. Please try again.' });
    return;
  }
  if (!exchange) {
    logOAuthFailure('oauth', 'exchange_code_lookup', new Error('invalid_request'));
    res.status(400).json({ success: false, code: 'OAUTH_CODE_INVALID', message: 'This sign-in link is invalid or expired. Please try again.' });
    return;
  }
  let stage = 'user_lookup';
  try {
    const user = await User.findById(exchange.userId);
    if (!user || !user.isActive || user.isDeleted || !user.isVerified || user.isSuperAdmin || user.mfaEnabled) {
      logOAuthFailure('oauth', stage, new Error('account_unavailable'));
      res.status(403).json({ success: false, code: 'OAUTH_ACCOUNT_UNAVAILABLE', message: 'This account cannot sign in right now.' });
      return;
    }
    if (!user.phone || !user.phoneVerified) {
      res.json({
        success: true,
        phoneRequired: true,
        phoneVerificationToken: generatePhoneVerificationToken(
          user._id.toString(),
          user.companyId?.toString() || '',
          user.role,
        ),
        phoneExists: Boolean(user.phone),
        ...(user.phone ? { phone: maskPhone(user.phone) } : {}),
        returnTo: exchange.returnTo,
      });
      return;
    }
    stage = 'workgrind_session_creation';
    const session = await sessionForUser(user);
    res.json({
      success: true,
      ...session,
      phoneRequired: false,
      returnTo: exchange.returnTo,
    });
  } catch (error) {
    logOAuthFailure('oauth', stage, error);
    res.status(500).json({ success: false, code: 'OAUTH_SESSION_FAILED', message: 'Sign-in could not be completed. Please try again.' });
  }
};
