import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import { generateUserMfaChallengeToken, verifyAccessToken } from '../utils/jwt';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpProvisioning,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from '../utils/mfa';
import { hashRefreshToken, normalizeRefreshTokenStore } from '../services/pendingRegistration';
import { getRefreshCookie, setRefreshCookie } from '../utils/authCookie';
import { getOAuthConfigurationIssue } from '../services/oauth';
import { sessionForUser } from './auth.controller';

/**
 * Account security for regular WorkGrind users: TOTP multi-factor sign-in,
 * session revocation, sign-in provider unlinking, the user's own security
 * history, and a personal data export. Super admins keep their own MFA flow.
 */

export const SECURITY_EVENT_ACTIONS = [
  'LOGIN_SUCCEEDED',
  'LOGIN_MFA_FAILED',
  'PASSWORD_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_RECOVERY_CODES_REGENERATED',
  'SESSIONS_REVOKED',
  'SIGN_IN_PROVIDER_UNLINKED',
  'DATA_EXPORTED',
] as const;
type SecurityEventAction = (typeof SECURITY_EVENT_ACTIONS)[number];

const LINKABLE_PROVIDERS = ['google', 'linkedin'] as const;
type LinkableProvider = (typeof LINKABLE_PROVIDERS)[number];
const PROVIDER_ID_FIELD: Record<LinkableProvider, 'googleId' | 'linkedinId'> = {
  google: 'googleId',
  linkedin: 'linkedinId',
};

const MFA_LOCKOUT_ATTEMPTS = 5;
const MFA_LOCKOUT_MS = 15 * 60_000;

/** Records an event in the workspace audit trail; never blocks the action itself. */
export async function recordSecurityEvent(
  user: Pick<IUser, '_id' | 'companyId'>,
  action: SecurityEventAction,
  req: Request,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!user.companyId) return; // audit records are workspace-scoped
  try {
    await AuditLog.create({
      companyId: user.companyId,
      userId: user._id,
      action,
      resource: 'User',
      resourceId: user._id.toString(),
      ...(details ? { details } : {}),
      ipAddress: req.ip,
    });
  } catch (error) {
    console.error('[AccountSecurity] Security event could not be recorded.', {
      action,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

function signInMethods(user: Pick<IUser, 'password' | 'googleId' | 'linkedinId' | 'appleId'>) {
  return {
    password: Boolean(user.password),
    google: Boolean(user.googleId),
    linkedin: Boolean(user.linkedinId),
    apple: Boolean(user.appleId),
  };
}

function remainingSignInMethods(methods: ReturnType<typeof signInMethods>, removing?: LinkableProvider): number {
  return Object.entries(methods).filter(([method, present]) => present && method !== removing).length;
}

/** Checks a TOTP code, or consumes a recovery code when allowRecovery is set. */
async function checkSecondFactor(
  user: IUser,
  code: unknown,
  { allowRecovery }: { allowRecovery: boolean },
): Promise<boolean> {
  const value = typeof code === 'string' ? code.trim() : '';
  if (!value || !user.mfaSecretEncrypted) return false;
  if (/^\d{6}$/.test(value.replace(/\s+/g, ''))) {
    try {
      if (verifyTotp(value, decryptSecret(user.mfaSecretEncrypted))) return true;
    } catch {
      return false;
    }
  }
  if (!allowRecovery || !user.recoveryCodesHashed?.length) return false;
  const recoveryHash = hashRecoveryCode(value);
  const consumed = await User.findOneAndUpdate(
    { _id: user._id, recoveryCodesHashed: recoveryHash },
    { $pull: { recoveryCodesHashed: recoveryHash } },
    { new: true },
  );
  return Boolean(consumed);
}

/**
 * Re-authentication for sensitive changes: the current password when the
 * account has one. Accounts that only sign in through a provider have no
 * password to confirm, so they rely on their live session (and on the
 * authenticator code wherever MFA is already enabled).
 */
async function confirmPassword(user: IUser, currentPassword: unknown): Promise<boolean> {
  if (!user.password) return true;
  return typeof currentPassword === 'string' && currentPassword.length > 0 && user.comparePassword(currentPassword);
}

async function loadSecurityUser(userId: string): Promise<IUser | null> {
  return User.findById(userId).select(
    '+password +mfaSecretEncrypted +mfaTempSecretEncrypted +recoveryCodesHashed +mfaFailedAttempts +mfaLockoutUntil',
  );
}

function noStore(res: Response): void {
  res.set({ 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
}

export const getSecurityOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await loadSecurityUser(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    const methods = signInMethods(user);
    noStore(res);
    res.json({
      success: true,
      security: {
        email: user.email,
        emailVerified: Boolean(user.isVerified),
        signInMethods: methods,
        // Whether each provider can currently start a sign-in on this server.
        providersAvailable: {
          google: getOAuthConfigurationIssue('google') === null,
          linkedin: getOAuthConfigurationIssue('linkedin') === null,
        },
        mfa: {
          enabled: Boolean(user.mfaEnabled),
          enabledAt: user.mfaEnabled ? user.mfaVerifiedAt ?? null : null,
          recoveryCodesRemaining: user.mfaEnabled ? user.recoveryCodesHashed?.length ?? 0 : 0,
        },
        // Each active refresh token is one signed-in browser or app. The server
        // does not record device, browser, or location details for them.
        activeSessions: normalizeRefreshTokenStore(user.refreshTokens || []).length,
        lastLogin: user.lastLogin ?? null,
      },
    });
  } catch (error) {
    console.error('[AccountSecurity] Overview failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Security settings could not be loaded.' });
  }
};

export const startUserMfaSetup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await loadSecurityUser(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    if (user.mfaEnabled) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already enabled.' });
      return;
    }
    if (!(await confirmPassword(user, req.body?.currentPassword))) {
      res.status(400).json({ success: false, message: 'Enter your current password to set up two-factor authentication.' });
      return;
    }
    const secret = generateTotpSecret();
    const { qrCodeDataUrl, otpauthUrl } = await generateTotpProvisioning(user.email, secret, 'WorkGrind');
    user.mfaTempSecretEncrypted = encryptSecret(secret);
    await user.save();
    noStore(res);
    res.json({ success: true, qrCodeUrl: qrCodeDataUrl, manualKey: secret, otpauthUrl });
  } catch (error) {
    console.error('[AccountSecurity] MFA setup failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Two-factor setup could not be started.' });
  }
};

