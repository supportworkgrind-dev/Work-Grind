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
import Company from '../models/Company';
import { TRIAL_DAYS } from '../config/subscription';
import { checkMemberLimit } from '../utils/planLimits';
import Channel from '../models/Channel';
import Project from '../models/Project';
import Task from '../models/Task';
import Message from '../models/Message';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendVerificationEmail, sendVerificationCodeEmail, sendPasswordResetEmail, sendPasswordChangedNotificationEmail, sendWelcomeEmail } from '../utils/email';
import { AuthRequest } from '../middleware/auth';
import { refreshAvatarUrls } from '../services/avatarUrls';
const issue = (userId: string, companyId: string, role: string) => ({
  accessToken: generateAccessToken({ userId, companyId, role }),
  refreshToken: generateRefreshToken({ userId, companyId, role }),
});

const validPassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) &&
  /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

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
    },
  };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const genericResponse = {
      success: true,
      message: 'If these details can be registered, an email verification code will be sent.',
    };

    if (!fullName || fullName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      res.status(400).json({ success: false, message: 'Enter a valid name, email, and password with at least 8 characters including uppercase, lowercase, a number, and a symbol.' });
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
    void sendVerificationCodeEmail(email, fullName, code).then((result) => {
      if (!result.success) console.error('[Auth] Verification code email delivery failed.');
    });
    res.status(202).json(genericResponse);
  } catch (error) {
    if ((error as any)?.code === 11000) {
      res.status(202).json({ success: true, message: 'If this address can be registered, a verification code will be sent.' });
      return;
    }
    console.error('[Auth] Registration request failed:', error);
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
    res.json({ success: true, ...tokens, user: {
      _id: user._id,
      callingId: user.callingId,
      fullName: user.fullName,
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
    } });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(401).json({ success: false, message: 'Refresh token required' }); return; }
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = user?.refreshTokens.find((stored) => stored === tokenHash || stored === refreshToken);
    if (!user || !storedToken || !user.isVerified || !user.isActive || user.isDeleted) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    const tokens = issue(user._id.toString(), user.companyId?.toString() || '', user.role);
    const remainingTokens = normalizeRefreshTokenStore(user.refreshTokens)
      .filter((stored) => stored !== tokenHash && stored !== storedToken);
    const updated = await User.findOneAndUpdate(
      { _id: user._id, refreshTokens: user.refreshTokens },
      { $set: { refreshTokens: [...remainingTokens, hashRefreshToken(tokens.refreshToken)] } },
      { new: true },
    );
    if (!updated) { res.status(401).json({ success: false, message: 'Invalid refresh token' }); return; }
    res.json({ success: true, ...tokens });
  } catch { res.status(401).json({ success: false, message: 'Invalid or expired refresh token' }); }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
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
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
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
      res.json({
        success: true,
        ...tokens,
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
      isVerified: true,
      isSuperAdmin: false,
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'free',
      trialStartDate,
      trialEndDate,
    });
    const session = await sessionForUser(user);
    void sendWelcomeEmail(user.email, user.fullName).then((result) => {
      if (!result.success) console.error('[Auth] Welcome email delivery failed.');
    });
    res.json({ success: true, ...session });
  } catch (error) {
    console.error('[Auth] Email verification failed:', error);
    res.status(500).json({ success: false, message: 'Unable to verify this code. Please try again.' });
  }
};

