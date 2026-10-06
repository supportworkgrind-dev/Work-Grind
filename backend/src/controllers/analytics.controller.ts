/**
 * Analytics Controller
 * All queries are scoped by companyId from req.user — never from the request body.
 * Returns real database aggregations. Zero fake/mock data.
 */

import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import Task from '../models/Task';
import Project from '../models/Project';
import Meeting from '../models/Meeting';
import User from '../models/User';
import { CrmDeal } from '../models/CrmDeal';
import { CrmContact } from '../models/CrmContact';
import { CrmCompany } from '../models/CrmCompany';
import File from '../models/File';
import Message from '../models/Message';

// ── Helper ─────────────────────────────────────────────────────────────────

function cid(req: AuthRequest) {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/analytics/overview
// High-level KPIs for the analytics dashboard header
// ═══════════════════════════════════════════════════════════════════════════

export const getOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = cid(req);

    const [
      totalTasks, completedTasks, overdueTasks,
      activeProjects, completedProjects,
      totalMembers,
      totalMeetings, completedMeetings,
      openDeals, wonDeals, totalDealValue,
      totalContacts, totalCrmCompanies,
    ] = await Promise.all([
      Task.countDocuments({ companyId, isArchived: false }),
      Task.countDocuments({ companyId, isArchived: false, status: 'completed' }),
      Task.countDocuments({ companyId, isArchived: false, status: { $ne: 'completed' }, dueDate: { $lt: new Date() } }),
      Project.countDocuments({ companyId, isArchived: false, status: 'active' }),
      Project.countDocuments({ companyId, isArchived: false, status: 'completed' }),
      User.countDocuments({ companyId, isActive: true }),
      Meeting.countDocuments({ companyId }),
      Meeting.countDocuments({ companyId, status: 'ended' }),
      CrmDeal.countDocuments({ companyId, stage: { $nin: ['won','lost'] } }),
      CrmDeal.countDocuments({ companyId, stage: 'won' }),
      CrmDeal.aggregate([
        { $match: { companyId, stage: 'won' } },
        { $group: { _id: null, total: { $sum: '$value' } } },
      ]).then(r => r[0]?.total ?? 0),
      CrmContact.countDocuments({ companyId }),
      CrmCompany.countDocuments({ companyId }),
    ]);

    const taskCompletionRate = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    res.json({
      success: true,
      overview: {
        tasks: { total: totalTasks, completed: completedTasks, overdue: overdueTasks, completionRate: taskCompletionRate },
        projects: { active: activeProjects, completed: completedProjects },
        team: { totalMembers },
        meetings: { total: totalMeetings, completed: completedMeetings },
        crm: { openDeals, wonDeals, totalDealValue, totalContacts, totalCrmCompanies },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/analytics/crm
// CRM pipeline analytics: deals by stage, revenue trend (last 6 months),
// win/loss rate, top contacts
// ═══════════════════════════════════════════════════════════════════════════

export const getCrmAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = cid(req);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [dealsByStage, revenueByMonth, wonLostStats, contactsByStatus, topDeals] = await Promise.all([
      // Deals by stage with value
      CrmDeal.aggregate([
        { $match: { companyId } },
        { $group: {
          _id:        '$stage',
          count:      { $sum: 1 },
          totalValue: { $sum: '$value' },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Won deals grouped by month (last 6 months)
      CrmDeal.aggregate([
        { $match: { companyId, stage: 'won', updatedAt: { $gte: sixMonthsAgo } } },
        { $group: {
          _id: {
            year:  { $year:  '$updatedAt' },
            month: { $month: '$updatedAt' },
          },
          revenue: { $sum: '$value' },
          count:   { $sum: 1 },
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // Win/loss ratio
      CrmDeal.aggregate([
        { $match: { companyId, stage: { $in: ['won','lost'] } } },
        { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$value' } } },
      ]),

      // Contacts by status
      CrmContact.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Top 5 open deals by value
      CrmDeal.find({ companyId, stage: { $nin: ['won','lost'] } })
        .sort({ value: -1 })
        .limit(5)
        .populate('crmCompanyId', 'name')
        .populate('ownerId', 'fullName')
        .select('title value stage priority closeDate')
        .lean(),
    ]);

    // Format revenue by month into chart-friendly shape
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const revenueChart = revenueByMonth.map((r: any) => ({
      month:   `${months[r._id.month - 1]} ${r._id.year}`,
      revenue: r.revenue,
      count:   r.count,
    }));

    res.json({
      success: true,
      crm: {
        dealsByStage,
        revenueByMonth: revenueChart,
        wonLostStats,
        contactsByStatus,
        topDeals,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/analytics/tasks
// Task analytics: completion trend, by priority, by status, overdue breakdown
// ═══════════════════════════════════════════════════════════════════════════

export const getTaskAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = cid(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [byStatus, byPriority, completionTrend, projectProgress, overdueTasks] = await Promise.all([
      Task.aggregate([
        { $match: { companyId, isArchived: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Task.aggregate([
        { $match: { companyId, isArchived: false, status: { $ne: 'completed' } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // Tasks completed per day over last 30 days
      Task.aggregate([
        { $match: { companyId, isArchived: false, status: 'completed', completedAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Project progress
      Project.find({ companyId, isArchived: false, status: 'active' })
        .select('name progress color deadline status')
        .sort({ progress: 1 })
        .limit(10)
        .lean(),

      // Overdue by assignee
      Task.aggregate([
        {
          $match: {
            companyId,
            isArchived: false,
            status: { $ne: 'completed' },
            dueDate: { $lt: new Date() },
          },
        },
        { $group: { _id: '$assigneeId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { count: 1, 'user.fullName': 1, 'user.avatar': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      tasks: { byStatus, byPriority, completionTrend, projectProgress, overdueTasks },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/analytics/team
// Team workload, activity, member stats
// ═══════════════════════════════════════════════════════════════════════════

export const getTeamAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = cid(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [workload, byRole, byDept, meetingsPerMember] = await Promise.all([
      // Tasks per active member
      Task.aggregate([
        { $match: { companyId, isArchived: false, status: { $ne: 'completed' } } },
        { $group: { _id: '$assigneeId', taskCount: { $sum: 1 } } },
        { $sort: { taskCount: -1 } },
        { $limit: 15 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { taskCount: 1, 'user.fullName': 1, 'user.avatar': 1, 'user.role': 1, 'user.department': 1 } },
      ]),

      // Members by role
      User.aggregate([
        { $match: { companyId, isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),

      // Members by department
      User.aggregate([
        { $match: { companyId, isActive: true, department: { $exists: true, $ne: '' } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Meetings hosted per member (last 30 days)
      Meeting.aggregate([
        { $match: { companyId, status: 'ended', endedAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$hostId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { count: 1, 'user.fullName': 1, 'user.avatar': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      team: { workload, byRole, byDept, meetingsPerMember },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/analytics/meetings
// Meeting analytics: by status, per month, average duration
// ═══════════════════════════════════════════════════════════════════════════

export const getMeetingAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = cid(req);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [byStatus, perMonth, avgDuration, upcomingList] = await Promise.all([
      Meeting.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Meeting.aggregate([
        { $match: { companyId, createdAt: { $gte: threeMonthsAgo } } },
        { $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count:    { $sum: 1 },
          ended:    { $sum: { $cond: [{ $eq: ['$status','ended'] }, 1, 0] } },
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      Meeting.aggregate([
        { $match: { companyId, status: 'ended', duration: { $exists: true, $gt: 0 } } },
        { $group: { _id: null, avgMinutes: { $avg: '$duration' }, totalMeetings: { $sum: 1 } } },
      ]).then(r => r[0] ?? { avgMinutes: 0, totalMeetings: 0 }),

      Meeting.find({ companyId, status: 'scheduled', scheduledAt: { $gte: new Date() } })
        .sort({ scheduledAt: 1 })
        .limit(5)
        .populate('hostId', 'fullName avatar')
        .select('title scheduledAt duration')
        .lean(),
    ]);

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const perMonthChart = (perMonth as any[]).map(r => ({
      month: `${months[r._id.month - 1]} ${r._id.year}`,
      total: r.count,
      ended: r.ended,
    }));

    res.json({
      success: true,
      meetings: { byStatus, perMonth: perMonthChart, avgDuration, upcomingList },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