export const enableUserMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await loadSecurityUser(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    if (user.mfaEnabled) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already enabled.' });
      return;
    }
    if (!user.mfaTempSecretEncrypted) {
      res.status(400).json({ success: false, message: 'Start two-factor setup again.' });
      return;
    }
    let secret: string;
    try {
      secret = decryptSecret(user.mfaTempSecretEncrypted);
    } catch {
      res.status(400).json({ success: false, message: 'Start two-factor setup again.' });
      return;
    }
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!verifyTotp(code, secret)) {
      res.status(400).json({ success: false, message: 'That code is not valid. Check your authenticator app and try again.' });
      return;
    }
    const recoveryCodes = generateRecoveryCodes(8);
    user.mfaSecretEncrypted = user.mfaTempSecretEncrypted;
    user.mfaTempSecretEncrypted = undefined;
    user.mfaEnabled = true;
    user.mfaVerifiedAt = new Date();
    user.mfaFailedAttempts = 0;
    user.mfaLockoutUntil = undefined;
    user.recoveryCodesHashed = recoveryCodes.map(hashRecoveryCode);
    await user.save();
    await recordSecurityEvent(user, 'MFA_ENABLED', req);
    noStore(res);
    // Shown once; only hashes are stored.
    res.json({ success: true, recoveryCodes });
  } catch (error) {
    console.error('[AccountSecurity] MFA enable failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Two-factor authentication could not be enabled.' });
  }
};

export const disableUserMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await loadSecurityUser(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    if (!user.mfaEnabled) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is not enabled.' });
      return;
    }
    if (!(await confirmPassword(user, req.body?.currentPassword))) {
      res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
      return;
    }
    if (!(await checkSecondFactor(user, req.body?.code, { allowRecovery: true }))) {
      res.status(400).json({ success: false, message: 'Enter a valid authenticator or recovery code.' });
      return;
    }
    await User.updateOne(
      { _id: user._id },
      {
        $set: { mfaEnabled: false, mfaFailedAttempts: 0 },
        $unset: { mfaSecretEncrypted: 1, mfaTempSecretEncrypted: 1, recoveryCodesHashed: 1, mfaVerifiedAt: 1, mfaLockoutUntil: 1 },
      },
    );
    await recordSecurityEvent(user, 'MFA_DISABLED', req);
    res.json({ success: true });
  } catch (error) {
    console.error('[AccountSecurity] MFA disable failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Two-factor authentication could not be turned off.' });
  }
};

