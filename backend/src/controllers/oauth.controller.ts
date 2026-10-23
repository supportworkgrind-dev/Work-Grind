import { Request, Response } from 'express';
import { randomUUID, timingSafeEqual } from 'crypto';
import User, { IUser } from '../models/User';
import Company from '../models/Company';
import OAuthTransaction, { IOAuthTransaction, OAuthProvider } from '../models/OAuthTransaction';
import OAuthExchange, { IOAuthExchange } from '../models/OAuthExchange';
import { ClientUser } from '../models/ClientPortal';
import { AuthRequest } from '../middleware/auth';
import { createWorkGrindUser } from '../services/callingId';
import { TRIAL_DAYS } from '../config/subscription';
import { isOrganizationType, roleMatches } from '../config/organization';
import { isOrganizationFeatureAllowed } from '../middleware/organizationAccess';
import { sendWelcomeEmail } from '../utils/email';
import { restoreWorkspaceCreatorRole, sessionForUser } from './auth.controller';
import { setRefreshCookie } from '../utils/authCookie';
import { generateUserMfaChallengeToken } from '../utils/jwt';
import { recordSecurityEvent } from '../services/securityEvents';
import { issueClientToken } from '../utils/clientPortalAuth';
import AuditLog from '../models/AuditLog';
import Integration, { IIntegration } from '../models/Integration';
import { encryptProviderToken } from '../utils/providerTokenEncryption';
import { LINKEDIN_PUBLISHING_SCOPE } from '../services/linkedinPublishing';
import { YOUTUBE_PUBLISHING_SCOPES } from '../config/youtube';
import { fetchYouTubeChannel, YouTubeApiError } from '../services/youtubePublishing';
import {
  buildAuthorizationUrl,
  createOAuthToken,
  exchangeAuthorizationCode,
  getClientRedirect,
  getOAuthConfiguration,
  getOAuthConfigurationIssue,
  hashOAuthValue,
  identityTokenHasVerifiedEmail,
  introspectLinkedInAccessToken,
  isOAuthProductionEnvironment,
  OAuthServiceError,
  OidcClaims,
} from '../services/oauth';

const providerField: Record<OAuthProvider, 'googleId' | 'appleId' | 'linkedinId'> = {
  google: 'googleId',
  apple: 'appleId',
  linkedin: 'linkedinId',
};
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isOAuthProvider = (provider: string): provider is OAuthProvider =>
  provider === 'google' || provider === 'apple' || provider === 'linkedin';

