/**
 * Moderation Controller
 *
 * Access Model:
 * - Any authenticated workspace member: submit a report
 * - Owners & Admins: view reports, take moderation actions, view audit logs
 * - Super Admins (via separate superAdmin routes): unrestricted cross-workspace access
 *
 * All moderator actions are recorded in both the Report.actions array
 * and the company AuditLog for compliance and accountability.
 */

import { Response } from 'express';
import mongoose from 'mongoose';
import Report from '../models/Report';
import Message from '../models/Message';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

// ── Submit a new report (any authenticated member) ────────────────────────────

export const submitReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetType, targetId, reason, details, severity } = req.body;
    const uid      = req.user!.userId;
    const companyId = req.user!.companyId;

    if (!targetType || !targetId || !reason) {
      res.status(400).json({ success: false, message: 'targetType, targetId, and reason are required' });
      return;
    }

    // Prevent duplicate pending reports from the same reporter
    const existing = await Report.findOne({
      companyId,
      reporterId: uid,
      targetId,
      status: { $in: ['open', 'reviewing'] },
    });
    if (existing) {
      res.status(409).json({ success: false, message: 'You have already reported this item. Your report is under review.' });
      return;
    }

    // Build a snapshot of the reported content so moderators have context
    // even if the content is later deleted
    let snapshot: any = {};
    if (targetType === 'message') {
      const msg = await Message.findOne({ _id: targetId, companyId })
        .populate('senderId', 'fullName');
      if (msg) {
        snapshot = {
          content:        msg.deletedAt ? '[Message was deleted before report was filed]' : msg.content,
          senderName:     (msg.senderId as any)?.fullName || 'Unknown',
          senderId:       msg.senderId?.toString(),
          conversationId: msg.conversationId?.toString(),
          channelId:      msg.channelId?.toString(),
          createdAt:      msg.createdAt,
        };
      }
    } else if (targetType === 'user') {
      const targetUser = await User.findOne({ _id: targetId, companyId });
      if (targetUser) {
        snapshot = {
          senderName: targetUser.fullName,
          senderId:   targetUser._id.toString(),
        };
      }
    }

    const report = await Report.create({
      companyId,
      reporterId: uid,
      targetType,
      targetId,
      targetSnapshot: snapshot,
      reason,
      details: details?.trim() || undefined,
      severity: severity || 'medium',
      status: 'open',
      actions: [],
    });

    await AuditLog.create({
      companyId,
      userId:     uid,
      action:     'REPORT_SUBMITTED',
      resource:   'Report',
      resourceId: report._id.toString(),
      details:    { targetType, targetId, reason },
      ipAddress:  req.ip,
    }).catch(() => {});

    res.status(201).json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── List reports (owner/admin only) ──────────────────────────────────────────

export const getReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status, severity, targetType, page = 1, limit = 20, search,
    } = req.query;

    const filter: any = { companyId: req.user!.companyId };
    if (status     && status     !== 'all') filter.status     = status;
    if (severity   && severity   !== 'all') filter.severity   = severity;
    if (targetType && targetType !== 'all') filter.targetType = targetType;

    const total   = await Report.countDocuments(filter);
    const reports = await Report.find(filter)
      .populate('reporterId', 'fullName avatar email')
      .populate('assignedTo', 'fullName avatar')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Dashboard summary counts
    const [openCount, reviewingCount, resolvedToday] = await Promise.all([
      Report.countDocuments({ companyId: req.user!.companyId, status: 'open' }),
      Report.countDocuments({ companyId: req.user!.companyId, status: 'reviewing' }),
      Report.countDocuments({
        companyId: req.user!.companyId,
        status: 'resolved',
        updatedAt: { $gte: new Date(Date.now() - 86_400_000) },
      }),
    ]);

    res.json({
      success: true,
      reports,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      summary: { openCount, reviewingCount, resolvedToday },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get single report with full context ──────────────────────────────────────

export const getReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    })
      .populate('reporterId', 'fullName avatar email role department')
      .populate('assignedTo', 'fullName avatar')
      .populate('actions.moderatorId', 'fullName avatar');

    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    // Fetch live current state of the reported content if still present
    let liveContent: any = null;
    if (report.targetType === 'message') {
      liveContent = await Message.findOne({ _id: report.targetId, companyId: req.user!.companyId })
        .populate('senderId', 'fullName avatar email')
        .lean();
    } else if (report.targetType === 'user') {
      liveContent = await User.findOne({ _id: report.targetId, companyId: req.user!.companyId })
        .select('fullName avatar email role isActive lastSeen createdAt')
        .lean();
    }

    res.json({ success: true, report, liveContent });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Take moderation action on a report ────────────────────────────────────────

