import { Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import Project from '../models/Project';
import Task from '../models/Task';
import { AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../utils/email';
import { v4 as uuidv4 } from 'uuid';
import { isOrganizationType } from '../config/organization';

export const getCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const company = await Company.findById(req.user!.companyId);
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
    if (req.body.organizationType !== undefined && !isOrganizationType(req.body.organizationType)) {
      res.status(400).json({ success: false, message: 'Organization type must be business, school, college, or university.' });
      return;
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
    const allowed = ['name', 'logo', 'industry', 'size', 'country', 'timeZone', 'currency', 'settings', 'accountType', 'organizationType'];
    const updates: any = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.academicSettings !== undefined) {
      Object.entries(req.body.academicSettings).forEach(([key, value]) => {
        updates[`academicSettings.${key}`] = value;
      });
    }

    const company = await Company.findByIdAndUpdate(req.user!.companyId, updates, { new: true, runValidators: true });
    if (updates.accountType) {
      await User.findByIdAndUpdate(req.user!.userId, { accountType: updates.accountType });
    }
    res.json({ success: true, company });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCompanyMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Pagination support: default 100 members per page to avoid fetching entire collection at once
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      User.find({ companyId: req.user!.companyId, isActive: true })
        .select('fullName email avatar jobTitle department role status lastSeen skills country timeZone bio')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ companyId: req.user!.companyId, isActive: true }),
    ]);

    res.json({ success: true, members, total, page, totalPages: Math.ceil(total / limit) });
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
    await User.findOneAndUpdate(
      { _id: userId, companyId: req.user!.companyId },
      { isActive: false, status: 'offline', companyId: null }
    );
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
