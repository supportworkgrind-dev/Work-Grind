import { Response, Request } from 'express';
import mongoose from 'mongoose';
import Approval, { ApprovalStatus, ApprovalTargetType } from '../models/Approval';
import Project from '../models/Project';
import Task from '../models/Task';
import Meeting from '../models/Meeting';
import Document from '../models/Document';
import File from '../models/File';
import User from '../models/User';
import { ClientUser } from '../models/ClientPortal';
import { AuthRequest } from '../middleware/auth';
import { getEffectiveSubscription } from '../services/companySubscription';

interface ClientApprovalRequest extends Request {
  client?: { clientUserId: string; companyId: string };
}

const ALLOWED_RESPONSES = new Set<ApprovalStatus>(['approved', 'rejected', 'changes_requested']);
const TARGET_TYPES = new Set<ApprovalTargetType>(['project', 'task', 'meeting', 'document', 'file']);

function canManage(role: string): boolean {
  return ['owner', 'admin', 'manager'].includes(role);
}

function hasId(ids: mongoose.Types.ObjectId[], id: string): boolean {
  return ids.some((candidate) => candidate.toString() === id);
}

async function resolveTarget(targetType: ApprovalTargetType, targetId: string, companyId: string) {
  if (targetType === 'project') {
    const project = await Project.findOne({ _id: targetId, companyId, isArchived: false }).select('_id name crmCompanyId').lean();
    return project ? { target: project, projectId: project._id, crmCompanyId: project.crmCompanyId, title: project.name } : null;
  }

  if (targetType === 'task') {
    const task = await Task.findOne({ _id: targetId, companyId, isArchived: false }).select('_id title projectId').lean();
    if (!task?.projectId) return null;
    const project = await Project.findOne({ _id: task.projectId, companyId, isArchived: false }).select('_id crmCompanyId').lean();
    return project ? { target: task, projectId: project._id, crmCompanyId: project.crmCompanyId, title: task.title } : null;
  }

  if (targetType === 'meeting') {
    const meeting = await Meeting.findOne({ _id: targetId, companyId }).select('_id title projectId crmCompanyId').lean();
    if (!meeting?.projectId) return null;
    const project = await Project.findOne({ _id: meeting.projectId, companyId, isArchived: false }).select('_id crmCompanyId').lean();
    return project ? { target: meeting, projectId: project._id, crmCompanyId: project.crmCompanyId ?? meeting.crmCompanyId, title: meeting.title } : null;
  }

  if (targetType === 'document') {
    const document = await Document.findOne({ _id: targetId, companyId, isArchived: false }).select('_id title projectId').lean();
    if (!document?.projectId) return null;
    const project = await Project.findOne({ _id: document.projectId, companyId, isArchived: false }).select('_id crmCompanyId').lean();
    return project ? { target: document, projectId: project._id, crmCompanyId: project.crmCompanyId, title: document.title } : null;
  }

  const file = await File.findOne({ _id: targetId, companyId, isDeleted: false }).select('_id name projectId').lean();
  if (!file?.projectId) return null;
  const project = await Project.findOne({ _id: file.projectId, companyId, isArchived: false }).select('_id crmCompanyId').lean();
  return project ? { target: file, projectId: project._id, crmCompanyId: project.crmCompanyId, title: file.name } : null;
}

async function clientHasExplicitTargetAccess(
  client: { sharedProjects: mongoose.Types.ObjectId[]; sharedMeetings: mongoose.Types.ObjectId[]; sharedDocs: mongoose.Types.ObjectId[]; sharedFiles: mongoose.Types.ObjectId[] },
  targetType: ApprovalTargetType,
  targetId: string,
  projectId: string,
): Promise<boolean> {
  if (targetType === 'project') return hasId(client.sharedProjects, projectId);
  if (targetType === 'meeting') return hasId(client.sharedMeetings, targetId);
  if (targetType === 'document') return hasId(client.sharedDocs, targetId);
  if (targetType === 'file') return hasId(client.sharedFiles, targetId);
  return false;
}

