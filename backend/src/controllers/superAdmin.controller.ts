import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Company from '../models/Company';
import Project from '../models/Project';
import Task from '../models/Task';
import Message from '../models/Message';
import FileModel from '../models/File';
import SupportTicket from '../models/SupportTicket';
import AuditLog from '../models/AuditLog';
import { CrmContact } from '../models/CrmContact';
import { CrmDeal }    from '../models/CrmDeal';
import { CrmCompany } from '../models/CrmCompany';
import { generateAccessToken, generateMfaChallengeToken, verifyAccessToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { getTransporter, sendAdminReplyEmail } from '../utils/email';
import { getPlatformAiUsage, getUsageSummaryForCompany, getUsageForCompany } from '../services/aiUsageTracker';
import { getCompanySubscription } from '../services/companySubscription';
import { getPlanUsage } from '../utils/planLimits';
import {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  generateTotpProvisioning,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyAndConsumeRecoveryCode,
} from '../utils/mfa';

// ── 1. SUPER ADMIN AUTHENTICATION ──────────────────────────────────────────

export const loginSuperAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password +mfaSecretEncrypted +recoveryCodesHashed');

    // Never disclose if user exists or if they are super admin
    if (!user || !user.isSuperAdmin) {
      res.status(401).json({ success: false, message: 'Invalid administrator credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Administrator account has been suspended' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid administrator credentials' });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ success: false, message: 'Verify the administrator email address before signing in.' });
      return;
    }
    if (user.mfaEnabled) {
      res.json({
        success: true,
        mfaRequired: true,
        challengeToken: generateMfaChallengeToken(user._id.toString(), user.companyId?.toString() || ''),
      });
      return;
    }

    // Generate Dedicated Super Admin Token (12 hour expiration)
    const token = generateAccessToken({
      userId: user._id.toString(),
      companyId: user.companyId?.toString() || '',
      role: 'super_admin',
      isSuperAdmin: true,
    });

    user.lastLogin = new Date();
    user.lastSeen = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      admin: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: 'super_admin',
        isSuperAdmin: true,
        mfaEnabled: Boolean(user.mfaEnabled),
        lastLogin: user.lastLogin,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifySuperAdminMfaLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const payload = verifyAccessToken(challengeToken);
    if (!payload.mfaPending || !payload.isSuperAdmin) {
      res.status(401).json({ success: false, message: 'Invalid or expired authentication challenge.' });
      return;
    }

    const user = await User.findById(payload.userId)
      .select('+mfaSecretEncrypted +recoveryCodesHashed +mfaFailedAttempts +mfaLockoutUntil');
    if (!user || !user.isSuperAdmin || !user.isActive || !user.mfaEnabled || !user.isVerified) {
      res.status(401).json({ success: false, message: 'Invalid or expired authentication challenge.' });
      return;
    }
    if (user.mfaLockoutUntil && user.mfaLockoutUntil.getTime() > Date.now()) {
      res.status(429).json({ success: false, message: 'Multi-factor sign-in is temporarily locked. Try again later.' });
      return;
    }

    let valid = false;
    if (user.mfaSecretEncrypted && /^\d{6}$/.test(code)) {
      valid = verifyTotp(code, decryptSecret(user.mfaSecretEncrypted));
    }
    if (!valid && user.recoveryCodesHashed?.length) {
      const recoveryHash = hashRecoveryCode(code);
      const consumed = await User.findOneAndUpdate(
        { _id: user._id, recoveryCodesHashed: recoveryHash },
        { $pull: { recoveryCodesHashed: recoveryHash } },
        { new: true },
      );
      valid = Boolean(consumed);
    }
    if (!valid) {
      const failures = (user.mfaFailedAttempts || 0) + 1;
      await User.findByIdAndUpdate(user._id, {
        $set: {
          mfaFailedAttempts: failures >= 5 ? 0 : failures,
          ...(failures >= 5 ? { mfaLockoutUntil: new Date(Date.now() + 15 * 60_000) } : {}),
        },
      });
      res.status(401).json({ success: false, message: 'The authentication code is invalid.' });
      return;
    }

    user.mfaFailedAttempts = 0;
    user.mfaLockoutUntil = undefined;
    user.lastLogin = new Date();
    user.lastSeen = new Date();
    await user.save();
    const token = generateAccessToken({
      userId: user._id.toString(),
      companyId: user.companyId?.toString() || '',
      role: 'super_admin',
      isSuperAdmin: true,
      mfaAuthenticated: true,
    });
    res.json({
      success: true,
      token,
      admin: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: 'super_admin',
        isSuperAdmin: true,
        mfaEnabled: true,
        lastLogin: user.lastLogin,
      },
    });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication challenge.' });
  }
};

