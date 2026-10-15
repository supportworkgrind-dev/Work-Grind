import { Response } from 'express';
import User from '../models/User';
import Company from '../models/Company';
import Project from '../models/Project';
import Task from '../models/Task';
import Channel from '../models/Channel';
import AuditLog from '../models/AuditLog';
import { CrmContact } from '../models/CrmContact';
import { CrmDeal }    from '../models/CrmDeal';
import { CrmCompany } from '../models/CrmCompany';
import { ClientUser } from '../models/ClientPortal';
import { AuthRequest } from '../middleware/auth';
import { getCompanySubscription } from '../services/companySubscription';
import { isOrganizationRoleEligible, normalizeOrganizationRole, roleMatches } from '../config/organization';
import { parsePagination } from '../utils/pagination';

export const getAdminMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, department } = req.query;
    const pagination = parsePagination(req.query, { defaultLimit: 100, maxLimit: 200 });
    if (!pagination) {
      res.status(400).json({ success: false, message: 'Invalid pagination parameters.' });
      return;
    }

    const filter: any = { companyId: req.user!.companyId };
    if (role) filter.role = role;
    if (department) filter.department = department;

    const pageMembers = await User.find(filter)
      .select('-password -phone -refreshTokens -verificationToken -resetPasswordToken')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit + 1);
    const hasMore = pageMembers.length > pagination.limit;
    const members = hasMore ? pageMembers.slice(0, pagination.limit) : pageMembers;

    res.json({ success: true, members, page: pagination.page, hasMore });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestedRole = req.body?.role;
    const [company, target] = await Promise.all([
      Company.findById(req.user!.companyId).select('ownerId organizationType'),
      User.findOne({ _id: userId, companyId: req.user!.companyId }).select('_id role'),
    ]);
    if (!company || !target) {
      res.status(404).json({ success: false, message: 'Organization member not found.' });
      return;
    }
    if (target._id.toString() === company.ownerId.toString()) {
      res.status(403).json({ success: false, message: 'The workspace owner role is tied to organization ownership.' });
      return;
    }

    const role = normalizeOrganizationRole(requestedRole, company.organizationType, '');
    if (
      !role ||
      role === 'owner' ||
      !isOrganizationRoleEligible(requestedRole, company.organizationType)
    ) {
      res.status(400).json({ success: false, message: 'This role is not eligible for the organization.' });
      return;
    }

    const actorOwnsOrganization = company.ownerId.toString() === req.user!.userId;
    const isElevatedRole = roleMatches(
      role,
      ['admin', 'manager', 'principal', 'dean', 'hod'],
      company.organizationType,
    );
    if (isElevatedRole && !actorOwnsOrganization) {
      res.status(403).json({ success: false, message: 'Only the workspace owner can assign elevated organization roles.' });
      return;
    }

    const member = await User.findOneAndUpdate(
      { _id: userId, companyId: req.user!.companyId },
      { role },
      { new: true }
    ).select('-password -phone -refreshTokens');

    if (!member) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await AuditLog.create({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      action: 'MEMBER_ROLE_UPDATED',
      resource: 'User',
      resourceId: userId,
      details: { newRole: role, updatedUser: member.fullName },
    });

    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMemberStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, message: 'A valid active status is required.' });
      return;
    }
    const company = await Company.findById(req.user!.companyId).select('ownerId organizationType');
    const target = await User.findOne({ _id: userId, companyId: req.user!.companyId }).select('_id role');
    if (!company || !target) {
      res.status(404).json({ success: false, message: 'Organization member not found.' });
      return;
    }
    const actorOwnsOrganization = company.ownerId.toString() === req.user!.userId;
    if (
      target._id.toString() === company.ownerId.toString() ||
      target._id.toString() === req.user!.userId ||
      (!actorOwnsOrganization && roleMatches(
        target.role,
        ['owner', 'admin', 'manager', 'principal', 'dean', 'hod'],
        company.organizationType,
      ))
    ) {
      res.status(403).json({ success: false, message: 'You cannot change this member’s access status.' });
      return;
    }
    const member = await User.findOneAndUpdate(
      { _id: userId, companyId: req.user!.companyId },
      { isActive },
      { new: true },
    ).select('-password -phone -refreshTokens');
    if (!member) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await AuditLog.create({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      action: isActive ? 'MEMBER_ACTIVATED' : 'MEMBER_DEACTIVATED',
      resource: 'User',
      resourceId: userId,
      details: { member: member.fullName },
    });

    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    if (!pagination) {
      res.status(400).json({ success: false, message: 'Invalid pagination parameters.' });
      return;
    }

    const filter = { companyId: req.user!.companyId };
    const [pageLogs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'fullName avatar email')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit + 1),
      AuditLog.countDocuments(filter),
    ]);
    const hasMore = pageLogs.length > pagination.limit;
    const logs = hasMore ? pageLogs.slice(0, pagination.limit) : pageLogs;

    res.json({ success: true, logs, total, page: pagination.page, hasMore });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAdminStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const [
      company,
      memberCount,
      activeProjects,
      totalTasks,
      channelsCount,
      crmContactCount,
      crmCompanyCount,
      openDeals,
      wonDeals,
      totalClients,
      activeClients,
    ] = await Promise.all([
      Company.findById(companyId),
      User.countDocuments({ companyId, isActive: true }),
      Project.countDocuments({ companyId, status: 'active', isArchived: false }),
      Task.countDocuments({ companyId, isArchived: false }),
      Channel.countDocuments({ companyId, isArchived: false }),
      CrmContact.countDocuments({ companyId }),
      CrmCompany.countDocuments({ companyId }),
      CrmDeal.countDocuments({ companyId, stage: { $nin: ['won', 'lost'] } }),
      CrmDeal.countDocuments({ companyId, stage: 'won' }),
      ClientUser.countDocuments({ companyId }),
      ClientUser.countDocuments({ companyId, isActive: true }),
    ]);

    const dealValueAgg = await CrmDeal.aggregate([
      { $match: { companyId, stage: { $nin: ['lost'] } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$value', 0] } } } },
    ]);

    const pipelineValue: number = dealValueAgg[0]?.total ?? 0;
    const subscription = company ? await getCompanySubscription(company._id.toString()) : null;

    res.json({
      success: true,
      stats: {
        companyName: company?.name,
        plan: subscription?.plan || 'free',
        storageUsed: company?.storage?.used || 0,
        storageLimit: subscription?.planConfig.limits.storage ?? 1_073_741_824,
        memberCount,
        activeProjects,
        totalTasks,
        channelsCount,
        crm: {
          contactCount:  crmContactCount,
          companyCount:  crmCompanyCount,
          openDeals,
          wonDeals,
          pipelineValue,
        },
        clientPortal: {
          totalClients,
          activeClients,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAdminCrmStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const [
      contactCount,
      companyCount,
      stageBreakdown,
      recentDeals,
      recentContacts,
    ] = await Promise.all([
      CrmContact.countDocuments({ companyId }),
      CrmCompany.countDocuments({ companyId }),
      CrmDeal.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: { $ifNull: ['$value', 0] } } } },
      ]),
      CrmDeal.find({ companyId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('contactId',    'firstName lastName email')
        .populate('crmCompanyId', 'name')
        .populate('ownerId',      'fullName avatar')
        .lean(),
      CrmContact.find({ companyId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('ownerId',      'fullName avatar')
        .populate('crmCompanyId', 'name')
        .lean(),
    ]);

    const stages = ['new_lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
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