export const regenerateUserRecoveryCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await loadSecurityUser(req.user!.userId);
    if (!user || !user.mfaEnabled) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is not enabled.' });
      return;
    }
    if (!(await confirmPassword(user, req.body?.currentPassword))) {
      res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
      return;
    }
    if (!(await checkSecondFactor(user, req.body?.code, { allowRecovery: false }))) {
      res.status(400).json({ success: false, message: 'Enter a valid code from your authenticator app.' });
      return;
    }
    const recoveryCodes = generateRecoveryCodes(8);
    await User.updateOne({ _id: user._id }, { $set: { recoveryCodesHashed: recoveryCodes.map(hashRecoveryCode) } });
    await recordSecurityEvent(user, 'MFA_RECOVERY_CODES_REGENERATED', req);
    noStore(res);
    res.json({ success: true, recoveryCodes });
  } catch (error) {
    console.error('[AccountSecurity] Recovery code regeneration failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'New recovery codes could not be generated.' });
  }
};

/** Issued by password and OAuth sign-in when the account has MFA enabled. */
export function createMfaChallenge(user: Pick<IUser, '_id' | 'companyId'>): string {
  return generateUserMfaChallengeToken(user._id.toString(), user.companyId?.toString() || '');
}

export const verifyUserMfaLogin = async (req: Request, res: Response): Promise<void> => {
  const invalid = () => res.status(401).json({ success: false, message: 'Your sign-in session expired. Sign in again.' });
  try {
    const challengeToken = typeof req.body?.mfaToken === 'string' ? req.body.mfaToken : '';
    let payload;
    try {
      payload = verifyAccessToken(challengeToken) as ReturnType<typeof verifyAccessToken> & { purpose?: string };
    } catch {
      invalid();
      return;
    }
    if (!payload.mfaPending || payload.isSuperAdmin || payload.purpose !== 'user_mfa_login') {
      invalid();
      return;
    }
    const user = await loadSecurityUser(payload.userId);
    if (!user || !user.isActive || user.isDeleted || !user.isVerified || !user.mfaEnabled) {
      invalid();
      return;
    }
    if (user.mfaLockoutUntil && user.mfaLockoutUntil.getTime() > Date.now()) {
      res.status(429).json({ success: false, message: 'Too many incorrect codes. Try again in 15 minutes.' });
      return;
    }
    if (!(await checkSecondFactor(user, req.body?.code, { allowRecovery: true }))) {
      const failures = (user.mfaFailedAttempts || 0) + 1;
      const locked = failures >= MFA_LOCKOUT_ATTEMPTS;
      await User.updateOne({ _id: user._id }, {
        $set: {
          mfaFailedAttempts: locked ? 0 : failures,
          ...(locked ? { mfaLockoutUntil: new Date(Date.now() + MFA_LOCKOUT_MS) } : {}),
        },
      });
      await recordSecurityEvent(user, 'LOGIN_MFA_FAILED', req, { locked });
      res.status(locked ? 429 : 401).json({
        success: false,
        message: locked ? 'Too many incorrect codes. Try again in 15 minutes.' : 'That code is not valid.',
      });
      return;
    }
    // Reload without the secret fields so sessionForUser saves only session state.
    const sessionUser = await User.findById(user._id);
    if (!sessionUser) { invalid(); return; }
    sessionUser.mfaFailedAttempts = 0;
    sessionUser.mfaLockoutUntil = undefined;
    const session = await sessionForUser(sessionUser);
    setRefreshCookie(res, session.refreshToken);
    await recordSecurityEvent(sessionUser, 'LOGIN_SUCCEEDED', req, { method: 'mfa' });
    res.json({ success: true, accessToken: session.accessToken, user: session.user });
  } catch (error) {
    console.error('[AccountSecurity] MFA sign-in failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Sign-in could not be completed. Please try again.' });
  }
};

export const revokeOtherSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'This browser session could not be identified. Sign in again and retry.' });
      return;
    }
    const currentHash = hashRefreshToken(refreshToken);
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    const sessions = normalizeRefreshTokenStore(user.refreshTokens || []);
    if (!sessions.includes(currentHash)) {
      res.status(400).json({ success: false, message: 'This browser session could not be identified. Sign in again and retry.' });
      return;
    }
    // Conditional write: if this session was revoked meanwhile, nothing changes.
    const updated = await User.updateOne(
      { _id: user._id, refreshTokens: currentHash },
      { $set: { refreshTokens: [currentHash] } },
    );
    if (!updated.modifiedCount && sessions.length > 1) {
      res.status(409).json({ success: false, message: 'Sessions changed while signing out. Try again.' });
      return;
    }
    const revoked = sessions.length - 1;
    await recordSecurityEvent(user, 'SESSIONS_REVOKED', req, { revoked });
    res.json({ success: true, revoked });
  } catch (error) {
    console.error('[AccountSecurity] Session revocation failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Other sessions could not be signed out.' });
  }
};