export const getSuperAdminMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-password -refreshTokens');
    if (!user || !user.isSuperAdmin) {
      res.status(403).json({ success: false, message: 'Super admin access required' });
      return;
    }

    res.json({ success: true, admin: user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 2. PLATFORM ANALYTICS & OVERVIEW ───────────────────────────────────────

export const getPlatformAnalytics = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Parallel aggregate count queries
    const [
      totalUsers,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      activeUsers,
      suspendedUsers,
      totalCompanies,
      companyAccounts,
      individualAccounts,
      totalProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      totalMessages,
      totalFiles,
      pendingTickets,
      trialingUsers,
      starterUsers,
      proUsers,
      expiredUsers,
      cancelledUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      Company.countDocuments(),
      Company.countDocuments({ accountType: 'company' }),
      Company.countDocuments({ accountType: 'individual' }),
      Project.countDocuments(),
      Project.countDocuments({ status: 'completed' }),
      Task.countDocuments(),
      Task.countDocuments({ status: 'completed' }),
      Message.countDocuments(),
      FileModel.countDocuments(),
      SupportTicket.countDocuments({ status: { $in: ['open', 'new'] } }),
      Company.countDocuments({ subscriptionStatus: 'trialing' }),
      Company.countDocuments({ subscriptionStatus: 'active', subscriptionPlan: 'starter' }),
      Company.countDocuments({ subscriptionStatus: 'active', subscriptionPlan: 'pro' }),
      Company.countDocuments({ subscriptionStatus: 'expired' }),
      Company.countDocuments({ subscriptionStatus: 'cancelled' }),
    ]);

    // Calculate 30-day daily signup trend
    const recentSignups = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build complete 30-day timeline array
    const signupTrendMap = new Map<string, number>();
    recentSignups.forEach((item) => signupTrendMap.set(item._id, item.count));

    const signupTrend: { date: string; label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      signupTrend.push({
        date: iso,
        label,
        count: signupTrendMap.get(iso) || 0,
      });
    }

    // Calculate total storage across companies
    const storageAgg = await Company.aggregate([
      { $group: { _id: null, totalUsed: { $sum: '$storage.used' } } },
    ]);
    const totalStorageBytes = storageAgg[0]?.totalUsed || 0;

    // Plan breakdown
    const plansAgg = await Company.aggregate([
      { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } },
    ]);
    const planBreakdown = { free: 0, starter: 0, pro: 0 };
    plansAgg.forEach((p) => {
      if (p._id && planBreakdown.hasOwnProperty(p._id)) {
        (planBreakdown as any)[p._id] = p.count;
      }
    });

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          today: usersToday,
          thisWeek: usersThisWeek,
          thisMonth: usersThisMonth,
          active: activeUsers,
          suspended: suspendedUsers,
        },
        subscriptions: {
          trialing:   trialingUsers,
          starter:    starterUsers,
          pro:        proUsers,
          expired:    expiredUsers,
          cancelled:  cancelledUsers,
          totalPaid:  starterUsers + proUsers,
        },
        workspaces: {
          total: totalCompanies,
          company: companyAccounts,
          individual: individualAccounts,
          planBreakdown,
        },
        workload: {
          totalProjects,
          completedProjects,
          totalTasks,
          completedTasks,
          pendingTasks: totalTasks - completedTasks,
          totalMessages,
          totalFiles,
          totalStorageBytes,
        },
        support: {
          pendingTickets,
        },
        signupTrend,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 3. USERS MANAGEMENT ────────────────────────────────────────────────────

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const q = (req.query.q as string || '').trim();
    const accountType = req.query.accountType as string;
    const status = req.query.status as string;
    const subscriptionPlan   = req.query.subscriptionPlan   as string;
    const subscriptionStatus = req.query.subscriptionStatus as string;
    const sort = (req.query.sort as string) || 'newest';
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const filter: any = {};

    // Search query
    if (q) {
      filter.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { jobTitle: { $regex: q, $options: 'i' } },
      ];
    }

    // Account Type filter
    if (accountType && accountType !== 'all') {
      filter.accountType = accountType;
    }

    // Account active/suspended filter
    if (status && status !== 'all') {
      filter.isActive = status === 'active';
    }

    // Subscription plan filter (trialing / starter / pro / expired / cancelled)
    if (subscriptionPlan && subscriptionPlan !== 'all') {
      const companyStatusFilter: Record<string, unknown> = {};
      if (['trialing', 'expired', 'cancelled', 'past_due', 'none'].includes(subscriptionPlan)) {
        companyStatusFilter.subscriptionStatus = subscriptionPlan;
      } else if (subscriptionPlan === 'free') {
        companyStatusFilter.subscriptionPlan = 'free';
        companyStatusFilter.subscriptionStatus = { $ne: 'trialing' };
      } else {
        companyStatusFilter.subscriptionPlan = subscriptionPlan;
        companyStatusFilter.subscriptionStatus = { $in: ['active', 'cancelled'] };
      }
      const companyIds = await Company.find(companyStatusFilter).distinct('_id');
      const personalFilter = ['trialing', 'expired', 'cancelled', 'past_due', 'none'].includes(subscriptionPlan)
        ? { subscriptionStatus: subscriptionPlan, companyId: { $exists: false } }
        : { _id: { $exists: false } };
      filter.$and = [...(filter.$and || []), { $or: [{ companyId: { $in: companyIds } }, personalFilter] }];
    }

    // Subscription status filter (explicit override)
    if (subscriptionStatus && subscriptionStatus !== 'all') {
      filter.subscriptionStatus = subscriptionStatus;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    // Sorting
    let sortObj: any = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };
    else if (sort === 'name_asc') sortObj = { fullName: 1 };
    else if (sort === 'name_desc') sortObj = { fullName: -1 };
    else if (sort === 'last_active') sortObj = { lastSeen: -1 };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password -phone -refreshTokens -mfaSecretEncrypted -mfaTempSecretEncrypted -recoveryCodesHashed')
      .populate('companyId', 'name industry plan subscriptionPlan subscriptionStatus trialStartDate trialEndDate subscriptionEndDate accountType country')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select('-password -phone -refreshTokens')
      .populate('companyId');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Collect user engagement statistics
    const [assignedTasksCount, completedTasksCount, createdProjectsCount] = await Promise.all([
      Task.countDocuments({ assigneeId: user._id }),
      Task.countDocuments({ assigneeId: user._id, status: 'completed' }),
      Project.countDocuments({ managerId: user._id }),
    ]);

    res.json({
      success: true,
      user,
      stats: {
        assignedTasks: assignedTasksCount,
        completedTasks: completedTasksCount,
        createdProjects: createdProjectsCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (id === req.user!.userId) {
      res.status(400).json({ success: false, message: 'You cannot change your own super admin account status' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    user.isActive = Boolean(isActive);
    if (!user.isActive) {
      // Invalidate all tokens so the user is instantly kicked out
      user.refreshTokens = [];
    }
    await user.save();

    await AuditLog.create({
      companyId: user.companyId || new mongoose.Types.ObjectId(),
      userId: req.user!.userId,
      action: user.isActive ? 'USER_ACTIVATED_BY_SUPERADMIN' : 'USER_SUSPENDED_BY_SUPERADMIN',
      resource: 'User',
      resourceId: user._id.toString(),
      details: { targetEmail: user.email, adminId: req.user!.userId },
    }).catch(() => {});

    res.json({
      success: true,
      message: `User ${user.fullName} has been ${user.isActive ? 'activated' : 'suspended'}`,
      user: {
        _id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === req.user!.userId) {
      res.status(400).json({ success: false, message: 'Cannot delete your own super admin account' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await User.findByIdAndDelete(id);

    await AuditLog.create({
      companyId: user.companyId || new mongoose.Types.ObjectId(),
      userId: req.user!.userId,
      action: 'USER_DELETED_BY_SUPERADMIN',
      resource: 'User',
      resourceId: id,
      details: { deletedEmail: user.email, deletedName: user.fullName },
    }).catch(() => {});

    res.json({ success: true, message: `User ${user.fullName} (${user.email}) permanently removed` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const passwordToSet = newPassword?.trim() || `WG-${Math.random().toString(36).slice(-8)}!Aa`;
    user.password = passwordToSet;
    user.refreshTokens = []; // Force logout
    await user.save();

    res.json({
      success: true,
      message: `Password reset successfully for ${user.fullName}`,
      temporaryPassword: passwordToSet,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateUserPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!['free', 'starter', 'pro'].includes(plan)) {
      res.status(400).json({ success: false, message: 'Invalid plan. Allowed: free, starter, pro' });
      return;
    }

    const user = await User.findById(id);
    if (!user || !user.companyId) {
      res.status(404).json({ success: false, message: 'User workspace not found' });
      return;
    }

    const company = await Company.findById(user.companyId);
    if (!company) {
      res.status(404).json({ success: false, message: 'User workspace not found' });
      return;
    }
    company.subscriptionPlan = plan;
    company.subscriptionStatus = plan === 'free' ? 'expired' : 'active';
    company.plan = plan;
    company.cancelAtPeriodEnd = false;
    company.isLifetime = false;
    if (plan === 'free') company.subscriptionEndDate = new Date();
    else {
      company.subscriptionEndDate = undefined;
      company.subscriptionStartDate = new Date();
    }
    await company.save();

    res.json({
      success: true,
      message: `Workspace plan updated to ${plan.toUpperCase()}`,
      company,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 4. WORKSPACES MANAGEMENT ───────────────────────────────────────────────

export const getWorkspaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const q = (req.query.q as string || '').trim();
    const plan = req.query.plan as string;
    const accountType = req.query.accountType as string;

    const filter: any = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { country: { $regex: q, $options: 'i' } },
        { industry: { $regex: q, $options: 'i' } },
      ];
    }
    if (plan && plan !== 'all') filter.subscriptionPlan = plan;
    if (accountType && accountType !== 'all') filter.accountType = accountType;

    const total = await Company.countDocuments(filter);
    const companies = await Company.find(filter)
      .populate('ownerId', 'fullName email avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Compute members & projects counts for these companies
    const companyIds = companies.map((c) => c._id);
    const [memberCounts, projectCounts] = await Promise.all([
      User.aggregate([
        { $match: { companyId: { $in: companyIds }, isActive: true } },
        { $group: { _id: '$companyId', count: { $sum: 1 } } },
      ]),
      Project.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: '$companyId', count: { $sum: 1 } } },
      ]),
    ]);

    const memberMap = new Map(memberCounts.map((m) => [m._id.toString(), m.count]));
    const projectMap = new Map(projectCounts.map((p) => [p._id.toString(), p.count]));

    const enriched = await Promise.all(companies.map(async (c) => {
      const cObj = c.toObject();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const isInactive = Date.now() - new Date(c.updatedAt || c.createdAt).getTime() > thirtyDaysMs;
      const [subscription, usage] = await Promise.all([
        getCompanySubscription(c._id.toString()),
        getPlanUsage((c.ownerId as any)._id?.toString?.() ?? c.ownerId.toString()),
      ]);

      return {
        ...cObj,
        membersCount: memberMap.get(c._id.toString()) ?? 0,
        projectsCount: projectMap.get(c._id.toString()) || 0,
        plan: subscription.plan,
        subscriptionPlan: c.subscriptionPlan,
        subscriptionStatus: subscription.status,
        subscription: {
          status: subscription.status,
          plan: subscription.plan,
          limits: subscription.planConfig.limits,
          entitlements: subscription.planConfig.entitlements,
          trialStartDate: subscription.trialStartDate,
          trialEndDate: subscription.trialEndDate,
          subscriptionStartDate: subscription.subscriptionStartDate,
          subscriptionEndDate: subscription.subscriptionEndDate,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          isLifetime: subscription.isLifetime,
        },
        usage,
        isInactive,
      };
    }));

    res.json({
      success: true,
      workspaces: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateWorkspacePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!['free', 'starter', 'pro'].includes(plan)) {
      res.status(400).json({ success: false, message: 'Invalid plan' });
      return;
    }

    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ success: false, message: 'Workspace not found' });
      return;
    }

    company.subscriptionPlan = plan;
    company.subscriptionStatus = plan === 'free' ? 'expired' : 'active';
    company.plan = plan;
    company.cancelAtPeriodEnd = false;
    company.isLifetime = false;
    if (plan === 'free') company.subscriptionEndDate = new Date();
    else {
      company.subscriptionEndDate = undefined;
      company.subscriptionStartDate = new Date();
    }
    await company.save();

    res.json({ success: true, message: `Workspace plan updated to ${plan.toUpperCase()}`, company });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ success: false, message: 'Workspace not found' });
      return;
    }

    // Delete company and decouple/delete associated resources
    await Company.findByIdAndDelete(id);
    await User.updateMany({ companyId: id }, { $unset: { companyId: 1 } });

    res.json({ success: true, message: `Workspace "${company.name}" deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 5. SUPPORT & MODERATION QUEUE / CONTACT INBOX ──────────────────────────

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, type, q } = req.query;
    const filter: any = {};

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (q) {
      const regex = { $regex: q as string, $options: 'i' };
      filter.$or = [
        { name: regex },
        { email: regex },
        { subject: regex },
        { company: regex },
        { message: regex },
      ];
    }

    const [tickets, totalCount, unreadCount, demoCount, contactCount] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }),
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ isRead: false }),
      SupportTicket.countDocuments({ type: 'demo' }),
      SupportTicket.countDocuments({ type: { $ne: 'demo' } }),
    ]);

    res.json({
      success: true,
      tickets,
      counts: {
        total: totalCount,
        unread: unreadCount,
        demo: demoCount,
        contact: contactCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTicketDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    if (!ticket.isRead) {
      ticket.isRead = true;
      await ticket.save();
    }

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markTicketAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isRead = true } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { isRead },
      { new: true }
    );

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const replyTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { replyText, updateStatus } = req.body;

    if (!replyText || !replyText.trim()) {
      res.status(400).json({ success: false, message: 'Reply text is required' });
      return;
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    const adminUser = await User.findById(req.user!.userId);
    const adminName = adminUser?.fullName || 'WorkGrind Support Specialist';

    // 1. Send formatted email to user
    const emailResult = await sendAdminReplyEmail({
      to: ticket.email,
      recipientName: ticket.name,
      replyText: replyText.trim(),
      originalSubject: ticket.subject,
      originalMessage: ticket.message,
      adminName,
    });

    // 2. Append reply to ticket history
    ticket.replies.push({
      replyText: replyText.trim(),
      sentBy: adminName,
      sentAt: new Date(),
      emailMessageId: emailResult.messageId,
    });

    // 3. Update status & mark read
    ticket.status = updateStatus || 'replied';
    ticket.isRead = true;
    await ticket.save();

    // 4. Audit log
    await AuditLog.create({
      companyId: req.user!.companyId || new mongoose.Types.ObjectId(),
      userId: req.user!.userId,
      action: 'ADMIN_REPLIED_TO_SUPPORT_TICKET',
      resource: 'SupportTicket',
      resourceId: ticket._id.toString(),
      details: {
        targetEmail: ticket.email,
        subject: ticket.subject,
        emailSent: emailResult.success,
      },
    }).catch(() => {});

    res.json({
      success: true,
      message: `Reply sent successfully to ${ticket.name} (${ticket.email})!`,
      ticket,
      emailSent: emailResult.success,
    });
  } catch (err: any) {
    console.error('❌ [SuperAdmin Reply] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, priority, adminNotes, isRead } = req.body;

    const updateFields: any = {};
    if (status !== undefined) updateFields.status = status;
    if (priority !== undefined) updateFields.priority = priority;
    if (adminNotes !== undefined) updateFields.adminNotes = adminNotes;
    if (isRead !== undefined) updateFields.isRead = isRead;

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await SupportTicket.findByIdAndDelete(id);
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 6. SYSTEM & TECHNICAL MONITORING ───────────────────────────────────────

export const getSystemHealth = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mem = process.memoryUsage();

    // Collection counts
    const [usersCount, companiesCount, projectsCount, tasksCount, messagesCount, filesCount, ticketsCount] =
      await Promise.all([
        User.countDocuments(),
        Company.countDocuments(),
        Project.countDocuments(),
        Task.countDocuments(),
        Message.countDocuments(),
        FileModel.countDocuments(),
        SupportTicket.countDocuments(),
      ]);

    // Recent system logs from AuditLog
    const recentLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(10);

    const isSmtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    res.json({
      success: true,
      system: {
        server: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsedMB: Math.round(mem.rss / (1024 * 1024)),
          heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
          heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
          environment: process.env.NODE_ENV || 'development',
        },
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          host: mongoose.connection.host || 'unknown',
          collections: {
            users: usersCount,
            companies: companiesCount,
            projects: projectsCount,
            tasks: tasksCount,
            messages: messagesCount,
            files: filesCount,
            supportTickets: ticketsCount,
          },
        },
        email: {
          isConfigured: isSmtpConfigured,
          // SECURITY: Do not expose actual SMTP host/sender in API response.
          // This information could help an attacker fingerprint the email provider.
          status: isSmtpConfigured ? 'configured' : 'not_configured',
        },
        recentLogs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const testEmailConnection = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      res.status(400).json({ success: false, message: 'SMTP credentials not configured in backend environment' });
      return;
    }

    const transporter = await getTransporter();
    await transporter.verify();
    res.json({ success: true, message: 'SMTP gateway verified and active' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `SMTP connection failed: ${err.message}` });
  }
};

// ── 7. MFA MANAGEMENT CONTROLLERS ──────────────────────────────────────────

export const getMfaStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('+recoveryCodesHashed');
    if (!user) {
      res.status(404).json({ success: false, message: 'Admin user not found' });
      return;
    }

    res.json({
      success: true,
      mfaEnabled: Boolean(user.mfaEnabled),
      verifiedAt: user.mfaVerifiedAt,
      remainingRecoveryCodes: user.recoveryCodesHashed ? user.recoveryCodesHashed.length : 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const startMfaSetup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Admin user not found' });
      return;
    }

    const secret = generateTotpSecret();
    const { qrCodeDataUrl, otpauthUrl } = await generateTotpProvisioning(user.email, secret);

    // Save temporary secret encrypted
    user.mfaTempSecretEncrypted = encryptSecret(secret);
    await user.save();

    res.json({
      success: true,
      qrCodeUrl: qrCodeDataUrl,
      manualKey: secret,
      otpauthUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyAndEnableMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: '6-digit verification code is required' });
      return;
    }

    const user = await User.findById(req.user!.userId).select(
      '+mfaTempSecretEncrypted +mfaSecretEncrypted +recoveryCodesHashed'
    );
    if (!user || !user.mfaTempSecretEncrypted) {
      res.status(400).json({
        success: false,
        message: 'MFA setup has not been initiated. Please start setup again.',
      });
      return;
    }

    let plainSecret = '';
    try {
      plainSecret = decryptSecret(user.mfaTempSecretEncrypted);
    } catch {
      res.status(400).json({ success: false, message: 'MFA setup state corrupted. Please restart setup.' });
      return;
    }

    const isValid = verifyTotp(code, plainSecret);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid 6-digit verification code. Please check your Authenticator app and try again.',
      });
      return;
    }

    // Promote temp secret to active secret
    user.mfaSecretEncrypted = user.mfaTempSecretEncrypted;
    user.mfaTempSecretEncrypted = undefined;
    user.mfaEnabled = true;
    user.mfaVerifiedAt = new Date();

    // Generate 8 one-time recovery codes
    const rawRecoveryCodes = generateRecoveryCodes(8);
    user.recoveryCodesHashed = rawRecoveryCodes.map(hashRecoveryCode);

    await user.save();

    await AuditLog.create({
      companyId: user.companyId || new mongoose.Types.ObjectId(),
      userId: user._id,
      action: 'SUPERADMIN_MFA_ENABLED',
      resource: 'User',
      resourceId: user._id.toString(),
      details: { email: user.email },
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Authenticator App Two-Factor Authentication is now enabled!',
      recoveryCodes: rawRecoveryCodes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const regenerateRecoveryCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, code } = req.body;
    if (!password) {
      res.status(400).json({ success: false, message: 'Current password is required to regenerate recovery codes' });
      return;
    }

    const user = await User.findById(req.user!.userId).select(
      '+password +mfaEnabled +mfaSecretEncrypted +recoveryCodesHashed'
    );
    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      res.status(400).json({ success: false, message: 'MFA is not enabled on this account' });
      return;
    }

    // Verify current password
    const isPassValid = await user.comparePassword(password);
    if (!isPassValid) {
      res.status(401).json({ success: false, message: 'Invalid account password' });
      return;
    }

    // If TOTP code provided, verify it as well
    if (code) {
      const plainSecret = decryptSecret(user.mfaSecretEncrypted);
      if (!verifyTotp(code, plainSecret)) {
        res.status(401).json({ success: false, message: 'Invalid 6-digit Authenticator code' });
        return;
      }
    }

    // Generate 8 fresh recovery codes, invalidating all previous ones
    const rawRecoveryCodes = generateRecoveryCodes(8);
    user.recoveryCodesHashed = rawRecoveryCodes.map(hashRecoveryCode);
    await user.save();

    await AuditLog.create({
      companyId: user.companyId || new mongoose.Types.ObjectId(),
      userId: user._id,
      action: 'SUPERADMIN_MFA_RECOVERY_CODES_REGENERATED',
      resource: 'User',
      resourceId: user._id.toString(),
      details: { email: user.email },
    }).catch(() => {});

    res.json({
      success: true,
      message: 'New recovery codes generated. All previous recovery codes are now invalid.',
      recoveryCodes: rawRecoveryCodes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const disableMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, code } = req.body;
    if (!password) {
      res.status(400).json({ success: false, message: 'Current password is required to disable Two-Factor Authentication' });
      return;
    }

    const user = await User.findById(req.user!.userId).select(
      '+password +mfaEnabled +mfaSecretEncrypted'
    );
    if (!user || !user.mfaEnabled) {
      res.status(400).json({ success: false, message: 'Two-Factor Authentication is already disabled' });
      return;
    }

    // Verify current password
    const isPassValid = await user.comparePassword(password);
    if (!isPassValid) {
      res.status(401).json({ success: false, message: 'Invalid account password' });
      return;
    }

    // If TOTP code provided, verify it
    if (code && user.mfaSecretEncrypted) {
      const plainSecret = decryptSecret(user.mfaSecretEncrypted);
      if (!verifyTotp(code, plainSecret)) {
        res.status(401).json({ success: false, message: 'Invalid 6-digit Authenticator code' });
        return;
      }
    }

    // Reset MFA fields
    user.mfaEnabled = false;
    user.mfaSecretEncrypted = undefined;
    user.mfaTempSecretEncrypted = undefined;
    user.recoveryCodesHashed = [];
    user.mfaVerifiedAt = undefined;
    user.refreshTokens = []; // Revoke active refresh tokens
    await user.save();

    await AuditLog.create({
      companyId: user.companyId || new mongoose.Types.ObjectId(),
      userId: user._id,
      action: 'SUPERADMIN_MFA_DISABLED',
      resource: 'User',
      resourceId: user._id.toString(),
      details: { email: user.email },
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Two-Factor Authentication has been successfully disabled.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 8. PLATFORM-WIDE CRM STATISTICS ────────────────────────────────────────
// GET /api/super-admin/admin/crm-stats
// Aggregates CRM data across ALL workspaces for super-admin inspection.
// Response shape is identical to getAdminCrmStats so the existing frontend
// admin-portal/crm/page.tsx works without any changes.

export const getCrmStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stages = ['new_lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

    const [
      contactCount,
      companyCount,
      stageBreakdown,
      recentDeals,
      recentContacts,
    ] = await Promise.all([
      // Total contacts across all workspaces
      CrmContact.countDocuments(),
      // Total CRM companies across all workspaces
      CrmCompany.countDocuments(),
      // Deal counts and values by stage — platform-wide
      CrmDeal.aggregate([
        { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: { $ifNull: ['$value', 0] } } } },
      ]),
      // Most recent deals platform-wide
      CrmDeal.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('contactId',    'firstName lastName email')
        .populate('crmCompanyId', 'name')
        .populate('ownerId',      'fullName avatar')
        .lean(),
      // Most recent contacts platform-wide
      CrmContact.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('ownerId',      'fullName avatar')
        .populate('crmCompanyId', 'name')
        .lean(),
    ]);

    // Build stage map
    const stageMap: Record<string, { count: number; totalValue: number }> = {};
    for (const s of stages) stageMap[s] = { count: 0, totalValue: 0 };
    for (const row of stageBreakdown) {
      if (row._id && stageMap[row._id]) {
        stageMap[row._id] = { count: row.count, totalValue: row.totalValue };
      }
    }

    const pipelineValue = stages
      .filter(s => s !== 'lost')
      .reduce((sum, s) => sum + stageMap[s].totalValue, 0);

    const openDeals = stages
      .filter(s => s !== 'won' && s !== 'lost')
      .reduce((sum, s) => sum + stageMap[s].count, 0);

    res.json({
      success: true,
      crm: {
        contactCount,
        companyCount,
        openDeals,
        wonDeals:     stageMap['won'].count,
        lostDeals:    stageMap['lost'].count,
        pipelineValue,
        stageMap,
        recentDeals,
        recentContacts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAiAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.query.companyId as string | undefined;
    const limitDays = parseInt(req.query.limitDays as string) || 30;

    if (companyId) {
      const from = new Date();
      from.setDate(from.getDate() - limitDays);

      const [summary, recentRecords] = await Promise.all([
        getUsageSummaryForCompany(companyId, from),
        getUsageForCompany(companyId, { from }),
      ]);

      const recent100 = recentRecords.slice(0, 100);
      const recentErrors = recent100.filter((r: any) => r.success === false).map((r: any) => ({
        timestamp: r.timestamp,
        feature: r.feature,
        errorMessage: r.errorMessage,
      }));

      res.json({
        success: true,
        company: {
          ...summary,
          recentRecords: recent100,
          recentErrors,
        },
      });
    } else {
      const platformStats = await getPlatformAiUsage(limitDays);

      const companyIds = platformStats.perCompanyTop10.map((c: any) => c.companyId);
      const companies = await Company.find({ _id: { $in: companyIds } }).select('_id name').lean();
      const companyNameMap = new Map(companies.map((c: any) => [c._id.toString(), c.name]));

      const topCompanies = platformStats.perCompanyTop10.map((c: any) => ({
        ...c,
        companyName: companyNameMap.get(c.companyId) || 'Unknown Workspace',
      }));

      res.json({
        success: true,
        platform: {
          ...platformStats,
          topCompanies,
        },
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
