import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import User, { IUser } from '../models/User';
import PendingRegistration from '../models/PendingRegistration';
import { createWorkGrindUser, ensureUserCallingId } from '../services/callingId';
import {
  createVerificationCode,
  decryptPendingPassword,
  encryptPendingPassword,
  hashRefreshToken,
  hashVerificationCode,
  normalizeRefreshTokenStore,
  verificationCodeMatches,
} from '../services/pendingRegistration';
import Company, { ICompany } from '../models/Company';
import AuditLog from '../models/AuditLog';
import { TRIAL_DAYS } from '../config/subscription';
import { checkMemberLimit, withCompanyCapacityLock } from '../utils/planLimits';
import Channel from '../models/Channel';
import Project from '../models/Project';
import Task from '../models/Task';
import Message from '../models/Message';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendVerificationEmail, sendVerificationCodeEmail, sendPasswordResetEmail, sendPasswordChangedNotificationEmail, sendWelcomeEmail } from '../utils/email';
import { AuthRequest } from '../middleware/auth';
import { refreshAvatarUrls } from '../services/avatarUrls';
import { clearRefreshCookie, getRefreshCookie, setRefreshCookie } from '../utils/authCookie';
import {
  canAssignOrganizationRole,
  isOrganizationRoleEligible,
  isOrganizationType,
  normalizeOrganizationRole,
} from '../config/organization';
const issue = (userId: string, companyId: string, role: string) => ({
  accessToken: generateAccessToken({ userId, companyId, role }),
  refreshToken: generateRefreshToken({ userId, companyId, role }),
});

const validPassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) &&
  /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

function parseOrganizationDetails(
  value: unknown,
  organizationType: string,
): {
  schoolType?: 'primary' | 'secondary' | 'combined' | 'other';
  gradeRange?: 'early_years' | 'primary' | 'middle' | 'secondary' | 'mixed' | 'other';
  collegeType?: 'community' | 'technical' | 'vocational' | 'sixth_form' | 'other';
  programs?: string[];
  faculties?: string[];
} | null {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const details = value as Record<string, unknown>;
  const lists = (key: 'programs' | 'faculties'): { valid: boolean; values?: string[] } => {
    const input = details[key];
    if (input === undefined) return { valid: true };
    if (!Array.isArray(input) || input.length > 30 ||
        input.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 80)) {
      return { valid: false };
    }
    return { valid: true, values: [...new Set(input.map((item) => (item as string).trim()))] };
  };
  const parsedPrograms = lists('programs');
  const parsedFaculties = lists('faculties');
  if (!parsedPrograms.valid || !parsedFaculties.valid) return null;
  const programs = parsedPrograms.values;
  const faculties = parsedFaculties.values;

  if (organizationType === 'school') {
    const schoolType = details.schoolType;
    const gradeRange = details.gradeRange;
    if (!['primary', 'secondary', 'combined', 'other'].includes(String(schoolType)) ||
        !['early_years', 'primary', 'middle', 'secondary', 'mixed', 'other'].includes(String(gradeRange))) return null;
    return {
      schoolType: schoolType as 'primary' | 'secondary' | 'combined' | 'other',
      gradeRange: gradeRange as 'early_years' | 'primary' | 'middle' | 'secondary' | 'mixed' | 'other',
    };
  }
  if (organizationType === 'college') {
    const collegeType = details.collegeType;
    if (!['community', 'technical', 'vocational', 'sixth_form', 'other'].includes(String(collegeType))) return null;
    return {
      collegeType: collegeType as 'community' | 'technical' | 'vocational' | 'sixth_form' | 'other',
      ...(programs?.length ? { programs } : {}),
    };
  }
  if (organizationType === 'university') {
    return faculties?.length ? { faculties } : {};
  }
  return {};
}

export async function restoreWorkspaceCreatorRole(
  user: IUser,
  company: Pick<ICompany, '_id' | 'ownerId' | 'accountType'>,
  ipAddress?: string,
): Promise<void> {
  if (company.ownerId.toString() !== user._id.toString() || user.role === 'owner') return;
  const previousRole = user.role;
  user.role = 'owner';
  user.accountType = company.accountType;
  await user.save();
  await AuditLog.create({
    companyId: company._id,
    userId: user._id,
    action: 'restore_owner_role',
    resource: 'User',
    resourceId: user._id.toString(),
    details: { previousRole, role: 'owner', reason: 'company_owner_id_match' },
    ipAddress,
  });
  console.info('[Auth] Restored workspace creator role from company ownership.', {
    userId: user._id.toString(),
    companyId: company._id.toString(),
    previousRole,
  });
}