function providerPicture(provider: OAuthProvider, picture?: string): string | undefined {
  if (!picture || picture.length > 2048) return undefined;
  try {
    const url = new URL(picture);
    const host = url.hostname.toLowerCase();
    const allowed = provider === 'google'
      ? host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')
      : provider === 'linkedin'
        ? host === 'licdn.com' || host.endsWith('.licdn.com')
        : false;
    return url.protocol === 'https:' && allowed && !url.username && !url.password &&
      !url.port ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
const safeError = (value: string) =>
  ['cancelled', 'mfa_required', 'provider_unavailable', 'authorization_failed', 'invalid_request', 'attempt_expired', 'account_exists', 'signup_required',
    'identity_in_use', 'link_email_mismatch', 'verified_email_required', 'client_invitation_required', 'publishing_permission_denied',
    'provider_already_linked', 'youtube_channel_required', 'publishing_scope_not_approved', 'provider_credentials_rejected',
    'try_again'].includes(value)
    ? value
    : 'try_again';

function canManageSocialConnection(user: {
  role: string;
  accountType?: 'company' | 'individual';
  organizationType?: string;
}): boolean {
  // Publishing connections exist only where Social Publishing does (Business and
  // Solo workspaces); the role checks below decide who may manage them there.
  if (!isOrganizationType(user.organizationType) || !user.accountType ||
      !isOrganizationFeatureAllowed(
        { organizationType: user.organizationType, accountType: user.accountType },
        user.role,
        'socialPublishing',
      )) {
    return false;
  }
  if (user.accountType === 'individual') {
    return roleMatches(user.role, ['owner'], user.organizationType);
  }
  return roleMatches(user.role, ['owner', 'admin', 'manager'], user.organizationType);
}

const knownOAuthFailures = new Set([
  'account_exists',
  'client_invitation_required',
  'signup_required',
  'account_unavailable',
  'cancelled',
  'invalid_request',
  'identity_in_use',
  'invalid_email',
  'invalid_return_to',
  'link_email_mismatch',
  'mfa_required',
  'provider_error',
  'attempt_expired',
  'provider_already_linked',
  'verified_email_required',
  'publishing_permission_denied',
  'youtube_channel_required',
  'provider_already_linked',
  'missing_state',
  'invalid_state_format',
  'missing_state_cookie',
  'state_cookie_mismatch',
  'Identity token nonce was invalid.',
  'Identity token claims were invalid.',
  'Identity token signing key was not recognized.',
  'Identity provider keys are unavailable.',
  'Invalid provider keys.',
  'Malformed identity token.',
  'Provider did not return an identity token.',
  'Unsupported identity token.',
]);

function logOAuthFailure(provider: OAuthProvider | 'oauth', stage: string, error: unknown, correlationId: string) {
  if (error instanceof OAuthServiceError) {
    console.error('[OAuth] Callback step failed.', {
      provider,
      stage,
      reason: error.diagnosticCode,
      ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
      ...(error.providerErrorCode ? { providerErrorCode: error.providerErrorCode } : {}),
      correlationId,
    });
    return;
  }

  if (error instanceof YouTubeApiError) {
    console.error('[OAuth] Callback step failed.', {
      provider,
      stage,
      reason: 'youtube_api_rejected',
      httpStatus: error.status,
      ...(error.reason ? { providerErrorCode: error.reason } : {}),
      correlationId,
    });
    return;
  }

  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    console.error('[OAuth] Callback step failed.', { provider, stage, reason: 'duplicate_key', correlationId });
    return;
  }

  if (error instanceof Error && (
    knownOAuthFailures.has(error.message) ||
    /^provider_error_[a-zA-Z0-9_.-]{1,80}$/.test(error.message)
  )) {
    console.error('[OAuth] Callback step failed.', {
      provider,
      stage,
      reason: error.message.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
      correlationId,
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
  console.error('[OAuth] Callback step failed.', { provider, stage, reason, correlationId });
}

function errorRedirect(
  res: Response,
  code: string,
  returnTo?: string,
  link = false,
  audience: 'user' | 'client' = 'user',
  signup = false,
  correlationId?: string,
) {
  const fallback = audience === 'client' ? '/client-portal/oauth/callback' : '/auth/callback';
  const destination = getClientRedirect((link || signup) && returnTo ? returnTo : fallback);
  if (!destination) {
    res.status(503).json({ success: false, code: 'OAUTH_UNAVAILABLE', message: 'Sign-in is temporarily unavailable.' });
    return;
  }
  destination.searchParams.set(link || signup ? 'oauth_error' : 'error', safeError(code));
  if (correlationId) destination.searchParams.set('supportId', correlationId);
  res.redirect(303, destination.toString());
}

function stateCookieName(provider: OAuthProvider, state: string) {
  return `wg_oauth_${provider}_state_${state}`;
}

function clearStateCookie(res: Response, provider: OAuthProvider, state: string, legacy = false) {
  const sameSite = provider === 'apple' || isOAuthProductionEnvironment() ? 'None' : 'Lax';
  const secure = sameSite === 'None' ? '; Secure' : '';
  const cookieNames = [stateCookieName(provider, state)];
  if (legacy) cookieNames.push(`wg_oauth_${provider}_state`);
  for (const name of cookieNames) {
    res.append('Set-Cookie', `${name}=; Path=/api/auth/oauth; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure}`);
  }
}

function readStateCookie(req: Request, provider: OAuthProvider, state: string): { value: string; legacy: boolean } {
  const names = [
    { name: stateCookieName(provider, state), legacy: false },
    { name: `wg_oauth_${provider}_state`, legacy: true },
  ];
  const cookies = req.headers.cookie?.split(';') || [];
  for (const expected of names) {
    for (const cookie of cookies) {
      const separator = cookie.indexOf('=');
      if (separator < 0 || cookie.slice(0, separator).trim() !== expected.name) continue;
      try {
        return { value: decodeURIComponent(cookie.slice(separator + 1).trim()), legacy: expected.legacy };
      } catch {
        return { value: '', legacy: expected.legacy };
      }
    }
  }
  return { value: '', legacy: false };
}

function stateCookieMatches(cookieValue: string, state: string) {
  const actual = Buffer.from(cookieValue);
  const expected = Buffer.from(state);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function correlationIdForState(
  provider: OAuthProvider,
  state: string,
  fallback: string,
): Promise<string> {
  try {
    const transaction = await OAuthTransaction.findOne(
      {
        stateHash: hashOAuthValue(state),
        provider,
        expiresAt: { $gt: new Date() },
      },
      { correlationId: 1 },
    );
    return transaction?.correlationId || fallback;
  } catch (error) {
    logOAuthFailure(provider, 'state_transaction_correlation_lookup', error, fallback);
    return fallback;
  }
}

export const startOAuth = async (req: Request, res: Response): Promise<void> => {
  const provider = req.params.provider as OAuthProvider;
  if (!isOAuthProvider(provider)) {
    res.status(404).json({ success: false, code: 'OAUTH_PROVIDER_UNAVAILABLE', message: 'This sign-in provider is unavailable.' });
    return;
  }
  const requestedIntent = req.query.intent;
  const intent = requestedIntent === 'link'
    ? 'link'
    : requestedIntent === 'signup'
      ? 'signup'
      : requestedIntent === 'publishing'
        ? 'publishing'
        : 'login';
  if (req.query.audience !== undefined &&
      req.query.audience !== 'user' && req.query.audience !== 'client') {
    res.status(400).json({ success: false, code: 'OAUTH_INVALID_REQUEST', message: 'The sign-in request could not be started.' });
    return;
  }
  const audience = req.query.audience === 'client' ? 'client' : 'user';
  const authRequest = req as AuthRequest;
  const userId = intent === 'link' || intent === 'publishing' ? authRequest.user?.userId : undefined;
  const clientUserId = intent === 'link'
    ? (req as Request & { client?: { clientUserId: string } }).client?.clientUserId
    : undefined;
  const requestedAccountType = typeof req.query.accountType === 'string' ? req.query.accountType : '';
  const requestedOrganizationType = typeof req.query.organizationType === 'string' ? req.query.organizationType : '';
  if ((audience === 'client' && (intent === 'signup' || intent === 'publishing')) ||
      (intent === 'publishing' && (
        (provider !== 'linkedin' && provider !== 'google') ||
        !userId ||
        audience !== 'user' ||
        !authRequest.user?.companyId ||
        !canManageSocialConnection(authRequest.user)
      )) ||
      (audience === 'user' && intent === 'link' && !userId) ||
      (audience === 'client' && intent === 'link' && !clientUserId) ||
      (intent === 'signup' &&
      (!['company', 'individual'].includes(requestedAccountType) ||
        !isOrganizationType(requestedOrganizationType) ||
        (requestedAccountType === 'individual' && requestedOrganizationType !== 'business')))) {
    res.status(400).json({
      success: false,
      code: 'OAUTH_INVALID_REQUEST',
      message: 'Choose a valid account type before continuing with provider sign-in.',
    });
    return;
  }
  const defaultReturnTo = audience === 'client'
    ? intent === 'link' ? '/client-portal/portal' : '/client-portal/oauth/callback'
    : '/dashboard';
  const returnTo = intent === 'signup'
    ? '/create-company'
    : typeof req.query.returnTo === 'string' ? req.query.returnTo : defaultReturnTo;
  const redirect = getClientRedirect(returnTo);
  // Google publishing consent connects YouTube; tag the return URL so success and
  // error redirects identify the destination being connected.
  if (redirect && intent === 'publishing' && provider === 'google') {
    redirect.searchParams.set('oauth_provider', 'youtube');
  }
  const configuration = getOAuthConfiguration(provider);
  if ((audience === 'user' && intent === 'link' && !userId) ||
      (audience === 'client' && intent === 'link' && !clientUserId) ||
      !redirect || !configuration) {
    if (!configuration) {
      console.error(`[OAuth] ${provider} sign-in unavailable: ${getOAuthConfigurationIssue(provider) || 'configuration could not be loaded.'}`);
    }
    res.status(!configuration ? 503 : 400).json({
      success: false,
      code: !configuration ? 'OAUTH_NOT_CONFIGURED' : 'OAUTH_INVALID_REQUEST',
      message: !configuration
        ? `${provider === 'google' ? 'Google' : provider === 'linkedin' ? 'LinkedIn' : 'Apple'} sign-in is not configured on this server.`
        : 'The sign-in request could not be started.',
    });
    return;
  }

  const state = createOAuthToken();
  const nonce = createOAuthToken();
  const codeVerifier = createOAuthToken();
  const correlationId = randomUUID();
  try {
    await OAuthTransaction.create({
      correlationId,
      stateHash: hashOAuthValue(state),
      provider,
      audience,
      nonce,
      codeVerifier,
      returnTo: redirect.pathname + redirect.search,
      intent,
      ...(intent === 'signup' ? {
        accountType: requestedAccountType as 'company' | 'individual',
        organizationType: requestedOrganizationType,
      } : {}),
      ...(userId ? { userId } : {}),
      ...(clientUserId ? { clientUserId } : {}),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    res.setHeader('Cache-Control', 'no-store');
    const sameSite = provider === 'apple' || isOAuthProductionEnvironment() ? 'None' : 'Lax';
    const secure = sameSite === 'None' ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      `${stateCookieName(provider, state)}=${encodeURIComponent(state)}; Path=/api/auth/oauth; Max-Age=600; HttpOnly; SameSite=${sameSite}${secure}`,
    );
    const authUrl = buildAuthorizationUrl(
      provider,
      configuration,
      state,
      nonce,
      codeVerifier,
      intent === 'publishing',
    );
    if (intent !== 'link' && req.accepts('html')) {
      res.redirect(303, authUrl);
      return;
    }
    res.json({ success: true, authUrl });
  } catch {
    console.error('[OAuth] Sign-in setup failed.', { provider, stage: 'transaction_creation', reason: 'database_error', correlationId });
    res.status(503).json({ success: false, code: 'OAUTH_UNAVAILABLE', message: 'Sign-in could not be started. Please try again.' });
  }
};

async function useExistingSocialUser(user: IUser | null, field: 'googleId' | 'appleId' | 'linkedinId', subject: string): Promise<IUser> {
  if (!user || !user.isActive || user.isDeleted || !user.isVerified) throw new Error('account_unavailable');
  // Super admins sign in through the Admin Portal. Members with MFA continue to
  // the session exchange, which asks for their authenticator code first.
  if (user.isSuperAdmin) throw new Error('mfa_required');

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
  signup?: { accountType?: 'company' | 'individual'; organizationType?: string },
) {
  const field = providerField[provider];
  const existing = await User.findOne({ [field]: claims.sub });
  if (existing) return useExistingSocialUser(existing, field, claims.sub);

  if (!claims.email || !identityTokenHasVerifiedEmail(claims)) throw new Error('verified_email_required');
  const email = claims.email.trim().toLowerCase();
  if (!validEmail(email) || email.length > 254) throw new Error('invalid_email');
  const emailUser = await User.findOne({ email });
  if (emailUser) {
    throw new Error('account_exists');
  }

  if (!signup?.accountType || !isOrganizationType(signup.organizationType) ||
      (signup.accountType === 'individual' && signup.organizationType !== 'business')) {
    throw new Error('signup_required');
  }

  const now = new Date();
  const fullName = (claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
    email.split('@')[0] || 'WorkGrind user')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'WorkGrind user';
  try {
    const user = await createWorkGrindUser({
      fullName,
      ...(claims.given_name ? { givenName: claims.given_name.slice(0, 100) } : {}),
      ...(claims.family_name ? { familyName: claims.family_name.slice(0, 100) } : {}),
      email,
      [field]: claims.sub,
      ...(providerPicture(provider, claims.picture) ? { avatar: providerPicture(provider, claims.picture) } : {}),
      isVerified: true,
      isActive: true,
      isDeleted: false,
      isSuperAdmin: false,
      role: 'owner',
      accountType: signup.accountType,
      signupOrganizationType: signup.organizationType,
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'free',
      trialStartDate: now,
      trialEndDate: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    });
    void sendWelcomeEmail(user.email, user.fullName)
      .then((result) => {
        if (!result.success) console.error('[Auth] Welcome email delivery failed.');
      })
      .catch((error) => console.error('[Auth] Welcome email delivery failed.', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }));
    return user;
  } catch (error: any) {
    // A parallel first sign-in may have won the unique email/provider index race.
    if (error?.code === 11000) {
      const racedUser = await User.findOne({ [field]: claims.sub });
      if (racedUser) return useExistingSocialUser(racedUser, field, claims.sub);
      const racedEmailUser = await User.findOne({ email });
      if (racedEmailUser) throw new Error('account_exists');
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
  if (!claims.email && provider !== 'apple') throw new Error('verified_email_required');
  const existing = await User.findOne({ [field]: claims.sub });
  if (existing && existing._id.toString() !== user._id.toString()) throw new Error('identity_in_use');
  const currentIdentity = user.get(field) as string | undefined;
  if (currentIdentity && currentIdentity !== claims.sub) throw new Error('provider_already_linked');
  user.set(field, claims.sub);
  if (!user.avatar) user.avatar = providerPicture(provider, claims.picture);
  if (!user.givenName && claims.given_name) user.givenName = claims.given_name.slice(0, 100);
  if (!user.familyName && claims.family_name) user.familyName = claims.family_name.slice(0, 100);
  await user.save();
}

async function findClientForOAuth(provider: OAuthProvider, claims: OidcClaims) {
  const field = providerField[provider];
  const client = await ClientUser.findOne({ [field]: claims.sub });
  if (client) {
    if (!client.isActive || !client.isVerified) throw new Error('account_unavailable');
    return client;
  }
  if (!claims.email || !identityTokenHasVerifiedEmail(claims)) {
    throw new Error('verified_email_required');
  }
  const email = claims.email.trim().toLowerCase();
  if (!validEmail(email) || email.length > 254) throw new Error('invalid_email');
  if (await ClientUser.exists({ email })) throw new Error('account_exists');
  throw new Error('client_invitation_required');
}

async function finishClientLink(provider: OAuthProvider, clientUserId: string, claims: OidcClaims) {
  const field = providerField[provider];
  const client = await ClientUser.findById(clientUserId);
  if (!client || !client.isActive || !client.isVerified) throw new Error('account_unavailable');
  if (claims.email && (!identityTokenHasVerifiedEmail(claims) ||
      claims.email.trim().toLowerCase() !== client.email.toLowerCase())) {
    throw new Error('link_email_mismatch');
  }
  if (!claims.email && provider !== 'apple') throw new Error('verified_email_required');
  const existing = await ClientUser.findOne({ [field]: claims.sub });
  if (existing && existing._id.toString() !== client._id.toString()) throw new Error('identity_in_use');
  const currentIdentity = client.get(field) as string | undefined;
  if (currentIdentity && currentIdentity !== claims.sub) throw new Error('provider_already_linked');
  client.set(field, claims.sub);
  if (!client.avatar) client.avatar = providerPicture(provider, claims.picture);
  await client.save();
}

async function finishLinkedInPublishingConnection(
  transactionUserId: string,
  claims: OidcClaims,
  accessToken: string | undefined,
  scopes: string[],
  expiresAt: Date,
): Promise<IIntegration> {
  if (!accessToken || accessToken.length > 16_384 ||
      !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() ||
      !scopes.includes(LINKEDIN_PUBLISHING_SCOPE)) {
    // Scope names only; LinkedIn may grant sign-in scopes without member posting.
    console.error('[OAuth] LinkedIn did not grant the member-posting scope.', {
      requiredScope: LINKEDIN_PUBLISHING_SCOPE,
      grantedScopes: scopes.filter((scope) => /^[a-z_]{1,64}$/.test(scope)),
      tokenExpiryValid: Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now(),
    });
    throw new Error('publishing_permission_denied');
  }
  const user = await User.findById(transactionUserId);
  if (!user || !user.isActive || user.isDeleted || !user.isVerified ||
      !user.companyId) {
    throw new Error('account_unavailable');
  }
  const company = await Company.findOne({
    _id: user.companyId,
    isActive: true,
  }).select('_id accountType organizationType');
  if (!company || !canManageSocialConnection({
    role: user.role,
    accountType: company.accountType,
    organizationType: company.organizationType,
  })) throw new Error('account_unavailable');

  const existingConnection = await Integration.findOne({
    companyId: company._id,
    provider: 'linkedin',
  }).select('status config');
  if (existingConnection?.status === 'connected' &&
      existingConnection.config?.linkedinSubject !== claims.sub) {
    throw new Error('provider_already_linked');
  }

  const connection = await Integration.findOneAndUpdate(
    { companyId: company._id, provider: 'linkedin' },
    {
      $set: {
        createdBy: user._id,
        status: 'connected',
        accessToken: encryptProviderToken(accessToken),
        tokenExpiresAt: expiresAt,
        config: {
          linkedinSubject: claims.sub,
          identityName: (claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
            claims.email || 'LinkedIn member').trim().slice(0, 200),
          ...(claims.email ? { identityEmail: claims.email.trim().toLowerCase().slice(0, 254) } : {}),
          grantedScopes: scopes,
        },
        errorMessage: null,
      },
      $unset: { refreshToken: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, select: '-accessToken -refreshToken' },
  );
  if (!connection) throw new Error('provider_connection_failed');
  return connection;
}

async function finishYouTubePublishingConnection(
  transactionUserId: string,
  claims: OidcClaims,
  tokens: { accessToken?: string; refreshToken?: string; scopes: string[]; expiresIn?: number },
): Promise<IIntegration> {
  // Google's granular consent lets members untick scopes; both are required.
  if (!tokens.accessToken || tokens.accessToken.length > 16_384 ||
      !tokens.refreshToken || tokens.refreshToken.length > 16_384 ||
      !YOUTUBE_PUBLISHING_SCOPES.every((scope) => tokens.scopes.includes(scope))) {
    throw new Error('publishing_permission_denied');
  }
  const user = await User.findById(transactionUserId);
  if (!user || !user.isActive || user.isDeleted || !user.isVerified || !user.companyId) {
    throw new Error('account_unavailable');
  }
  const company = await Company.findOne({ _id: user.companyId, isActive: true })
    .select('_id accountType organizationType');
  if (!company || !canManageSocialConnection({
    role: user.role,
    accountType: company.accountType,
    organizationType: company.organizationType,
  })) throw new Error('account_unavailable');

  const channel = await fetchYouTubeChannel(tokens.accessToken);
  const existingConnection = await Integration.findOne({ companyId: company._id, provider: 'youtube' })
    .select('status config');
  if (existingConnection?.status === 'connected' &&
      existingConnection.config?.channelId !== channel.channelId) {
    throw new Error('provider_already_linked');
  }

  const expiresIn = typeof tokens.expiresIn === 'number' && tokens.expiresIn > 0 ? tokens.expiresIn : 3600;
  const connection = await Integration.findOneAndUpdate(
    { companyId: company._id, provider: 'youtube' },
    {
      $set: {
        createdBy: user._id,
        status: 'connected',
        accessToken: encryptProviderToken(tokens.accessToken),
        refreshToken: encryptProviderToken(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        config: {
          googleSubject: claims.sub,
          channelId: channel.channelId,
          identityName: channel.channelTitle,
          ...(claims.email ? { identityEmail: claims.email.trim().toLowerCase().slice(0, 254) } : {}),
          grantedScopes: tokens.scopes.filter((scope) => YOUTUBE_PUBLISHING_SCOPES.includes(scope)),
        },
        errorMessage: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, select: '-accessToken -refreshToken' },
  );
  if (!connection) throw new Error('provider_connection_failed');
  return connection;
}

export const completeOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const provider = req.params.provider as OAuthProvider;
  let correlationId: string = randomUUID();
  if (!isOAuthProvider(provider)) {
    res.status(404).json({ success: false, message: 'Not found.' });
    return;
  }
  const state = typeof req.query.state === 'string' ? req.query.state :
    typeof req.body?.state === 'string' ? req.body.state : '';
  if (!state || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) {
    logOAuthFailure(
      provider,
      'state_validation',
      new Error(state ? 'invalid_state_format' : 'missing_state'),
      correlationId,
    );
    errorRedirect(res, 'invalid_request', undefined, false, 'user', false, correlationId);
    return;
  }
  const stateCookie = readStateCookie(req, provider, state);
  clearStateCookie(res, provider, state, stateCookie.legacy);
  if (!stateCookieMatches(stateCookie.value, state)) {
    correlationId = await correlationIdForState(provider, state, correlationId);
    logOAuthFailure(
      provider,
      'state_cookie_validation',
      new Error(stateCookie.value ? 'state_cookie_mismatch' : 'missing_state_cookie'),
      correlationId,
    );
    errorRedirect(res, 'attempt_expired', undefined, false, 'user', false, correlationId);
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
    logOAuthFailure(provider, 'transaction_lookup', error, correlationId);
    errorRedirect(res, 'try_again', undefined, false, 'user', false, correlationId);
    return;
  }
  if (!transaction) {
    logOAuthFailure(provider, 'transaction_lookup', new Error('attempt_expired'), correlationId);
    errorRedirect(res, 'attempt_expired', undefined, false, 'user', false, correlationId);
    return;
  }
  correlationId = transaction.correlationId || correlationId;
  const providerError = typeof req.query.error === 'string' ? req.query.error :
    typeof req.body?.error === 'string' ? req.body.error : '';
  if (providerError) {
    const safeProviderError = /^[a-zA-Z0-9_.-]{1,80}$/.test(providerError)
      ? providerError
      : 'unrecognized_provider_error';
    logOAuthFailure(
      provider,
      'provider_callback',
      new Error(providerError === 'access_denied' ? 'cancelled' : `provider_error_${safeProviderError}`),
      correlationId,
    );
    const scopeNotApproved = transaction.intent === 'publishing' && providerError === 'unauthorized_scope_error';
    if (scopeNotApproved) {
      console.error('[OAuth] The provider app is not approved for the publishing scope. Add the product that grants it in the provider developer portal.', {
        provider,
        correlationId,
      });
    }
    errorRedirect(
      res,
      providerError === 'access_denied' ? 'cancelled' : scopeNotApproved ? 'publishing_scope_not_approved' : 'authorization_failed',
      signupErrorReturnTo(transaction) ?? transaction.returnTo,
      transaction.intent === 'link' || transaction.intent === 'publishing',
      transaction.audience,
      transaction.intent === 'signup',
      correlationId,
    );
    return;
  }
  const code = typeof req.query.code === 'string' ? req.query.code :
    typeof req.body?.code === 'string' ? req.body.code : '';
  const configuration = getOAuthConfiguration(provider);
  if (!configuration) {
    logOAuthFailure(provider, 'callback_configuration', new Error('provider_unavailable'), correlationId);
    errorRedirect(
      res,
      'provider_unavailable',
      signupErrorReturnTo(transaction) ?? transaction.returnTo,
      transaction.intent === 'link' || transaction.intent === 'publishing',
      transaction.audience,
      transaction.intent === 'signup',
      correlationId,
    );
    return;
  }
  if (!code || code.length > 4096) {
    logOAuthFailure(provider, 'callback_authorization_code', new Error('attempt_expired'), correlationId);
    errorRedirect(
      res,
      'attempt_expired',
      signupErrorReturnTo(transaction) ?? transaction.returnTo,
      transaction.intent === 'link' || transaction.intent === 'publishing',
      transaction.audience,
      transaction.intent === 'signup',
      correlationId,
    );
    return;
  }
  let stage = 'authorization_code_exchange_and_id_token_validation';
  try {
    const { claims, accessToken, refreshToken, scopes, expiresIn } = await exchangeAuthorizationCode(
      provider,
      configuration,
      code,
      transaction.codeVerifier,
      transaction.nonce,
    );
    if (transaction.intent === 'publishing' && transaction.audience === 'user' && provider === 'google') {
      stage = 'youtube_channel_connection';
      const connection = await finishYouTubePublishingConnection(
        transaction.userId?.toString() || '',
        claims,
        { accessToken, refreshToken, scopes, expiresIn },
      );
      await AuditLog.create({
        companyId: connection.companyId,
        userId: connection.createdBy,
        action: 'YOUTUBE_PUBLISHING_CONNECTED',
        resource: 'Integration',
        resourceId: connection._id.toString(),
        details: { grantedScopes: connection.config?.grantedScopes ?? [] },
        ipAddress: req.ip,
      });
      const destination = getClientRedirect(transaction.returnTo);
      if (!destination) throw new Error('invalid_return_to');
      destination.searchParams.set('oauth', 'connected');
      res.redirect(303, destination.toString());
      return;
    }
    if (transaction.intent === 'publishing' && transaction.audience === 'user') {
      stage = 'linkedin_token_introspection';
      if (!accessToken) throw new Error('publishing_permission_denied');
      const tokenInfo = await introspectLinkedInAccessToken(configuration, accessToken);
      const connection = await finishLinkedInPublishingConnection(
        transaction.userId?.toString() || '',
        claims,
        accessToken,
        tokenInfo.scopes,
        tokenInfo.expiresAt,
      );
      await AuditLog.create({
        companyId: connection.companyId,
        userId: connection.createdBy,
        action: 'LINKEDIN_PUBLISHING_CONNECTED',
        resource: 'Integration',
        resourceId: connection._id.toString(),
        details: { grantedScopes: tokenInfo.scopes },
        ipAddress: req.ip,
      });
      const destination = getClientRedirect(transaction.returnTo);
      if (!destination) throw new Error('invalid_return_to');
      destination.searchParams.set('oauth', 'connected');
      res.redirect(303, destination.toString());
      return;
    }
    if (transaction.intent === 'link' && transaction.audience === 'client') {
      await finishClientLink(provider, transaction.clientUserId?.toString() || '', claims);
      const destination = getClientRedirect(transaction.returnTo);
      if (!destination) throw new Error('invalid_return_to');
      destination.searchParams.set('oauth', 'linked');
      res.redirect(303, destination.toString());
      return;
    }
    if (transaction.intent === 'link') {
      await finishLink(provider, transaction.userId?.toString() || '', claims);
      const destination = getClientRedirect(transaction.returnTo);
      if (!destination) throw new Error('invalid_return_to');
      destination.searchParams.set('oauth', 'linked');
      res.redirect(303, destination.toString());
      return;
    }

    if (transaction.audience === 'client') {
      stage = 'client_user_lookup';
      const client = await findClientForOAuth(provider, claims);
      const exchangeCode = createOAuthToken();
      stage = 'exchange_code_persistence';
      await OAuthExchange.create({
        correlationId,
        codeHash: hashOAuthValue(exchangeCode),
        audience: 'client',
        clientUserId: client._id,
        returnTo: '/client-portal/oauth/callback',
        expiresAt: new Date(Date.now() + 2 * 60_000),
      });
      const destination = getClientRedirect('/client-portal/oauth/callback');
      if (!destination) throw new Error('invalid_return_to');
      destination.searchParams.set('code', exchangeCode);
      destination.searchParams.set('attemptId', correlationId);
      res.redirect(303, destination.toString());
      return;
    }

    stage = 'user_lookup_or_creation';
    const user = await findOrCreateSocialUser(provider, claims, {
      accountType: transaction.accountType,
      organizationType: transaction.organizationType,
    });
    const existingCompany = user.companyId
      ? await Company.findById(user.companyId).select('ownerId accountType organizationType')
      : null;
    if (existingCompany) await restoreWorkspaceCreatorRole(user, existingCompany, req.ip);
    const exchangeCode = createOAuthToken();
    stage = 'exchange_code_persistence';
    await OAuthExchange.create({
      correlationId,
      codeHash: hashOAuthValue(exchangeCode),
      userId: user._id,
      returnTo: existingCompany?.organizationType && existingCompany.organizationType !== 'business'
        ? '/academic'
        : user.companyId ? '/dashboard' : transaction.returnTo,
      expiresAt: new Date(Date.now() + 2 * 60_000),
    });
    const destination = getClientRedirect('/auth/callback');
    if (!destination) throw new Error('invalid_return_to');
    destination.searchParams.set('code', exchangeCode);
    destination.searchParams.set('attemptId', correlationId);
    res.redirect(303, destination.toString());
  } catch (error: any) {
    logOAuthFailure(provider, stage, error, correlationId);
    const destination = transaction.intent === 'link' || transaction.intent === 'publishing'
      ? transaction.returnTo
      : transaction.audience === 'client' ? '/client-portal/oauth/callback' : undefined;
    // A token endpoint that rejects WorkGrind's client credentials is a server
    // configuration fault (e.g. a stale client secret); retrying cannot help.
    const clientCredentialsRejected = error instanceof OAuthServiceError &&
      error.diagnosticCode === 'token_endpoint_rejected' &&
      (error.providerErrorCode === 'invalid_client' || error.providerErrorCode === 'unauthorized_client');
    if (clientCredentialsRejected) {
      console.error('[OAuth] Provider rejected the configured client credentials. Verify the client ID and secret in the deployment environment.', {
        provider,
        correlationId,
      });
    }
    const errorCode = clientCredentialsRejected
      ? transaction.intent === 'publishing' ? 'provider_credentials_rejected' : 'provider_unavailable'
      : error?.message === 'account_exists'
      ? 'account_exists'
      : error?.message === 'client_invitation_required' ? 'client_invitation_required'
      : error?.message === 'signup_required' ? 'signup_required'
      : error?.message === 'mfa_required' ? 'mfa_required'
      : error?.message === 'identity_in_use' ? 'identity_in_use'
      : error?.message === 'link_email_mismatch' ? 'link_email_mismatch'
      : error?.message === 'verified_email_required' ? 'verified_email_required'
      : error?.message === 'publishing_permission_denied' ? 'publishing_permission_denied'
      : error?.message === 'provider_already_linked' ? 'provider_already_linked'
      : error?.message === 'youtube_channel_required' ? 'youtube_channel_required'
      : error?.message === 'cancelled' ? 'cancelled' : 'try_again';
    errorRedirect(
      res,
      errorCode,
      signupErrorReturnTo(transaction) ?? destination,
      transaction.intent === 'link' || transaction.intent === 'publishing',
      transaction.audience,
      transaction.intent === 'signup',
      correlationId,
    );
  }
};

function signupErrorReturnTo(transaction: IOAuthTransaction): string | undefined {
  if (transaction.intent !== 'signup' || transaction.audience !== 'user') return undefined;
  const workspace = transaction.accountType === 'individual'
    ? 'solo'
    : transaction.organizationType;
  if (!workspace) return undefined;
  return `/signup?workspace=${encodeURIComponent(workspace)}&step=details`;
}

export const exchangeOAuthSession = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const requestedAttemptId = typeof req.body?.attemptId === 'string' ? req.body.attemptId : '';
  const hasValidAttemptId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedAttemptId);
  let correlationId: string = hasValidAttemptId
    ? requestedAttemptId
    : randomUUID();
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (requestedAttemptId && !hasValidAttemptId) {
    logOAuthFailure('oauth', 'exchange_attempt_validation', new Error('invalid_request'), correlationId);
    res.status(400).json({ success: false, code: 'OAUTH_CODE_INVALID', message: 'This sign-in link is invalid or expired. Please try again.' });
    return;
  }
  if (code.length < 32 || code.length > 128) {
    logOAuthFailure('oauth', 'exchange_code_validation', new Error('invalid_request'), correlationId);
    res.status(400).json({ success: false, code: 'OAUTH_CODE_INVALID', message: 'This sign-in link is invalid or expired. Please try again.' });
    return;
  }
  let exchange: IOAuthExchange | null;
  try {
    exchange = await OAuthExchange.findOneAndDelete({
      codeHash: hashOAuthValue(code),
      ...(hasValidAttemptId ? { correlationId: requestedAttemptId } : {}),
      expiresAt: { $gt: new Date() },
    });
  } catch (error) {
    logOAuthFailure('oauth', 'exchange_code_lookup', error, correlationId);
    res.status(503).json({ success: false, code: 'OAUTH_UNAVAILABLE', message: 'Sign-in could not be completed. Please try again.' });
    return;
  }
  if (!exchange) {
    logOAuthFailure('oauth', 'exchange_code_lookup', new Error('invalid_request'), correlationId);
    res.status(400).json({ success: false, code: 'OAUTH_CODE_INVALID', message: 'This sign-in link is invalid or expired. Please try again.' });
    return;
  }
  correlationId = exchange.correlationId || correlationId;
  let stage = 'user_lookup';
  try {
    if (exchange.audience === 'client') {
      const client = exchange.clientUserId
        ? await ClientUser.findById(exchange.clientUserId)
        : null;
      if (!client || !client.isActive || !client.isVerified) {
        logOAuthFailure('oauth', stage, new Error('account_unavailable'), correlationId);
        res.status(403).json({ success: false, code: 'OAUTH_ACCOUNT_UNAVAILABLE', message: 'This client portal account cannot sign in right now.' });
        return;
      }
      const accessToken = issueClientToken(client._id.toString(), client.companyId.toString());
      client.lastSeen = new Date();
      await client.save();
      res.json({
        success: true,
        audience: 'client',
        accessToken,
        client: { _id: client._id, email: client.email, fullName: client.fullName, avatar: client.avatar },
        returnTo: exchange.returnTo,
      });
      return;
    }
    const user = await User.findById(exchange.userId);
    if (!user || !user.isActive || user.isDeleted || !user.isVerified || user.isSuperAdmin) {
      logOAuthFailure('oauth', stage, new Error('account_unavailable'), correlationId);
      res.status(403).json({ success: false, code: 'OAUTH_ACCOUNT_UNAVAILABLE', message: 'This account cannot sign in right now.' });
      return;
    }
    // Provider sign-in is only the first factor when the account has MFA enabled.
    if (user.mfaEnabled) {
      res.json({
        success: true,
        mfaRequired: true,
        mfaToken: generateUserMfaChallengeToken(user._id.toString(), user.companyId?.toString() || ''),
        returnTo: exchange.returnTo,
      });
      return;
    }
    stage = 'workgrind_session_creation';
    const session = await sessionForUser(user);
    setRefreshCookie(res, session.refreshToken);
    await recordSecurityEvent(user, 'LOGIN_SUCCEEDED', req, { method: 'oauth' });
    res.json({
      success: true,
      accessToken: session.accessToken,
      user: session.user,
      returnTo: exchange.returnTo,
    });
  } catch (error) {
    logOAuthFailure('oauth', stage, error, correlationId);
    res.status(500).json({ success: false, code: 'OAUTH_SESSION_FAILED', message: 'Sign-in could not be completed. Please try again.' });
  }
};
