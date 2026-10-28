import { Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Company from '../models/Company';
import { AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../utils/email';
import { v4 as uuidv4 } from 'uuid';
import { checkMemberLimit, withCompanyCapacityLock } from '../utils/planLimits';
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
import { canAssignOrganizationRole, normalizeOrganizationRole, resolveDefaultJoinRole } from '../config/organization';

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

const PROFILE_TEXT_MAX_LENGTH = 100;
const PROFILE_BIO_MAX_LENGTH = 500;
const PROFILE_SKILLS_MAX = 30;
const PROFILE_SKILL_MAX_LENGTH = 50;
const PROFILE_FIELD_LABELS = { jobTitle: 'Job title', department: 'Department', country: 'Country' } as const;

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = ['fullName', 'avatar', 'jobTitle', 'department', 'phone', 'country', 'timeZone', 'bio', 'skills', 'notificationPreferences', 'preferredLanguage', 'theme', 'workspaceProfile', 'incomingCallPrivacy'];
    const updates: any = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    // Photos are set only through PATCH /me/avatar, which validates and stores
    // the file. Here an empty value removes the photo; any other value is
    // ignored so a client cannot point other members at an arbitrary URL.
    if (updates.avatar !== undefined) {
      if (updates.avatar === '') updates.avatarStorageKey = undefined;
      else delete updates.avatar;
    }

    for (const field of ['jobTitle', 'department', 'country'] as const) {
      if (updates[field] === undefined) continue;
      if (typeof updates[field] !== 'string' || updates[field].trim().length > PROFILE_TEXT_MAX_LENGTH) {
        res.status(400).json({ success: false, message: `${PROFILE_FIELD_LABELS[field]} must be text of at most ${PROFILE_TEXT_MAX_LENGTH} characters.` });
        return;
      }
      updates[field] = updates[field].trim();
    }
    if (updates.bio !== undefined) {
      if (typeof updates.bio !== 'string' || updates.bio.length > PROFILE_BIO_MAX_LENGTH) {
        res.status(400).json({ success: false, message: `Bio must be at most ${PROFILE_BIO_MAX_LENGTH} characters.` });
        return;
      }
    }
    if (updates.skills !== undefined) {
      const skills = Array.isArray(updates.skills) ? updates.skills : null;
      if (!skills || skills.length > PROFILE_SKILLS_MAX ||
        skills.some((skill: unknown) => typeof skill !== 'string' || !skill.trim() || skill.trim().length > PROFILE_SKILL_MAX_LENGTH)) {
        res.status(400).json({ success: false, message: `List up to ${PROFILE_SKILLS_MAX} skills of at most ${PROFILE_SKILL_MAX_LENGTH} characters each.` });
        return;
      }
      updates.skills = [...new Set(skills.map((skill: string) => skill.trim()))];
    }
    if (updates.timeZone !== undefined) {
      if (typeof updates.timeZone !== 'string' || (updates.timeZone && !isValidTimeZone(updates.timeZone))) {
        res.status(400).json({ success: false, message: 'Choose a valid IANA time zone, such as Asia/Karachi.' });
        return;
      }
    }

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
    if (e?.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Some profile fields are invalid. Check them and try again.' });
      return;
    }
    console.error('[Users] Profile update failed.', { errorName: e?.name });
    res.status(500).json({ success: false, message: 'Your profile could not be saved. Please try again.' });
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

    // There is no ownership transfer yet, so deactivating the owner would leave
    // the workspace with nobody able to administer or bill it.
    if (user.companyId) {
      const ownsWorkspace = await Company.exists({ _id: user.companyId, ownerId: user._id });
      if (ownsWorkspace) {
        res.status(409).json({
          success: false,
          code: 'WORKSPACE_OWNER_CANNOT_DEACTIVATE',
          message: 'Workspace owners cannot deactivate their account while they own the workspace.',
        });
        return;
      }
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
    const { email } = req.body;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ success: false, message: 'Enter a valid email address to invite.', errors: { email: 'Enter a valid email address to invite.' } });
      return;
    }
    const company = await Company.findById(req.user!.companyId);
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    const role = req.body.role ?? resolveDefaultJoinRole(company.organizationType, company.settings?.defaultRole, company.accountType);
    const assignedRole = normalizeOrganizationRole(role, company.organizationType, '');
    const isOwner = company.ownerId.toString() === req.user!.userId;
    if (!canAssignOrganizationRole(req.user!.role, role, company.organizationType, isOwner)) {
      res.status(403).json({
        success: false,
        message: 'This role is not eligible for the organization or cannot be assigned by your role.',
      });
      return;
    }

    const admission = await withCompanyCapacityLock(company._id.toString(), async () => {
      const lockedCompany = await Company.findById(company._id);
      if (!lockedCompany) throw new Error('Company not found while reserving capacity.');
      const memberCheck = await checkMemberLimit(req.user!.userId, company._id.toString(), { role: assignedRole });
      if (!memberCheck.allowed) return { allowed: false as const, memberCheck };

      const inviter = await User.findById(req.user!.userId);
      const token = uuidv4();
      lockedCompany.pendingInvites.push({
        email: email.trim().toLowerCase(),
        token,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        role: assignedRole,
        inviterId: new mongoose.Types.ObjectId(req.user!.userId),
      });
      await lockedCompany.save();
      return { allowed: true as const, token, inviterName: inviter?.fullName || 'Someone' };
    });
    if (!admission.allowed) {
      res.status(403).json({
        success:         false,
        message:         admission.memberCheck.reason,
        code:            admission.memberCheck.code,
        requiresUpgrade: admission.memberCheck.upgrade ?? false,
      });
      return;
    }

    // Only report success once the provider accepted the email; the pending
    // invitation stays saved either way so it can be resent.
    const delivery = await sendInviteEmail(email.trim().toLowerCase(), admission.inviterName, company.name, admission.token);
    if (!delivery.success) {
      res.status(502).json({ success: false, code: 'INVITE_EMAIL_FAILED', message: 'The invitation was saved, but its email could not be delivered. Check the workspace email settings, then resend it from Pending invitations.' });
      return;
    }
    res.json({ success: true, message: 'Invitation sent' });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};