export const sessionForUser = async (user: IUser) => {
  const tokens = issue(user._id.toString(), user.companyId?.toString() || '', user.role);
  user.refreshTokens = [...normalizeRefreshTokenStore(user.refreshTokens || []), hashRefreshToken(tokens.refreshToken)];
  user.lastSeen = new Date();
  user.lastLogin = new Date();
  user.status = 'online';
  await user.save();
  const profile = await refreshAvatarUrls({
    avatar: user.avatar,
    avatarStorageKey: user.avatarStorageKey,
  });
  return {
    ...tokens,
    user: {
      _id: user._id,
      callingId: user.callingId,
      fullName: user.fullName,
      givenName: user.givenName,
      familyName: user.familyName,
      email: user.email,
      avatar: profile.avatar,
      jobTitle: user.jobTitle,
      department: user.department,
      phone: user.phone,
      bio: user.bio,
      skills: user.skills,
      notificationPreferences: user.notificationPreferences,
      preferredLanguage: user.preferredLanguage,
      theme: user.theme,
      workspaceProfile: user.workspaceProfile,
      accountType: user.accountType,
      signupOrganizationType: user.signupOrganizationType,
      onboardingStatus: user.onboardingStatus,
      onboardingStep: user.onboardingStep,
      companyId: user.companyId,
      role: user.role,
      isVerified: user.isVerified,
      status: user.status,
    },
  };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const accountType = req.body?.accountType;
    const organizationType = req.body?.organizationType;
    const genericResponse = {
      success: true,
      message: 'If these details can be registered, the verification request will be processed.',
    };

    if (!fullName || fullName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ||
        !['company', 'individual'].includes(accountType) || !isOrganizationType(organizationType) ||
        (accountType === 'individual' && organizationType !== 'business')) {
      res.status(400).json({ success: false, message: 'Choose a valid account type and organization, then enter a valid name, email, and password with at least 8 characters including uppercase, lowercase, a number, and a symbol.' });
      return;
    }

    if (await User.exists({ email })) {
      res.status(202).json(genericResponse);
      return;
    }
    const now = new Date();
    const pending = await PendingRegistration.findOne({ email });
    if (pending && pending.expiresAt.getTime() > now.getTime() &&
        (pending.resendCount >= 3 || now.getTime() - pending.lastSentAt.getTime() < 60_000)) {
      res.status(202).json(genericResponse);
      return;
    }

    const code = createVerificationCode();
    const verificationExpiresAt = new Date(now.getTime() + 10 * 60_000);
    const encryptedPassword = encryptPendingPassword(password);
    const pendingData = {
      fullName,
      accountType,
      organizationType,
      ...encryptedPassword,
      verificationCodeHash: hashVerificationCode(email, code),
      verificationExpiresAt,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
      attempts: 0,
      lastSentAt: now,
    };
    if (!pending) {
      await PendingRegistration.create({ email, ...pendingData, resendCount: 0 });
    } else if (pending.expiresAt.getTime() <= now.getTime()) {
      const replaced = await PendingRegistration.findOneAndUpdate(
        { _id: pending._id, expiresAt: { $lte: now } },
        { $set: { ...pendingData, resendCount: 0 } },
        { new: true, runValidators: true },
      );
      if (!replaced) {
        res.status(202).json(genericResponse);
        return;
      }
    } else {
      const updated = await PendingRegistration.findOneAndUpdate(
        { _id: pending._id, lastSentAt: pending.lastSentAt, resendCount: pending.resendCount },
        { $set: pendingData, $inc: { resendCount: 1 } },
        { new: true, runValidators: true },
      );
      if (!updated) {
        res.status(202).json(genericResponse);
        return;
      }
    }
    const delivery = await sendVerificationCodeEmail(email, fullName, code);
    if (!delivery.success) {
      await PendingRegistration.updateOne(
        { email, verificationCodeHash: hashVerificationCode(email, code) },
        {
          $unset: { verificationCodeHash: 1, verificationExpiresAt: 1 },
          $set: { attempts: 0 },
        },
      );
      res.status(503).json({
        success: false,
        message: 'We could not deliver the verification email. Please try again later.',
      });
      return;
    }
    res.status(202).json(genericResponse);
  } catch (error) {
    if ((error as any)?.code === 11000) {
      res.status(202).json({ success: true, message: 'If these details can be registered, the verification request will be processed.' });
      return;
    }
    console.error('[Auth] Registration request failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      ...(error && typeof error === 'object' && 'code' in error && error.code === 11000 ? { duplicateKey: true } : {}),
    });
    res.status(500).json({ success: false, message: 'Unable to process registration. Please try again.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');
    if (!user?.password || !(await user.comparePassword(password))) { res.status(401).json({ success: false, message: 'Invalid credentials' }); return; }
    if (!user.isActive || user.isDeleted) { res.status(403).json({ success: false, message: 'Account disabled' }); return; }
    if (!user.isVerified) { res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email address before signing in.' }); return; }
    if (user.companyId && user.role !== 'owner') {
      const company = await Company.findById(user.companyId).select('ownerId accountType');
      if (company) await restoreWorkspaceCreatorRole(user, company, req.ip);
    }
    const cid = user.companyId?.toString() || '';
    const tokens = issue(user._id.toString(), cid, user.role);
    user.refreshTokens = [...normalizeRefreshTokenStore(user.refreshTokens), hashRefreshToken(tokens.refreshToken)];
    user.lastSeen = new Date();
    user.lastLogin = new Date();
    user.status = 'online';
    await user.save();
    const profile = await refreshAvatarUrls({
      avatar: user.avatar,
      avatarStorageKey: user.avatarStorageKey,
    });
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ success: true, accessToken: tokens.accessToken, user: {
      _id: user._id,
      callingId: user.callingId,
      fullName: user.fullName,
      givenName: user.givenName,
      familyName: user.familyName,
      email: user.email,
      avatar: profile.avatar,
      jobTitle: user.jobTitle,
      department: user.department,
      phone: user.phone,
      bio: user.bio,
      skills: user.skills,
      notificationPreferences: user.notificationPreferences,
      preferredLanguage: user.preferredLanguage,
      theme: user.theme,
      workspaceProfile: user.workspaceProfile,
      companyId: user.companyId,
      role: user.role,
      isVerified: user.isVerified,
      status: user.status,
      accountType: user.accountType,
      signupOrganizationType: user.signupOrganizationType,
      onboardingStatus: user.onboardingStatus,
      onboardingStep: user.onboardingStep,
    } });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  let failureStage = 'refresh_token_lookup';
  try {
    const cookieRefreshToken = getRefreshCookie(req);
    const bodyRefreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    const refreshToken = cookieRefreshToken || bodyRefreshToken;
    if (!refreshToken) {
      console.warn('[Auth] Refresh rejected because no refresh credential was supplied.', {
        path: req.path,
        refreshCookiePresent: false,
        legacyBodyTokenPresent: false,
        httpStatus: 401,
      });
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }
    failureStage = 'refresh_token_verification';
    const decoded = verifyRefreshToken(refreshToken);
    failureStage = 'user_lookup';
    const user = await User.findById(decoded.userId);
    failureStage = 'refresh_token_validation';
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = user?.refreshTokens.find((stored) => stored === tokenHash || stored === refreshToken);
    if (!user || !storedToken || !user.isVerified || !user.isActive || user.isDeleted) {
      console.warn('[Auth] Refresh rejected because the credential is invalid or revoked.', {
        path: req.path,
        refreshCookiePresent: Boolean(cookieRefreshToken),
        legacyBodyTokenPresent: Boolean(bodyRefreshToken),
        userFound: Boolean(user),
        httpStatus: 401,
      });
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    failureStage = 'refresh_token_rotation';
    const tokens = issue(user._id.toString(), user.companyId?.toString() || '', user.role);
    const updated = await User.findOneAndUpdate(
      { _id: user._id, refreshTokens: { $in: [tokenHash, refreshToken] } },
      [{
        $set: {
          refreshTokens: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ['$refreshTokens', []] },
                  as: 'storedToken',
                  cond: { $not: [{ $in: ['$$storedToken', [tokenHash, refreshToken]] }] },
                },
              },
              [hashRefreshToken(tokens.refreshToken)],
            ],
          },
        },
      }],
      { new: true },
    );
    if (!updated) {
      console.warn('[Auth] Refresh rejected because token rotation did not match the stored session.', {
        path: req.path,
        refreshCookiePresent: Boolean(cookieRefreshToken),
        reason: 'refresh_token_rotated_concurrently',
        httpStatus: 401,
      });
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ success: true, accessToken: tokens.accessToken });
  } catch (error) {
    console.warn('[Auth] Refresh request failed.', {
      path: req.path,
      stage: failureStage,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      httpStatus: 401,
    });
    clearRefreshCookie(res);
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const refreshToken = getRefreshCookie(req) ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '');
    if (req.user && refreshToken) {
      const user = await User.findById(req.user.userId);
      if (user) {
        const tokenHash = hashRefreshToken(refreshToken);
        user.refreshTokens = normalizeRefreshTokenStore(user.refreshTokens)
          .filter((stored) => stored !== tokenHash && stored !== refreshToken);
        user.status = 'offline';
        user.lastSeen = new Date();
        await user.save();
      }
    }
    clearRefreshCookie(res);
    res.json({ success: true });
  } catch (e: any) {
    clearRefreshCookie(res);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;
    const user = await User.findOne({ verificationToken: token, verificationTokenExpiry: { $gt: new Date() } });
    if (!user) { res.status(400).json({ success: false, message: 'Invalid or expired token' }); return; }
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    user.verificationCodeHash = undefined;
    user.verificationCodeExpiry = undefined;
    user.verificationCodeAttempts = undefined;
    user.verificationCodeResends = undefined;
    user.verificationCodeSentAt = undefined;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const verifyRegistrationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s/g, '') : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      res.status(400).json({ success: false, message: 'Enter the six-digit code sent to your email.' });
      return;
    }

    const now = new Date();
    const pending = await PendingRegistration.findOneAndUpdate(
      { email, expiresAt: { $gt: now }, verificationExpiresAt: { $gt: now }, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (!pending) {
      const legacyUser = await User.findOneAndUpdate(
        { email, isVerified: false, verificationCodeExpiry: { $gt: now }, verificationCodeAttempts: { $lt: 5 } },
        { $inc: { verificationCodeAttempts: 1 } },
        { new: true },
      ).select('+verificationCodeHash');
      if (!legacyUser || !legacyUser.verificationCodeHash ||
          !verificationCodeMatches(email, code, legacyUser.verificationCodeHash)) {
        res.status(400).json({ success: false, message: 'That code is invalid or expired. Request a new code and try again.' });
        return;
      }
      const verifiedUser = await User.findOneAndUpdate(
        {
          _id: legacyUser._id,
          isVerified: false,
          verificationCodeHash: legacyUser.verificationCodeHash,
          verificationCodeExpiry: { $gt: now },
        },
        {
          $set: { isVerified: true },
          $unset: {
            verificationCodeHash: 1,
            verificationCodeExpiry: 1,
            verificationCodeAttempts: 1,
            verificationCodeResends: 1,
            verificationCodeSentAt: 1,
          },
        },
        { new: true },
      );
      if (!verifiedUser) {
        res.status(400).json({ success: false, message: 'That code is invalid or expired. Request a new code and try again.' });
        return;
      }
      const tokens = issue(verifiedUser._id.toString(), verifiedUser.companyId?.toString() || '', verifiedUser.role);
      verifiedUser.refreshTokens = [
        ...normalizeRefreshTokenStore(verifiedUser.refreshTokens),
        hashRefreshToken(tokens.refreshToken),
      ];
      await verifiedUser.save();
      setRefreshCookie(res, tokens.refreshToken);
      res.json({
        success: true,
        accessToken: tokens.accessToken,
        user: {
          _id: verifiedUser._id,
          fullName: verifiedUser.fullName,
          email: verifiedUser.email,
          avatar: verifiedUser.avatar,
          companyId: verifiedUser.companyId,
          role: verifiedUser.role,
          isVerified: true,
          status: verifiedUser.status,
          accountType: verifiedUser.accountType,
          theme: verifiedUser.theme,
          workspaceProfile: verifiedUser.workspaceProfile,
        },
      });
      return;
    }
    if (!verificationCodeMatches(email, code, pending.verificationCodeHash)) {
      res.status(400).json({ success: false, message: 'That code is invalid or expired. Request a new code and try again.' });
      return;
    }

    const consumed = await PendingRegistration.deleteOne({
      _id: pending._id,
      verificationCodeHash: pending.verificationCodeHash,
      attempts: pending.attempts,
    });
    if (consumed.deletedCount !== 1) {
      res.status(400).json({ success: false, message: 'That code is invalid or expired. Request a new code and try again.' });
      return;
    }

    if (await User.exists({ email })) {
      res.status(400).json({ success: false, message: 'That code is invalid or expired. Request a new code and try again.' });
      return;
    }

    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const user = await createWorkGrindUser({
      fullName: pending.fullName,
      email,
      ...(pending.phone ? { phone: pending.phone } : {}),
      password: decryptPendingPassword(pending),
      role: 'owner',
      accountType: pending.accountType || 'company',
      signupOrganizationType: pending.organizationType || 'business',
      isVerified: true,
      isSuperAdmin: false,
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'free',
      trialStartDate,
      trialEndDate,
    });
    const session = await sessionForUser(user);
    setRefreshCookie(res, session.refreshToken);
    void sendWelcomeEmail(user.email, user.fullName)
      .then((result) => {
        if (!result.success) console.error('[Auth] Welcome email delivery failed.');
      })
      .catch((error) => console.error('[Auth] Welcome email delivery failed.', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }));
    res.json({
      success: true,
      accessToken: session.accessToken,
      user: session.user,
    });
  } catch (error) {
    console.error('[Auth] Email verification failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to verify this code. Please try again.' });
  }
};