export const moderateReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, note, newStatus, severity } = req.body;
    const uid      = req.user!.userId;
    const companyId = req.user!.companyId;

    const report = await Report.findOne({ _id: req.params.id, companyId });
    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    const validActions = [
      'REVIEWED',
      'MESSAGE_DELETED',
      'USER_WARNED',
      'USER_SUSPENDED',
      'RESOLVED',
      'DISMISSED',
      'ESCALATED',
      'ASSIGNED',
    ];
    if (!validActions.includes(action)) {
      res.status(400).json({ success: false, message: `Invalid action. Allowed: ${validActions.join(', ')}` });
      return;
    }

    // Perform side effects based on action
    if (action === 'MESSAGE_DELETED' && report.targetType === 'message') {
      await Message.findOneAndUpdate(
        { _id: report.targetId, companyId },
        { deletedAt: new Date(), content: '[Removed by moderator]' }
      );
    } else if (action === 'USER_SUSPENDED' && report.targetType === 'user') {
      await User.findOneAndUpdate(
        { _id: report.targetId, companyId },
        { isActive: false, refreshTokens: [] }
      );
    }

    // Append moderation action to trail
    report.actions.push({
      moderatorId: new mongoose.Types.ObjectId(uid),
      action,
      note: note?.trim() || undefined,
      timestamp: new Date(),
    });

    // Update status and/or severity if provided
    if (newStatus && ['open','reviewing','resolved','dismissed'].includes(newStatus)) {
      report.status = newStatus;
    } else if (action === 'RESOLVED' || action === 'DISMISSED') {
      report.status = action === 'RESOLVED' ? 'resolved' : 'dismissed';
    } else if (action === 'REVIEWED') {
      report.status = 'reviewing';
    }

    if (severity && ['low','medium','high','critical'].includes(severity)) {
      report.severity = severity;
    }

    report.assignedTo = new mongoose.Types.ObjectId(uid);
    await report.save();

    // Audit log every moderator action
    await AuditLog.create({
      companyId,
      userId:     uid,
      action:     `MODERATION_${action}`,
      resource:   'Report',
      resourceId: report._id.toString(),
      details:    { reportId: report._id, action, note, targetType: report.targetType, targetId: report.targetId },
      ipAddress:  req.ip,
    }).catch(() => {});

    const updated = await Report.findById(report._id)
      .populate('reporterId', 'fullName avatar email')
      .populate('assignedTo', 'fullName avatar')
      .populate('actions.moderatorId', 'fullName avatar');

    res.json({ success: true, report: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get moderation dashboard stats ───────────────────────────────────────────

export const getModerationStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const oneDayAgo   = new Date(Date.now() - 86_400_000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [
      totalOpen, totalReviewing, resolvedToday,
      highSeverityOpen, reportsThisWeek, totalReports,
    ] = await Promise.all([
      Report.countDocuments({ companyId, status: 'open' }),
      Report.countDocuments({ companyId, status: 'reviewing' }),
      Report.countDocuments({ companyId, status: 'resolved', updatedAt: { $gte: oneDayAgo } }),
      Report.countDocuments({ companyId, status: { $in: ['open','reviewing'] }, severity: { $in: ['high','critical'] } }),
      Report.countDocuments({ companyId, createdAt: { $gte: sevenDaysAgo } }),
      Report.countDocuments({ companyId }),
    ]);

    // Recent activity (last 10 moderation actions across all reports)
    const recentActivity = await Report.find({ companyId, 'actions.0': { $exists: true } })
      .select('actions targetType reason status')
      .populate('actions.moderatorId', 'fullName avatar')
      .sort({ updatedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalOpen,
        totalReviewing,
        resolvedToday,
        highSeverityOpen,
        reportsThisWeek,
        totalReports,
      },
      recentActivity,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