export const unlinkSignInProvider = async (req: AuthRequest, res: Response): Promise<void> => {
  const provider = String(req.params.provider) as LinkableProvider;
  if (!LINKABLE_PROVIDERS.includes(provider)) {
    res.status(404).json({ success: false, message: 'Unknown sign-in provider.' });
    return;
  }
  try {
    const user = await loadSecurityUser(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    const methods = signInMethods(user);
    if (!methods[provider]) {
      res.status(409).json({ success: false, message: 'That provider is not connected.' });
      return;
    }
    if (remainingSignInMethods(methods, provider) === 0) {
      res.status(409).json({
        success: false,
        code: 'LAST_SIGN_IN_METHOD',
        message: 'This is your only way to sign in. Set a password or connect another provider first.',
      });
      return;
    }
    if (!(await confirmPassword(user, req.body?.currentPassword))) {
      res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
      return;
    }
    if (user.mfaEnabled && !(await checkSecondFactor(user, req.body?.code, { allowRecovery: false }))) {
      res.status(400).json({ success: false, message: 'Enter a valid code from your authenticator app.' });
      return;
    }
    await User.updateOne({ _id: user._id }, { $unset: { [PROVIDER_ID_FIELD[provider]]: 1 } });
    await recordSecurityEvent(user, 'SIGN_IN_PROVIDER_UNLINKED', req, { provider });
    res.json({ success: true });
  } catch (error) {
    console.error('[AccountSecurity] Provider unlink failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'The provider could not be disconnected.' });
  }
};

export const getSecurityEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user!.companyId || !mongoose.isValidObjectId(req.user!.companyId)) {
      res.json({ success: true, events: [] });
      return;
    }
    const events = await AuditLog.find({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      action: { $in: SECURITY_EVENT_ACTIONS },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .select('action details createdAt')
      .lean();
    noStore(res);
    res.json({
      success: true,
      events: events.map((event) => ({
        _id: event._id,
        action: event.action,
        createdAt: event.createdAt,
        // Only non-sensitive descriptors are returned.
        method: typeof event.details?.method === 'string' ? event.details.method : undefined,
        provider: typeof event.details?.provider === 'string' ? event.details.provider : undefined,
        revoked: typeof event.details?.revoked === 'number' ? event.details.revoked : undefined,
      })),
    });
  } catch (error) {
    console.error('[AccountSecurity] Security events failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Security activity could not be loaded.' });
  }
};

/** The caller's own account data as a JSON download; never another member's. */
export const exportMyData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId)
      .select('-refreshTokens -resetPasswordToken -resetPasswordExpiry -verificationToken -verificationTokenExpiry -verificationCodeExpiry -verificationCodeSentAt -avatarStorageKey')
      .populate('companyId', 'name organizationType accountType')
      .lean();
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    const workspace = user.companyId as unknown as { name?: string; organizationType?: string; accountType?: string } | null;
    const exportDocument = {
      exportedAt: new Date().toISOString(),
      account: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName,
        givenName: user.givenName,
        familyName: user.familyName,
        jobTitle: user.jobTitle,
        department: user.department,
        phone: user.phone,
        country: user.country,
        bio: user.bio,
        skills: user.skills,
        callingId: user.callingId,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      workspace: workspace ? { name: workspace.name, organizationType: workspace.organizationType, accountType: workspace.accountType, role: user.role } : null,
      preferences: {
        theme: user.theme,
        preferredLanguage: user.preferredLanguage,
        notificationPreferences: user.notificationPreferences,
        incomingCallPrivacy: user.incomingCallPrivacy,
      },
      security: {
        emailVerified: Boolean(user.isVerified),
        twoFactorEnabled: Boolean(user.mfaEnabled),
        connectedSignInProviders: ['googleId', 'linkedinId', 'appleId'].filter((field) => Boolean((user as Record<string, unknown>)[field]))
          .map((field) => field.replace('Id', '')),
      },
    };
    if (req.user!.companyId && mongoose.isValidObjectId(req.user!.companyId)) {
      await recordSecurityEvent(
        { _id: user._id, companyId: new mongoose.Types.ObjectId(req.user!.companyId) },
        'DATA_EXPORTED',
        req,
      );
    }
    noStore(res);
    res.set('Content-Disposition', 'attachment; filename="workgrind-account-data.json"');
    res.json(exportDocument);
  } catch (error) {
    console.error('[AccountSecurity] Data export failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ success: false, message: 'Your data could not be exported.' });
  }
};