export const resendRegistrationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericResponse = {
      success: true,
      message: 'If a pending signup exists for this address, a new verification code will be sent.',
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
        void sendVerificationCodeEmail(email, existingUser.fullName, code).then((result) => {
          if (!result.success) console.error('[Auth] Verification code email delivery failed.');
        });
      }
      res.status(202).json(genericResponse);
      return;
    }
    void sendVerificationCodeEmail(email, pending.fullName, code).then((result) => {
      if (!result.success) console.error('[Auth] Verification code email delivery failed.');
    });
    res.status(202).json(genericResponse);
  } catch (error) {
    console.error('[Auth] Verification code resend failed:', error);
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
      // Non-blocking email send so API responds instantly without waiting for network/SMTP
      sendPasswordResetEmail(user.email, user.fullName, rawToken).catch((err) =>
        console.error('❌ Error sending password reset email:', err)
      );
    }
    // Always return the same message (security: don't reveal if email exists)
    res.json({ success: true, message: 'If that email is registered, a reset link was sent.' });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
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

    const issuedAt = user && user.resetPasswordExpiry ? new Date(user.resetPasswordExpiry.getTime() - 30 * 60 * 1000) : null;
    console.log('[resetPassword debug]', {
      issuedAt: issuedAt?.toISOString() ?? null,
      expiry: user?.resetPasswordExpiry ? user.resetPasswordExpiry.toISOString() : null,
      now: new Date().toISOString(),
    });

    if (!user || !user.resetPasswordExpiry || user.resetPasswordExpiry.getTime() <= Date.now()) {
      res.status(400).json({ success: false, message: 'Reset link is invalid or has expired. Please request a new one.' });
      return;
    }

    if (!user) {
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

    // Send confirmation email (non-blocking)
    sendPasswordChangedNotificationEmail(user.email, user.fullName).catch(err =>
      console.error('❌ Post-reset notification email failed:', err)
    );

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

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.userId;
    const { name, industry, size, country, timeZone, accountType = 'company' } = req.body;
    const user = await User.findById(uid);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    // Defensive Idempotency: If user already has a company, return it gracefully rather than crashing with 400
    if (user.companyId) {
      const existingCompany = await Company.findById(user.companyId);
      if (existingCompany) {
        const tokens = issue(uid, existingCompany._id.toString(), user.role || 'owner');
        res.status(200).json({
          success: true,
          message: 'Workspace already exists for this account',
          company: existingCompany,
          user: {
            _id: user._id,
            callingId: user.callingId,
            fullName: user.fullName,
            email: user.email,
            companyId: user.companyId,
            role: user.role,
            accountType: user.accountType || existingCompany.accountType,
            theme: user.theme,
            workspaceProfile: user.workspaceProfile,
          },
          ...tokens,
        });
        return;
      }
    }

    const isIndividual = accountType === 'individual';
    const workspaceName = name?.trim() || (isIndividual ? `${user.fullName}'s Workspace` : '');
    if (!workspaceName) {
      res.status(400).json({ success: false, message: 'Company or organization name is required' });
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
      inviteCode: uuidv4().split('-')[0].toUpperCase(),
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'free',
      trialStartDate: user.trialStartDate ?? user.createdAt,
      trialEndDate: user.trialEndDate ?? new Date(
        (user.trialStartDate ?? user.createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
      ),
    });

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

    // Update user in a SINGLE save call
    const tokens = issue(uid, company._id.toString(), 'owner');
    user.companyId = company._id;
    user.role = 'owner';
    user.accountType = isIndividual ? 'individual' : 'company';
    user.refreshTokens = [hashRefreshToken(tokens.refreshToken)];
    await user.save();

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
        theme: user.theme,
        workspaceProfile: user.workspaceProfile,
      },
      ...tokens,
    });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
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
        // Role ceiling: never assign a role higher than 'admin' via invite (owner is set only on workspace creation)
        const safeRoles = ['employee', 'manager', 'admin', 'guest'];
        assignedRole = safeRoles.includes(invite.role) ? invite.role : 'employee';
      }
      // Consume the invite token so it cannot be reused
      company.pendingInvites = company.pendingInvites.filter((i) => i.token !== codeOrToken);
    } else {
      company = await Company.findOne({
        inviteCode: codeOrToken.trim().toUpperCase(),
        isActive: true,
      });

      if (company) {
        const safeRoles = ['employee', 'manager', 'admin', 'guest'];
        const defaultRole = company.settings?.defaultRole || 'employee';
        assignedRole = safeRoles.includes(defaultRole) ? defaultRole : 'employee';
      }
    }

    if (!company) {
      res.status(400).json({ success: false, message: 'Invalid or expired invite' });
      return;
    }

    const memberCheck = await checkMemberLimit(uid, company._id.toString(), {
      excludePendingInviteToken: inviteToken || undefined,
    });
    if (!memberCheck.allowed) {
      res.status(403).json({
        success: false,
        code: memberCheck.code,
        message: memberCheck.reason,
        current: memberCheck.current,
        limit: memberCheck.limit,
        requiresUpgrade: memberCheck.upgrade ?? false,
      });
      return;
    }

    joiningUser.companyId = company._id;
    joiningUser.role = assignedRole as any;
    await joiningUser.save();
    await company.save();

    await Channel.updateMany({ companyId: company._id, isDefault: true }, { $addToSet: { members: uid } });

    const tokens = issue(uid, company._id.toString(), joiningUser.role);
    joiningUser.refreshTokens = [hashRefreshToken(tokens.refreshToken)];
    await joiningUser.save();

    res.json({ success: true, company, role: joiningUser.role, ...tokens });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).populate(
      'companyId',
      'name logo plan inviteCode accountType industry size country timeZone settings'
    );
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    if (!user.callingId) user.callingId = await ensureUserCallingId(user._id);

    // Auto-expire trial inline on every /auth/me call
    if (
      user.subscriptionStatus === 'trialing' &&
      user.trialEndDate &&
      new Date() > user.trialEndDate
    ) {
      user.subscriptionStatus = 'expired';
      await user.save();
    }

    // Compute trial days remaining
    let trialDaysRemaining: number | null = null;
    if (user.subscriptionStatus === 'trialing' && user.trialEndDate) {
      const msLeft = user.trialEndDate.getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    res.set({
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Vary: 'Authorization',
    });
    res.json({ success: true, user: await refreshAvatarUrls(user.toObject()), trialDaysRemaining });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};