export const resendRegistrationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericResponse = {
      success: true,
      message: 'If a pending signup exists for this address, the verification request will be processed.',
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(202).json(genericResponse);
      return;
    }
    const now = new Date();
    const code = createVerificationCode();
    const pending = await PendingRegistration.findOneAndUpdate({
      email,
      expiresAt: { $gt: now },
      resendCount: { $lt: 3 },
      lastSentAt: { $lte: new Date(now.getTime() - 60_000) },
    }, {
      $set: {
        verificationCodeHash: hashVerificationCode(email, code),
        verificationExpiresAt: new Date(now.getTime() + 10 * 60_000),
        lastSentAt: now,
        attempts: 0,
      },
      $inc: { resendCount: 1 },
    }, {
      new: true,
    });
    if (!pending) {
      const existingUser = await User.findOneAndUpdate(
        {
          email,
          isVerified: false,
          $and: [
            { $or: [{ verificationCodeResends: { $lt: 3 } }, { verificationCodeResends: { $exists: false } }] },
            { $or: [{ verificationCodeSentAt: { $lte: new Date(now.getTime() - 60_000) } }, { verificationCodeSentAt: { $exists: false } }] },
          ],
        },
        {
          $set: {
            verificationCodeHash: hashVerificationCode(email, code),
            verificationCodeExpiry: new Date(now.getTime() + 10 * 60_000),
            verificationCodeAttempts: 0,
            verificationCodeSentAt: now,
          },
          $inc: { verificationCodeResends: 1 },
        },
        { new: true },
      );
      if (existingUser) {
        const codeHash = hashVerificationCode(email, code);
        const delivery = await sendVerificationCodeEmail(email, existingUser.fullName, code);
        if (!delivery.success) {
          await User.updateOne(
            { _id: existingUser._id, verificationCodeHash: codeHash },
            {             $unset: {
              verificationCodeHash: 1,
              verificationCodeExpiry: 1,
              verificationCodeAttempts: 1,
            } },
          );
          res.status(503).json({
            success: false,
            message: 'We could not deliver a verification email. Please try again later.',
          });
          return;
        }
      }
      res.status(202).json(genericResponse);
      return;
    }
    const codeHash = hashVerificationCode(email, code);
    const delivery = await sendVerificationCodeEmail(email, pending.fullName, code);
    if (!delivery.success) {
      await PendingRegistration.deleteOne({ _id: pending._id, verificationCodeHash: codeHash });
      res.status(503).json({
        success: false,
        message: 'We could not deliver a verification email. Please try again later.',
      });
      return;
    }
    res.status(202).json(genericResponse);
  } catch (error) {
    console.error('[Auth] Verification code resend failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to resend a verification code. Please try again.' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      // Hash before storing — raw token travels in URL, hash lives in DB
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await user.save();
      const delivery = await sendPasswordResetEmail(user.email, user.fullName, rawToken);
      if (!delivery.success) {
        await User.updateOne(
          { _id: user._id, resetPasswordToken: hashedToken },
          { $unset: { resetPasswordToken: 1, resetPasswordExpiry: 1 } },
        );
      }
    }
    // Keep the response identical for unknown accounts to avoid account enumeration.
    res.json({
      success: true,
      message: 'If the address is registered, follow any reset instructions you receive. This response does not confirm whether an email was sent.',
    });
  } catch (error) {
    console.error('[Auth] Password reset email request failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to process the password reset request.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.body?.token ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token and new password are required' });
      return;
    }

    // Hash the raw token from the URL to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
    }).select('+password');

    if (!user || !user.resetPasswordExpiry || user.resetPasswordExpiry.getTime() <= Date.now()) {
      res.status(400).json({ success: false, message: 'Reset link is invalid or has expired. Please request a new one.' });
      return;
    }

    // Password complexity validation
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase, a number, and a special character' });
      return;
    }

    // Update password, clear token, invalidate ALL sessions
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    user.refreshTokens = []; // revoke all active sessions
    await user.save();

    const notification = await sendPasswordChangedNotificationEmail(user.email, user.fullName);
    if (!notification.success) console.warn('[Auth] Password-change notification delivery failed.');

    res.json({ success: true, message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current password and new password are required' });
      return;
    }

    // Fetch user with +password to perform cryptographic comparison against stored hash
    const user = await User.findById(req.user!.userId).select('+password');
    if (!user || !user.password) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // STRICT VERIFICATION: Compare provided current password against stored hash
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    // PASSWORD STRENGTH VALIDATION: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
      return;
    }
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      res.status(400).json({
        success: false,
        message: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, message: 'New password cannot be the same as your current password' });
      return;
    }

    // Update password (triggers Mongoose pre-save bcrypt hash)
    user.password = newPassword;

    // SESSION INVALIDATION: Revoke all existing refresh tokens across all devices
    user.refreshTokens = [];

    await user.save();

    // EMAIL ALERT NOTIFICATION
    await sendPasswordChangedNotificationEmail(user.email, user.fullName);

    res.json({
      success: true,
      message: 'Password updated successfully. Other active sessions have been invalidated.',
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const saveWorkspaceSelection = async (req: AuthRequest, res: Response): Promise<void> => {
  const { accountType, organizationType } = req.body || {};
  if (!['company', 'individual'].includes(accountType) ||
      !isOrganizationType(organizationType) ||
      (accountType === 'individual' && organizationType !== 'business')) {
    res.status(400).json({ success: false, message: 'Choose a valid account type and organization.' });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user!.userId, companyId: { $in: [null] } },
      {
        $set: {
          accountType,
          signupOrganizationType: organizationType,
        },
      },
      { new: true, runValidators: true },
    ).select('_id accountType signupOrganizationType companyId');

    if (!user) {
      res.status(409).json({ success: false, code: 'WORKSPACE_ALREADY_EXISTS', message: 'Workspace selection can no longer be changed for this account.' });
      return;
    }

    res.json({
      success: true,
      accountType: user.accountType,
      organizationType: user.signupOrganizationType,
    });
  } catch (error) {
    console.error('[Auth] Workspace selection could not be saved.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to save your workspace selection. Please try again.' });
  }
};

