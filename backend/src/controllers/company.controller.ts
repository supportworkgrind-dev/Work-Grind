import { Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import Project from '../models/Project';
import Task from '../models/Task';
import { AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../utils/email';
import { v4 as uuidv4 } from 'uuid';
import {
  isOrganizationRoleEligible,
  isOrganizationType,
  roleMatches,
} from '../config/organization';
import { parsePagination } from '../utils/pagination';

export const getCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const company = await Company.findById(req.user!.companyId)
      .select([
        '-inviteCode',
        '-pendingInvites',
        '-plan',
        '-subscriptionStatus',
        '-subscriptionPlan',
        '-subscriptionStartDate',
        '-subscriptionEndDate',
        '-pendingSubscriptionPlan',
        '-pendingSubscriptionPlanEffectiveDate',
        '-trialStartDate',
        '-trialEndDate',
        '-cancelAtPeriodEnd',
        '-polarCustomerId',
        '-polarSubscriptionId',
        '-polarProductId',
        '-polarOrderId',
        '-coupon',
        '-isLifetime',
      ].join(' '));
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    res.json({ success: true, company });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const company = await Company.findById(req.user!.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    if (req.body.organizationType !== undefined && !isOrganizationType(req.body.organizationType)) {
      res.status(400).json({ success: false, message: 'Organization type must be business, school, college, or university.' });
      return;
    }
    if (req.body.accountType !== undefined && !['company', 'individual'].includes(req.body.accountType)) {
      res.status(400).json({ success: false, message: 'Account type must be company or individual.' });
      return;
    }
    const requestedOrganizationType = req.body.organizationType ?? company.organizationType;
    const requestedAccountType = req.body.accountType ?? company.accountType;
    const classificationChanged = requestedOrganizationType !== company.organizationType ||
      requestedAccountType !== company.accountType;
    if (classificationChanged && company.ownerId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Only the workspace owner can change organization classification.' });
      return;
    }
    if (requestedAccountType === 'individual' && requestedOrganizationType !== 'business') {
      res.status(400).json({ success: false, message: 'Solo workspaces must use the business organization type.' });
      return;
    }
    if (classificationChanged) {
      const members = await User.find({ companyId: company._id, isActive: true }).select('role');
      if (members.some((member) => !isOrganizationRoleEligible(member.role, requestedOrganizationType))) {
        res.status(409).json({
          success: false,
          message: 'Organization type cannot be changed while active members have roles that are not eligible for the new type.',
        });
        return;
      }
    }
    if (req.body.currency !== undefined && (typeof req.body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(req.body.currency))) {
      res.status(400).json({ success: false, message: 'Currency must be a three-letter ISO currency code.' });
      return;
    }
    if (req.body.timeZone !== undefined) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: req.body.timeZone });
      } catch {
        res.status(400).json({ success: false, message: 'Time zone must be a valid IANA time zone.' });
        return;
      }
    }
    if (req.body.academicSettings !== undefined) {
      const academicSettings = req.body.academicSettings;
      if (
        !academicSettings ||
        typeof academicSettings !== 'object' ||
        Array.isArray(academicSettings) ||
        (academicSettings.academicYearStartMonth !== undefined &&
          (!Number.isInteger(academicSettings.academicYearStartMonth) || academicSettings.academicYearStartMonth < 1 || academicSettings.academicYearStartMonth > 12)) ||
        (academicSettings.gradingScale !== undefined &&
          !['percentage', 'letter', 'points', 'pass_fail'].includes(academicSettings.gradingScale)) ||
        Object.keys(academicSettings).some((key) => !['academicYearStartMonth', 'gradingScale'].includes(key))
      ) {
        res.status(400).json({ success: false, message: 'Academic settings contain an unsupported value.' });
        return;
      }
    }
    if (req.body.settings !== undefined) {
      const settings = req.body.settings;
      const allowedDefaultRoles = requestedOrganizationType === 'business'
        ? ['employee', 'guest']
        : ['employee', 'guest', 'student'];
      if (
        !settings ||
        typeof settings !== 'object' ||
        Array.isArray(settings) ||
        (settings.allowGuestAccess !== undefined && typeof settings.allowGuestAccess !== 'boolean') ||
        (settings.defaultRole !== undefined &&
          (!allowedDefaultRoles.includes(settings.defaultRole) ||
            !isOrganizationRoleEligible(settings.defaultRole, requestedOrganizationType))) ||
        Object.keys(settings).some((key) => !['allowGuestAccess', 'defaultRole'].includes(key))
      ) {
        res.status(400).json({ success: false, message: 'Workspace settings contain an unsupported value.' });
        return;
      }
    }

    const allowed = ['name', 'logo', 'industry', 'size', 'country', 'timeZone', 'currency', 'accountType', 'organizationType'];
    const updates: any = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.settings !== undefined) {
      if (req.body.settings.allowGuestAccess !== undefined) updates['settings.allowGuestAccess'] = req.body.settings.allowGuestAccess;
      if (req.body.settings.defaultRole !== undefined) updates['settings.defaultRole'] = req.body.settings.defaultRole;
    }
    if (req.body.academicSettings !== undefined) {
      Object.entries(req.body.academicSettings).forEach(([key, value]) => {
        updates[`academicSettings.${key}`] = value;
      });
    }

    const updatedCompany = await Company.findByIdAndUpdate(req.user!.companyId, updates, { new: true, runValidators: true });
    if (classificationChanged) {
      await User.updateMany({ companyId: company!._id }, { accountType: requestedAccountType });
    }
    res.json({ success: true, company: updatedCompany });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCompanyMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 100, maxLimit: 200 });
    if (!pagination) {
      res.status(400).json({ success: false, message: 'Invalid pagination parameters.' });
      return;
    }

    const [members, total] = await Promise.all([
      User.find({ companyId: req.user!.companyId, isActive: true })
        .select('fullName email avatar jobTitle department role status lastSeen skills country timeZone bio')
        .sort({ fullName: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments({ companyId: req.user!.companyId, isActive: true }),
    ]);

    res.json({
      success: true,
      members,
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      hasMore: pagination.skip + members.length < total,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (userId === req.user!.userId) {
      res.status(400).json({ success: false, message: 'Cannot remove yourself' });
      return;
    }
    const company = await Company.findById(req.user!.companyId).select('ownerId organizationType');
    const member = await User.findOne({ _id: userId, companyId: req.user!.companyId }).select('_id role');
    if (!company || !member) {
      res.status(404).json({ success: false, message: 'Organization member not found.' });
      return;
    }
    const actorOwnsOrganization = company.ownerId.toString() === req.user!.userId;
    if (
      member._id.toString() === company.ownerId.toString() ||
      (!actorOwnsOrganization && roleMatches(
        member.role,
        ['owner', 'admin', 'manager', 'principal', 'dean', 'hod'],
        company.organizationType,
      ))
    ) {
      res.status(403).json({ success: false, message: 'You cannot remove this member.' });
      return;
    }
    const removed = await User.findOneAndUpdate(
      { _id: userId, companyId: req.user!.companyId },
      { isActive: false, status: 'offline', companyId: null }
    );
    if (!removed) {
      res.status(404).json({ success: false, message: 'Organization member not found.' });
      return;
    }
    res.json({ success: true, message: 'Member removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCompanyStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const [totalMembers, activeProjects, totalTasks, completedTasks] = await Promise.all([
      User.countDocuments({ companyId, isActive: true }),
      Project.countDocuments({ companyId, status: 'active', isArchived: false }),
      Task.countDocuments({ companyId, isArchived: false }),
      Task.countDocuments({ companyId, status: 'completed', isArchived: false }),
    ]);

    res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    res.json({
      success: true,
      stats: {
        totalMembers,
        activeProjects,
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCompanyInvites = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const company = await Company.findById(req.user!.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    const now = new Date();
    const activeInvites = (company.pendingInvites || []).filter((i) => new Date(i.expiresAt) > now);
    res.json({ success: true, invites: activeInvites, inviteCode: company.inviteCode });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const revokeInvite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const company = await Company.findById(req.user!.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    company.pendingInvites = company.pendingInvites.filter((i) => i.token !== token);
    await company.save();
    res.json({ success: true, message: 'Invite revoked successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resendInvite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const company = await Company.findById(req.user!.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    const invite = company.pendingInvites.find((i) => i.token === token);
    if (!invite) {
      res.status(404).json({ success: false, message: 'Invite not found' });
      return;
    }
    // Refresh expiration to 7 days from now
    invite.expiresAt = new Date(Date.now() + 7 * 86400000);
    await company.save();
    const inviter = await User.findById(req.user!.userId);
    await sendInviteEmail(invite.email, inviter?.fullName || 'A teammate', company.name, invite.token);
    res.json({ success: true, message: 'Invite resent successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const regenerateInviteCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const company = await Company.findById(req.user!.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    company.inviteCode = uuidv4().split('-')[0].toUpperCase();
    await company.save();
    res.json({ success: true, inviteCode: company.inviteCode, message: 'Invite code regenerated' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