export const createApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const { targetType, targetId, approverUserId, clientUserId, description, dueAt, comment } = req.body;
    if (!TARGET_TYPES.has(targetType) || typeof targetId !== 'string' || !mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: 'Choose a valid approval target.' });
      return;
    }
    if ((!approverUserId && !clientUserId) || (approverUserId && clientUserId)) {
      res.status(400).json({ success: false, message: 'Choose exactly one internal or client approver.' });
      return;
    }

    const subscription = await getEffectiveSubscription(req.user!.userId);
    const entitlement = targetType === 'meeting'
      ? 'meetingsCalendar'
      : targetType === 'document' || targetType === 'file' ? 'fileStorage' : 'tasksProjects';
    if (!subscription.planConfig.entitlements[entitlement]) {
      res.status(403).json({ success: false, code: 'PLAN_UPGRADE_REQUIRED', message: 'Your plan does not include this approval target.' });
      return;
    }

    const resolved = await resolveTarget(targetType, targetId, companyId);
    if (!resolved) {
      res.status(404).json({ success: false, message: 'Approval target was not found in this workspace or is not linked to a project.' });
      return;
    }

    let approverType: 'employee' | 'client';
    let approverId: mongoose.Types.ObjectId;
    let approverName: string;
    if (clientUserId) {
      if (typeof clientUserId !== 'string' || !mongoose.Types.ObjectId.isValid(clientUserId)) {
        res.status(400).json({ success: false, message: 'Invalid client approver.' });
        return;
      }
      const client = await ClientUser.findOne({ _id: clientUserId, companyId, isActive: true }).select('_id fullName sharedProjects sharedMeetings sharedDocs sharedFiles').lean();
      if (!client || !await clientHasExplicitTargetAccess(client, targetType, targetId, resolved.projectId.toString())) {
        res.status(403).json({ success: false, message: 'The client must have explicit access to the approval target.' });
        return;
      }
      approverType = 'client';
      approverId = client._id;
      approverName = client.fullName;
    } else {
      if (typeof approverUserId !== 'string' || !mongoose.Types.ObjectId.isValid(approverUserId)) {
        res.status(400).json({ success: false, message: 'Invalid internal approver.' });
        return;
      }
      const user = await User.findOne({ _id: approverUserId, companyId, isActive: true }).select('_id fullName').lean();
      if (!user) {
        res.status(400).json({ success: false, message: 'Approver must be an active member of this workspace.' });
        return;
      }
      approverType = 'employee';
      approverId = user._id;
      approverName = user.fullName;
    }

    const requester = await User.findOne({ _id: req.user!.userId, companyId }).select('_id fullName').lean();
    if (!requester) { res.status(401).json({ success: false, message: 'Authenticated workspace member not found.' }); return; }
    const approval = await Approval.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      crmCompanyId: resolved.crmCompanyId,
      projectId: resolved.projectId,
      targetType,
      targetId: new mongoose.Types.ObjectId(targetId),
      title: typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 200) : resolved.title,
      description: typeof description === 'string' ? description.trim().slice(0, 4000) : undefined,
      requesterType: 'employee',
      requesterId: requester._id,
      requesterName: requester.fullName,
      approverType,
      approverId,
      approverName,
      status: 'pending',
      dueAt: dueAt && Number.isFinite(new Date(dueAt).getTime()) ? new Date(dueAt) : undefined,
      history: [{ actorType: 'employee', actorId: requester._id, actorName: requester.fullName, status: 'pending', comment: typeof comment === 'string' ? comment.trim().slice(0, 4000) : undefined, createdAt: new Date() }],
    });

    res.status(201).json({ success: true, approval });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getApprovals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const filter: Record<string, any> = { companyId };
    const subscription = await getEffectiveSubscription(req.user!.userId);
    const allowedTargetTypes: ApprovalTargetType[] = [];
    if (subscription.planConfig.entitlements.tasksProjects) allowedTargetTypes.push('project', 'task');
    if (subscription.planConfig.entitlements.meetingsCalendar) allowedTargetTypes.push('meeting');
    if (subscription.planConfig.entitlements.fileStorage) allowedTargetTypes.push('document', 'file');
    if (!allowedTargetTypes.length) {
      res.json({ success: true, approvals: [] });
      return;
    }
    filter.targetType = { $in: allowedTargetTypes };
    if (typeof req.query.projectId === 'string') filter.projectId = req.query.projectId;
    if (typeof req.query.crmCompanyId === 'string') filter.crmCompanyId = req.query.crmCompanyId;
    if (typeof req.query.status === 'string') filter.status = req.query.status;

    if (!canManage(req.user!.role)) {
      const projects = await Project.find({
        companyId,
        isArchived: false,
        $or: [
          { 'members.userId': req.user!.userId },
          { assigneeId: req.user!.userId },
          { managerId: req.user!.userId },
        ],
      }).select('_id').lean();
      filter.$and = [
        { projectId: { $in: projects.map((project) => project._id) } },
        { $or: [{ requesterId: req.user!.userId }, { approverId: req.user!.userId }] },
      ];
    }

    const approvals = await Approval.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ success: true, approvals });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const respondToApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ALLOWED_RESPONSES.has(req.body.status)) {
      res.status(400).json({ success: false, message: 'Choose approved, rejected, or changes_requested.' });
      return;
    }
    const targetApproval = await Approval.findOne({ _id: req.params.id, companyId: req.user!.companyId, approverType: 'employee' });
    if (!targetApproval) { res.status(404).json({ success: false, message: 'Internal approval not found.' }); return; }
    if (!canManage(req.user!.role) && targetApproval.approverId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Only the assigned approver can respond.' });
      return;
    }
    if (targetApproval.status !== 'pending') {
      res.status(409).json({ success: false, message: 'This approval has already been resolved.' });
      return;
    }
    const user = await User.findOne({ _id: req.user!.userId, companyId: req.user!.companyId }).select('_id fullName').lean();
    if (!user) { res.status(401).json({ success: false, message: 'Workspace member not found.' }); return; }
    targetApproval.status = req.body.status;
    targetApproval.history.push({ actorType: 'employee', actorId: user._id, actorName: user.fullName, status: req.body.status, comment: typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 4000) : undefined, createdAt: new Date() });
    await targetApproval.save();
    res.json({ success: true, approval: targetApproval });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getClientApprovals = async (req: ClientApprovalRequest, res: Response): Promise<void> => {
  try {
    const client = await ClientUser.findOne({ _id: req.client!.clientUserId, companyId: req.client!.companyId, isActive: true }).select('_id');
    if (!client) { res.status(403).json({ success: false, message: 'Client account is not active.' }); return; }
    const approvals = await Approval.find({ companyId: client.companyId, approverType: 'client', approverId: client._id }).sort({ updatedAt: -1 }).limit(100).lean();
    const visibleApprovals = await Promise.all(approvals.map(async (approval) => {
      const resolved = await resolveTarget(approval.targetType, approval.targetId.toString(), client.companyId.toString());
      if (!resolved || !await clientHasExplicitTargetAccess(client, approval.targetType, approval.targetId.toString(), approval.projectId.toString())) return null;
      return approval;
    }));
    res.json({ success: true, approvals: visibleApprovals.filter((approval): approval is NonNullable<typeof approval> => approval !== null) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const respondToClientApproval = async (req: ClientApprovalRequest, res: Response): Promise<void> => {
  try {
    if (!ALLOWED_RESPONSES.has(req.body.status)) {
      res.status(400).json({ success: false, message: 'Choose approved, rejected, or changes_requested.' });
      return;
    }
    const client = await ClientUser.findOne({ _id: req.client!.clientUserId, companyId: req.client!.companyId, isActive: true }).select('_id fullName sharedProjects sharedMeetings sharedDocs sharedFiles').lean();
    if (!client) { res.status(403).json({ success: false, message: 'Client account is not active.' }); return; }
    const approval = await Approval.findOne({ _id: req.params.id, companyId: client.companyId, approverType: 'client', approverId: client._id });
    if (!approval) { res.status(404).json({ success: false, message: 'Approval not found.' }); return; }
    if (approval.status !== 'pending') { res.status(409).json({ success: false, message: 'This approval has already been resolved.' }); return; }
    const resolved = await resolveTarget(approval.targetType, approval.targetId.toString(), client.companyId.toString());
    if (!resolved || !await clientHasExplicitTargetAccess(client, approval.targetType, approval.targetId.toString(), approval.projectId.toString())) {
      res.status(403).json({ success: false, message: 'The resource is no longer shared with this client.' });
      return;
    }
    approval.status = req.body.status;
    approval.history.push({ actorType: 'client', actorId: client._id, actorName: client.fullName, status: req.body.status, comment: typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 4000) : undefined, createdAt: new Date() });
    await approval.save();
    res.json({ success: true, approval });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};