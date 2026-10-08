import { Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Company from '../models/Company';
import { AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../utils/email';
import { v4 as uuidv4 } from 'uuid';
import { checkMemberLimit } from '../utils/planLimits';
import {
  isR2Configured,
  uploadFile as r2Upload,
  deleteFile as r2Delete,
  generateSignedAvatarUrl,
} from '../services/r2Storage';
import { refreshAvatarUrls } from '../services/avatarUrls';
import { ensureUserCallingId, isValidCallingId, normalizeCallingId } from '../services/callingId';
import { publishUserPresence } from '../utils/socket';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { department, role, status, search } = req.query;
    const filter: any = { companyId: req.user!.companyId, isActive: true };
    if (department) filter.department = department;
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { jobTitle: { $regex: search, $options: 'i' } },
      { callingId: { $regex: search, $options: 'i' } },
    ];

    // Pagination: cap at 200 per request to prevent full-collection dumps
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const page = Math.max(1, Number(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).select({ phone: 0 })
        .select('-refreshTokens -password -verificationToken -resetPasswordToken -mfaSecretEncrypted -mfaTempSecretEncrypted -recoveryCodesHashed')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const usersWithCallingIds = await Promise.all(users.map(async (user) => ({
      ...user,
      callingId: user.callingId || await ensureUserCallingId(user._id),
    })));
    res.json({ success: true, users: await refreshAvatarUrls(usersWithCallingIds), total, page, totalPages: Math.ceil(total / limit) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Enter a valid user ID.' });
      return;
    }
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
      isActive: true,
      isDeleted: { $ne: true },
    })
      .select('-refreshTokens -password -verificationToken -resetPasswordToken')
      .select({ phone: 0 })
      .lean();
    if (!user) {
      res.status(404).json({
        success: false,
        code: 'WORKSPACE_MEMBER_NOT_FOUND',
        message: 'No active user with that ID was found.',
      });
      return;
    }
    res.json({ success: true, user: await refreshAvatarUrls(user) });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const getUserByPublicId = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const callingId = normalizeCallingId(req.params.callingId);
    if (!isValidCallingId(callingId)) {
      res.status(400).json({ success: false, code: 'INVALID_USER_ID', message: 'Enter a valid WorkGrind User ID.' });
      return;
    }

    const user = await User.findOne({
      callingId,
      isActive: true,
      isDeleted: { $ne: true },
    }).select('_id callingId fullName avatar avatarStorageKey jobTitle blockedUsers').lean();
    if (!user) {
      res.status(404).json({
        success: false,
        code: 'WORKGRIND_USER_NOT_FOUND',
        message: 'No active WorkGrind user was found for that ID.',
      });
      return;
    }

    const requester = await User.findById(req.user!.userId).select('blockedUsers');
    const isBlocked = requester?.blockedUsers?.some((blockedId) => blockedId.equals(user._id));
    const blockedRequester = user.blockedUsers?.some((blockedId) => blockedId.toString() === req.user!.userId);
    if (isBlocked || blockedRequester) {
      res.status(404).json({
        success: false,
        code: 'WORKGRIND_USER_NOT_FOUND',
        message: 'No active WorkGrind user was found for that ID.',
      });
      return;
    }

    const refreshed = await refreshAvatarUrls({
      callingId: user.callingId,
      fullName: user.fullName,
      avatar: user.avatar,
      avatarStorageKey: user.avatarStorageKey,
      jobTitle: user.jobTitle,
    });
    res.json({
      success: true,
      user: {
        callingId: refreshed.callingId,
        fullName: refreshed.fullName,
        avatar: refreshed.avatar,
        jobTitle: refreshed.jobTitle,
      },
    });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = ['fullName', 'avatar', 'jobTitle', 'department', 'phone', 'country', 'timeZone', 'bio', 'skills', 'notificationPreferences', 'preferredLanguage', 'theme', 'workspaceProfile', 'incomingCallPrivacy'];
    const updates: any = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.avatar !== undefined) updates.avatarStorageKey = undefined;

    if (updates.fullName !== undefined) {
      if (typeof updates.fullName !== 'string' || !updates.fullName.trim()) {
        res.status(400).json({ success: false, message: 'Name cannot be empty.' });
        return;
      }
      updates.fullName = updates.fullName.trim();
    }
    if (updates.phone !== undefined) {
      const phoneInput = typeof updates.phone === 'string' ? updates.phone.trim() : '';
      if (!phoneInput) {
        updates.phone = undefined;
      } else {
        const normalizedPhone = parsePhoneNumberFromString(phoneInput);
        if (!normalizedPhone?.isValid()) {
          res.status(400).json({ success: false, message: 'Enter a valid international mobile number, including its country code.' });
          return;
        }
        updates.phone = normalizedPhone.number;
      }
    }

    const validThemes = ['original', 'midnight', 'slate', 'forest', 'ocean', 'sand', 'plum', 'high-contrast', 'light', 'aurora', 'graphite', 'dark', 'neutral', 'developer', 'creative', 'marketing', 'sales', 'project_manager', 'freelancer', 'executive', 'student', 'professional'];
    const validWorkspaceProfiles = ['developer', 'creative', 'marketing', 'sales', 'project_manager', 'freelancer', 'executive', 'student', 'professional'];
    const validLanguages = ['en', 'ur', 'ar', 'fr', 'de', 'es', 'zh', 'hi'];
    if (updates.theme !== undefined && !validThemes.includes(updates.theme)) {
      res.status(400).json({ success: false, message: 'Invalid theme selection.' });
      return;
    }
    if (updates.workspaceProfile !== undefined && !validWorkspaceProfiles.includes(updates.workspaceProfile)) {
      res.status(400).json({ success: false, message: 'Invalid workspace profile.' });
      return;
    }
    if (updates.preferredLanguage !== undefined && !validLanguages.includes(updates.preferredLanguage)) {
      res.status(400).json({ success: false, message: 'Invalid language selection.' });
      return;
    }
    if (updates.incomingCallPrivacy !== undefined && !['everyone', 'contacts', 'nobody'].includes(updates.incomingCallPrivacy)) {
      res.status(400).json({ success: false, message: 'Invalid incoming call privacy setting.' });
      return;
    }
    if (updates.notificationPreferences !== undefined) {
      const preferenceKeys = ['taskAssigned', 'meetingReminder', 'newMessage', 'dealUpdate'];
      if (!updates.notificationPreferences || preferenceKeys.some(
        (key) => typeof updates.notificationPreferences[key] !== 'boolean'
      )) {
        res.status(400).json({ success: false, message: 'Invalid notification preferences.' });
        return;
      }
    }

    const updateDocument: Record<string, unknown> = { $set: updates };
    if (updates.phone === undefined && req.body.phone !== undefined) {
      delete updates.phone;
      updateDocument.$unset = { phone: 1 };
    }
    const user = await User.findByIdAndUpdate(req.user!.userId, updateDocument, {
      new: true,
      runValidators: true,
    }).select('-refreshTokens -password -verificationToken -resetPasswordToken');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    res.json({ success: true, user: await refreshAvatarUrls(user.toObject()) });
  } catch (e: any) {
    if (e?.code === 11000 && e?.keyPattern?.phone) {
      res.status(409).json({ success: false, message: 'That mobile number is already linked to an account.' });
      return;
    }
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deactivateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, confirmEmail } = req.body;
    if (!password || !confirmEmail) {
      res.status(400).json({ success: false, message: 'Password and email confirmation are required.' });
      return;
    }

    const user = await User.findById(req.user!.userId).select('+password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.email.toLowerCase() !== String(confirmEmail).trim().toLowerCase()) {
      res.status(400).json({ success: false, message: 'Email confirmation does not match your account email.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Password is incorrect.' });
      return;
    }

    user.isActive = false;
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = 'offline';
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true, message: 'Your account has been deactivated.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No avatar uploaded.' });
      return;
    }

    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ success: false, message: 'Only image files are allowed as profile pictures.' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({ success: false, message: 'Unsupported image type. Use JPG, PNG, GIF, or WEBP.' });
      return;
    }

    if (req.file.size > 2 * 1024 * 1024) {
      res.status(400).json({ success: false, message: 'Profile photo must be smaller than 2MB.' });
      return;
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (isR2Configured()) {
      const { key } = await r2Upload({
        companyId: req.user!.companyId,
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });

      if (user.avatarStorageKey && user.avatarStorageKey !== key) {
        try { await r2Delete(user.avatarStorageKey); } catch { /* ignore cleanup errors */ }
      }

      const signedUrl = await generateSignedAvatarUrl(key);
      user.avatar = signedUrl;
      user.avatarStorageKey = key;
    } else {
      user.avatar = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      user.avatarStorageKey = undefined;
    }

    await user.save();

    const safeUser = await User.findById(req.user!.userId)
      .select('-refreshTokens -password -verificationToken -resetPasswordToken')
      .lean();

    const refreshedUser = await refreshAvatarUrls(safeUser);
    res.json({ success: true, avatar: refreshedUser?.avatar ?? user.avatar, user: refreshedUser });
  } catch (e: any) {
    console.error('[uploadAvatar] Error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['online', 'away', 'busy', 'offline'].includes(status)) { res.status(400).json({ success: false, message: 'Invalid status' }); return; }
    await User.findOneAndUpdate({ _id: req.user!.userId, isActive: true, isDeleted: { $ne: true } }, { status });
    await publishUserPresence(req.user!.userId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const inviteMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, role = 'employee' } = req.body;
    if (!email) { res.status(400).json({ success: false, message: 'Email required' }); return; }
    const company = await Company.findById(req.user!.companyId);
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    // ── Plan-based member limit check ─────────────────────────────────────
    const memberCheck = await checkMemberLimit(req.user!.userId, company._id.toString());
    if (!memberCheck.allowed) {
      res.status(403).json({
        success:         false,
        message:         memberCheck.reason,
        code:            memberCheck.code,
        requiresUpgrade: memberCheck.upgrade ?? false,
      });
      return;
    }

    const inviter = await User.findById(req.user!.userId);
    const token = uuidv4();
    company.pendingInvites.push({ email, token, expiresAt: new Date(Date.now() + 7 * 86400000), role });
    await company.save();
    await sendInviteEmail(email, inviter?.fullName || 'Someone', company.name, token);
    res.json({ success: true, message: 'Invitation sent' });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};