export const saveOnboardingProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  const step = req.body?.step;
  if (!Number.isInteger(step) || step < 1 || step > 3 || !req.user?.companyId) {
    res.status(400).json({ success: false, message: 'Choose a valid onboarding step.' });
    return;
  }

  try {
    const company = await Company.findOne({
      _id: req.user.companyId,
      ownerId: req.user.userId,
      isActive: true,
    }).select('_id');
    if (!company) {
      res.status(403).json({ success: false, message: 'Only the workspace owner can update onboarding.' });
      return;
    }
    const user = await User.findOneAndUpdate(
      { _id: req.user.userId, companyId: company._id, onboardingStatus: { $ne: 'completed' } },
      { $max: { onboardingStep: step } },
      { new: true },
    ).select('_id onboardingStep onboardingStatus');
    res.json({
      success: true,
      onboardingStep: user?.onboardingStep ?? 3,
      onboardingStatus: user?.onboardingStatus,
    });
  } catch (error) {
    console.error('[Auth] Onboarding progress could not be saved.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to save onboarding progress. Please try again.' });
  }
};

export const completeOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.companyId) {
    res.status(400).json({ success: false, message: 'Create or join a workspace before completing onboarding.' });
    return;
  }
  try {
    const company = await Company.findOne({
      _id: req.user.companyId,
      ownerId: req.user.userId,
      isActive: true,
    }).select('_id');
    if (!company) {
      res.status(403).json({ success: false, message: 'Only the workspace owner can complete onboarding.' });
      return;
    }
    await User.updateOne(
      { _id: req.user.userId, companyId: company._id },
      { $set: { onboardingStatus: 'completed', onboardingStep: 3 } },
    );
    res.json({ success: true, onboardingStatus: 'completed', onboardingStep: 3 });
  } catch (error) {
    console.error('[Auth] Onboarding completion could not be saved.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to finish onboarding. Please try again.' });
  }
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  let workspaceCreationLock: string | undefined;
  try {
    const uid = req.user!.userId;
    const { name, industry, size, country, timeZone } = req.body;
    const requestedAccountType = req.body?.accountType;
    const requestedOrganizationType = req.body?.organizationType;
    if (requestedAccountType !== undefined && !['company', 'individual'].includes(requestedAccountType)) {
      res.status(400).json({ success: false, message: 'Account type must be company or individual.' });
      return;
    }
    if (requestedOrganizationType !== undefined && !isOrganizationType(requestedOrganizationType)) {
      res.status(400).json({ success: false, message: 'Organization type must be business, school, college, or university.' });
      return;
    }
    const user = await User.findById(uid);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const accountType = user.signupOrganizationType
      ? user.accountType ?? requestedAccountType ?? 'company'
      : requestedAccountType ?? user.accountType ?? 'company';
    const organizationType = user.signupOrganizationType ?? requestedOrganizationType ?? 'business';

    const respondWithExistingWorkspace = async (existingUser: IUser, existingCompany: ICompany, statusCode = 200) => {
      await restoreWorkspaceCreatorRole(existingUser, existingCompany, req.ip);
      const tokens = issue(uid, existingCompany._id.toString(), existingUser.role || 'owner');
      existingUser.signupOrganizationType = undefined;
      existingUser.refreshTokens = [...normalizeRefreshTokenStore(existingUser.refreshTokens), hashRefreshToken(tokens.refreshToken)];
      await existingUser.save();
      setRefreshCookie(res, tokens.refreshToken);
      res.status(statusCode).json({
        success: true,
        message: 'Workspace already exists for this account',
        company: existingCompany,
        user: {
          _id: existingUser._id,
          callingId: existingUser.callingId,
          fullName: existingUser.fullName,
          email: existingUser.email,
          companyId: existingUser.companyId,
          role: existingUser.role,
          accountType: existingUser.accountType || existingCompany.accountType,
          onboardingStatus: existingUser.onboardingStatus,
          onboardingStep: existingUser.onboardingStep,
          theme: existingUser.theme,
          workspaceProfile: existingUser.workspaceProfile,
        },
        accessToken: tokens.accessToken,
      });
    };

    if (user.companyId) {
      const existingCompany = await Company.findById(user.companyId);
      if (existingCompany) {
        await respondWithExistingWorkspace(user, existingCompany);
        return;
      }
    }
    if ((user.signupOrganizationType && requestedOrganizationType &&
         requestedOrganizationType !== user.signupOrganizationType) ||
        (user.signupOrganizationType && requestedAccountType &&
         requestedAccountType !== user.accountType)) {
      res.status(409).json({ success: false, code: 'WORKSPACE_SELECTION_CHANGED', message: 'Save your workspace selection before continuing.' });
      return;
    }

    const isIndividual = accountType === 'individual';
    if (isIndividual && organizationType !== 'business') {
      res.status(400).json({ success: false, message: 'Individual workspaces must use the business organization type.' });
      return;
    }
    const organizationDetails = parseOrganizationDetails(req.body?.organizationDetails, organizationType);
    if (!organizationDetails) {
      res.status(400).json({ success: false, message: 'Enter valid details for the selected organization type.' });
      return;
    }
    const workspaceName = name?.trim() || (isIndividual ? `${user.fullName}'s Workspace` : '');
    if (!workspaceName) {
      res.status(400).json({ success: false, message: 'Company or organization name is required' });
      return;
    }

    workspaceCreationLock = uuidv4();
    const claimedUser = await User.findOneAndUpdate(
      {
        _id: uid,
        companyId: { $in: [null] },
        $or: [
          { workspaceCreationLockExpiresAt: { $exists: false } },
          { workspaceCreationLockExpiresAt: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          workspaceCreationLock,
          workspaceCreationLockExpiresAt: new Date(Date.now() + 2 * 60_000),
        },
      },
      { new: true },
    );
    if (!claimedUser) {
      const latestUser = await User.findById(uid);
      if (latestUser?.companyId) {
        const existingCompany = await Company.findById(latestUser.companyId);
        if (existingCompany) {
          await respondWithExistingWorkspace(latestUser, existingCompany);
          return;
        }
      }
      res.status(409).json({
        success: false,
        code: 'WORKSPACE_SETUP_IN_PROGRESS',
        message: 'Workspace setup is already in progress. Wait a moment and try again.',
      });
      return;
    }

    const company = await Company.create({
      name: workspaceName,
      industry: isIndividual ? (industry || 'Freelance / Individual') : (industry || 'Technology'),
      size: isIndividual ? '1-10' : (size || '11-50'),
      country: country || 'United States',
      timeZone: timeZone || 'UTC',
      ownerId: uid,
      accountType: isIndividual ? 'individual' : 'company',
      organizationType,
      ...(Object.keys(organizationDetails).length ? { organizationDetails } : {}),
      inviteCode: uuidv4().split('-')[0].toUpperCase(),
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'free',
      trialStartDate: user.trialStartDate ?? user.createdAt,
      trialEndDate: user.trialEndDate ?? new Date(
        (user.trialStartDate ?? user.createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
      ),
    });

    const tokens = issue(uid, company._id.toString(), 'owner');
    user.companyId = company._id;
    user.role = 'owner';
    user.accountType = isIndividual ? 'individual' : 'company';
    user.signupOrganizationType = undefined;
    user.onboardingStatus = 'pending';
    user.onboardingStep = 1;
    user.refreshTokens = [...normalizeRefreshTokenStore(user.refreshTokens), hashRefreshToken(tokens.refreshToken)];
    try {
      await user.save();
    } catch (saveError) {
      try {
        const persistedUser = await User.findById(uid).select('_id companyId');
        if (persistedUser?.companyId?.toString() !== company._id.toString()) {
          await Company.deleteOne({ _id: company._id, ownerId: uid });
        }
      } catch (cleanupError) {
        console.error('[Auth] Failed to clean up an unlinked workspace after setup failed.', {
          errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
        });
      }
      throw saveError;
    }
    await User.updateOne(
      { _id: uid, workspaceCreationLock },
      { $unset: { workspaceCreationLock: 1, workspaceCreationLockExpiresAt: 1 } },
    );
    workspaceCreationLock = undefined;
    setRefreshCookie(res, tokens.refreshToken);

    // Batch create default channels in 1 database roundtrip
    const channelsToCreate = [
      { companyId: company._id, name: 'general', type: 'public', createdBy: uid, members: [uid], isDefault: true },
      { companyId: company._id, name: 'random', type: 'public', createdBy: uid, members: [uid], isDefault: true },
      { companyId: company._id, name: 'announcements', type: 'public', createdBy: uid, members: [uid], isDefault: true },
    ];
    const createdChannels = await Channel.insertMany(channelsToCreate);
    const generalCh = createdChannels.find((c) => c.name === 'general');

    // Seed Demo Starter Project
    const project = await Project.create({
      companyId: company._id,
      name: isIndividual ? 'Personal Productivity Roadmap' : 'Welcome to WorkGrind',
      description: isIndividual
        ? 'Your personal workspace template to organize freelance projects, solo deliverables, and goals.'
        : 'Your starter workspace guide to master tasks, project collaboration, and real-time chat.',
      status: 'active',
      progress: 25,
      color: '#4F46E5',
      managerId: uid,
      assigneeId: uid,
      members: [{ userId: uid, role: 'manager' }],
      startDate: new Date(),
      deadline: new Date(Date.now() + 14 * 86400000),
    });

    // Seed 4 Starter Tasks concurrently
    const now = Date.now();
    await Task.create([
      {
        companyId: company._id,
        projectId: project._id,
        creatorId: uid,
        assigneeId: uid,
        title: 'Explore your personal command center dashboard',
        description: 'Review urgent deadlines, active roadmaps, and key metrics at a glance.',
        status: 'completed',
        priority: 'medium',
        dueDate: new Date(now - 86400000),
        completedAt: new Date(),
      },
      {
        companyId: company._id,
        projectId: project._id,
        creatorId: uid,
        assigneeId: uid,
        title: 'Drag and drop tasks between Kanban status columns',
        description: 'Move cards between To Do, In Progress, Review, and Completed to update status instantly.',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(now + 86400000),
      },
      {
        companyId: company._id,
        projectId: project._id,
        creatorId: uid,
        assigneeId: uid,
        title: isIndividual
          ? 'Customize your personal workflow in Settings'
          : 'Invite your teammates via Workspace Settings',
        description: isIndividual
          ? 'Set your profile, theme, timezone, or invite clients/collaborators anytime.'
          : 'Collaboration is better together! Invite colleagues via email or shareable invite links.',
        status: 'todo',
        priority: 'medium',
        dueDate: new Date(now + 3 * 86400000),
      },
      {
        companyId: company._id,
        projectId: project._id,
        creatorId: uid,
        assigneeId: uid,
        title: isIndividual
          ? 'Track upcoming deadlines in the Workplace Calendar'
          : 'Send a message or test attachments in #general channel',
        description: isIndividual
          ? 'Keep track of milestones, task due dates, and virtual meetings in one unified calendar.'
          : 'Real-time chat with emoji reactions, quote replies, and file sharing is live.',
        status: 'todo',
        priority: 'low',
        dueDate: new Date(now + 5 * 86400000),
      },
    ]);

    // Send welcome message in #general
    if (generalCh) {
      await Message.create({
        companyId: company._id,
        channelId: generalCh._id,
        senderId: uid,
        content: '🎉 Welcome to WorkGrind! Your workspace has been created. Check out your starter tasks and feel free to invite your teammates.',
        type: 'text',
      });
    }

    await AuditLog.create({
      companyId: company._id,
      userId: user._id,
      action: 'create',
      resource: 'Workspace',
      resourceId: company._id.toString(),
      details: { accountType: user.accountType, organizationType: company.organizationType },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      company,
      user: {
        _id: user._id,
        callingId: user.callingId,
        fullName: user.fullName,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
        accountType: user.accountType,
        onboardingStatus: user.onboardingStatus,
        onboardingStep: user.onboardingStep,
        theme: user.theme,
        workspaceProfile: user.workspaceProfile,
      },
      accessToken: tokens.accessToken,
    });
  } catch (e: any) {
    if (workspaceCreationLock) {
      await User.updateOne(
        { _id: req.user!.userId, workspaceCreationLock },
        { $unset: { workspaceCreationLock: 1, workspaceCreationLockExpiresAt: 1 } },
      );
    }
    res.status(500).json({ success: false, message: e.message });
  }
};

export const validateInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenOrCode } = req.params;
    if (!tokenOrCode) {
      res.status(400).json({ success: false, message: 'Invite token or code is required' });
      return;
    }

    let company = await Company.findOne({
      'pendingInvites.token': tokenOrCode,
      'pendingInvites.expiresAt': { $gt: new Date() },
    }).populate('ownerId', 'fullName email');

    let inviteDetails: any = null;

    if (company) {
      const invite = company.pendingInvites.find((i) => i.token === tokenOrCode);
      inviteDetails = {
        type: 'token',
        companyId: company._id,
        companyName: company.name,
        companyLogo: company.logo,
        email: invite?.email,
        role: invite?.role || 'employee',
        inviterName: (company.ownerId as any)?.fullName || 'A team administrator',
      };
    } else {
      company = await Company.findOne({
        inviteCode: tokenOrCode.toUpperCase(),
        isActive: true,
      }).populate('ownerId', 'fullName email');

      if (company) {
        inviteDetails = {
          type: 'code',
          companyId: company._id,
          companyName: company.name,
          companyLogo: company.logo,
          role: company.settings?.defaultRole || 'employee',
          inviterName: (company.ownerId as any)?.fullName || 'A team administrator',
        };
      }
    }

    if (!inviteDetails) {
      res.status(404).json({ success: false, message: 'Invalid or expired invitation link or code.' });
      return;
    }

    res.json({ success: true, invite: inviteDetails });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const joinCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.userId;
    const { inviteToken, inviteCode } = req.body;
    const codeOrToken = inviteToken || inviteCode;

    if (!codeOrToken) {
      res.status(400).json({ success: false, message: 'Invite token or code required' });
      return;
    }

    // Prevent a user who already belongs to a company from joining another via invite
    const joiningUser = await User.findById(uid);
    if (!joiningUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (joiningUser.companyId) {
      res.status(400).json({ success: false, message: 'You already belong to a workspace. Leave your current workspace before joining another.' });
      return;
    }

    let company = await Company.findOne({
      'pendingInvites.token': codeOrToken,
      'pendingInvites.expiresAt': { $gt: new Date() },
    });

    let assignedRole = 'employee';

    if (company) {
      const invite = company.pendingInvites.find((i) => i.token === codeOrToken);
      if (invite) {
        // SECURITY: Verify the joining user's email matches the invite recipient.
        // This prevents token forwarding attacks where a different user uses someone else's invite link.
        if (invite.email && invite.email.toLowerCase() !== joiningUser.email.toLowerCase()) {
          res.status(403).json({
            success: false,
            message: 'This invitation was sent to a different email address. Please sign in with the invited email account.',
          });
          return;
        }
        const requestedRole = normalizeOrganizationRole(invite.role, company.organizationType, '');
        if (invite.inviterId) {
          const inviter = await User.findOne({
            _id: invite.inviterId,
            companyId: company._id,
            isActive: true,
            isDeleted: { $ne: true },
          }).select('role');
          const inviterOwnsOrganization = company.ownerId.toString() === invite.inviterId.toString();
          if (
            !inviter ||
            !canAssignOrganizationRole(inviter.role, requestedRole, company.organizationType, inviterOwnsOrganization)
          ) {
            res.status(403).json({ success: false, message: 'This invitation role is no longer authorized.' });
            return;
          }
        } else {
          // Legacy invitations lack inviter provenance, so only retain low-privilege assignments.
          const legacyRoles = ['employee', 'guest', 'student'];
          if (!legacyRoles.includes(requestedRole) || !isOrganizationRoleEligible(requestedRole, company.organizationType)) {
            assignedRole = 'employee';
          } else {
            assignedRole = requestedRole;
          }
        }
        if (invite.inviterId) assignedRole = requestedRole;
      }
      // Consume the invite token so it cannot be reused
      company.pendingInvites = company.pendingInvites.filter((i) => i.token !== codeOrToken);
    } else {
      company = await Company.findOne({
        inviteCode: codeOrToken.trim().toUpperCase(),
        isActive: true,
      });

      if (company) {
        const requestedRole = normalizeOrganizationRole(company.settings?.defaultRole, company.organizationType, '');
        const safeRoles = ['employee', 'guest', 'student'];
        assignedRole = safeRoles.includes(requestedRole) &&
          isOrganizationRoleEligible(requestedRole, company.organizationType)
          ? requestedRole
          : 'employee';
      }
    }

    if (!company) {
      res.status(400).json({ success: false, message: 'Invalid or expired invite' });
      return;
    }

    const admission = await withCompanyCapacityLock(company._id.toString(), async () => {
      const lockedCompany = await Company.findById(company._id);
      if (!lockedCompany) throw new Error('Workspace not found while reserving capacity.');
      if (inviteToken) {
        const currentInvite = lockedCompany.pendingInvites.find(
          (invite) => invite.token === inviteToken && new Date(invite.expiresAt).getTime() > Date.now(),
        );
        if (!currentInvite) return { staleInvite: true as const };
        lockedCompany.pendingInvites = lockedCompany.pendingInvites.filter((invite) => invite.token !== inviteToken);
      }
      const memberCheck = await checkMemberLimit(uid, company._id.toString(), {
        excludePendingInviteToken: inviteToken || undefined,
        role: assignedRole,
      });
      if (!memberCheck.allowed) return { allowed: false as const, memberCheck };

      joiningUser.companyId = company._id;
      joiningUser.role = assignedRole as any;
      await joiningUser.save();
      await lockedCompany.save();
      return { allowed: true as const, staleInvite: false as const };
    });
    if ('staleInvite' in admission && admission.staleInvite) {
      res.status(400).json({ success: false, message: 'Invalid or expired invite' });
      return;
    }
    if (!admission.allowed) {
      res.status(403).json({
        success: false,
        code: admission.memberCheck.code,
        message: admission.memberCheck.reason,
        current: admission.memberCheck.current,
        limit: admission.memberCheck.limit,
        requiresUpgrade: admission.memberCheck.upgrade ?? false,
      });
      return;
    }

    await Channel.updateMany({ companyId: company._id, isDefault: true }, { $addToSet: { members: uid } });

    const tokens = issue(uid, company._id.toString(), joiningUser.role);
    joiningUser.refreshTokens = [hashRefreshToken(tokens.refreshToken)];
    await joiningUser.save();

    setRefreshCookie(res, tokens.refreshToken);
    res.json({ success: true, company, role: joiningUser.role, accessToken: tokens.accessToken });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  let failureStage = 'user_lookup';
  try {
    const user = await User.findById(req.user!.userId).populate(
      'companyId',
      'name logo plan inviteCode accountType organizationType organizationDetails industry size country timeZone currency settings academicSettings'
    );
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    if (!user.callingId) {
      failureStage = 'calling_id_allocation';
      user.callingId = await ensureUserCallingId(user._id);
    }

    // Auto-expire trial inline on every /auth/me call
    if (
      user.subscriptionStatus === 'trialing' &&
      user.trialEndDate &&
      new Date() > user.trialEndDate
    ) {
      failureStage = 'trial_expiry_update';
      user.subscriptionStatus = 'expired';
      await user.save();
    }

    // Compute trial days remaining
    let trialDaysRemaining: number | null = null;
    if (user.subscriptionStatus === 'trialing' && user.trialEndDate) {
      const msLeft = user.trialEndDate.getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    failureStage = 'avatar_url_refresh';
    res.set({
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Vary: 'Authorization',
    });
    res.json({ success: true, user: await refreshAvatarUrls(user.toObject()), trialDaysRemaining });
  } catch (error) {
    const errorCode = (error as { code?: unknown })?.code;
    const safeErrorCode = typeof errorCode === 'number'
      ? errorCode
      : typeof errorCode === 'string' && /^[\w.-]{1,40}$/.test(errorCode)
        ? errorCode
        : undefined;
    console.error('[Auth] GET /api/auth/me failed.', {
      requestId: req.get('x-request-id')?.replace(/[^\w.-]/g, '').slice(0, 128),
      stage: failureStage,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      ...(safeErrorCode !== undefined ? { errorCode: safeErrorCode } : {}),
      httpStatus: 500,
    });
    res.status(500).json({
      success: false,
      message: 'Unable to load your account right now. Please try again.',
    });
  }
};
