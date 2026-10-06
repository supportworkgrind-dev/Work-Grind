import { Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import Channel from '../models/Channel';
import User from '../models/User';
import Task from '../models/Task';
import { CrmCompany } from '../models/CrmCompany';
import Meeting from '../models/Meeting';
import Document from '../models/Document';
import File from '../models/File';
import { ClientUser, ClientMessage } from '../models/ClientPortal';
import ClientRequestModel from '../models/ClientRequest';
import Approval from '../models/Approval';
import { AuthRequest } from '../middleware/auth';
import { emitToCompany } from '../utils/socket';
import { getEffectiveSubscription } from '../services/companySubscription';

async function validateCrmCompanyId(value: unknown, companyId: string): Promise<{ id?: mongoose.Types.ObjectId; error?: string }> {
  if (value == null || value === '') return {};
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    return { error: 'Invalid CRM company id.' };
  }
  const crmCompany = await CrmCompany.findOne({ _id: value, companyId }).select('_id').lean();
  if (!crmCompany) return { error: 'CRM company must belong to this workspace.' };
  return { id: new mongoose.Types.ObjectId(value) };
}

function projectAccessFilter(req: AuthRequest, projectId: string): Record<string, any> {
  const filter: Record<string, any> = { _id: projectId, companyId: req.user!.companyId, isArchived: false };
  if (req.user!.role === 'employee') {
    filter.$or = [
      { 'members.userId': req.user!.userId },
      { assigneeId: req.user!.userId },
      { managerId: req.user!.userId },
    ];
  }
  return filter;
}

/**
 * Helper to generate a clean, safe, and unique channel name for a project
 */
const generateSafeUniqueChannelName = async (
  projectName: string,
  companyId: string | mongoose.Types.ObjectId
): Promise<string> => {
  // Normalize: lowercase, replace spaces & special characters with hyphens
  let baseName = projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseName || baseName.length < 2) {
    baseName = 'project';
  }

  // Ensure maximum length of 50 chars for channel name
  baseName = baseName.substring(0, 40);

  let candidateName = baseName;
  let counter = 1;

  while (await Channel.findOne({ companyId, name: candidateName })) {
    counter += 1;
    candidateName = `${baseName}-${counter}`;
  }

  return candidateName;
};

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, limit } = req.query;
    const filter: any = {
      companyId: req.user!.companyId,
      isArchived: false,
    };

    if (status) {
      filter.status = status;
    }

    if (req.user!.role === 'employee') {
      filter.$or = [
        { 'members.userId': req.user!.userId },
        { assigneeId: req.user!.userId },
        { managerId: req.user!.userId },
      ];
    }

    let query = Project.find(filter)
      .populate('managerId', 'fullName avatar email jobTitle')
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('members.userId', 'fullName avatar email jobTitle')
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('channelId', 'name type isArchived members')
      .sort({ createdAt: -1 });

    if (limit) {
      query = query.limit(Number(limit));
    }

    const projects = await query.lean();

    res.json({ success: true, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  let createdProject: any = null;

  try {
    const {
      name,
      description,
      color,
      priority = 'medium',
      status = 'planning',
      startDate,
      deadline,
      crmCompanyId,
      assigneeId,
      memberIds = [],
    } = req.body;

    const companyId = req.user!.companyId;
    const creatorId = req.user!.userId;

    const crmCompany = await validateCrmCompanyId(crmCompanyId, companyId);
    if (crmCompany.error) {
      res.status(400).json({ success: false, message: crmCompany.error });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Project name is required' });
      return;
    }

    // 1. Validate workspace assignee if provided
    let finalAssigneeId = creatorId;
    if (assigneeId) {
      const validAssignee = await User.findOne({
        _id: assigneeId,
        companyId,
        isActive: true,
      });

      if (!validAssignee) {
        res.status(400).json({
          success: false,
          message: 'The selected project assignee is not an active member of this workspace',
        });
        return;
      }
      finalAssigneeId = assigneeId;
    }

    // 2. Validate workspace project members
    const rawMemberIds = Array.isArray(memberIds)
      ? memberIds.map((m: any) => (typeof m === 'object' && m?.userId ? m.userId : m))
      : [];

    const validWorkspaceUsers = rawMemberIds.length > 0
      ? await User.find({
          _id: { $in: rawMemberIds },
          companyId,
          isActive: true,
        }).select('_id')
      : [];

    const validatedMemberIdStrings = validWorkspaceUsers.map((u) => u._id.toString());

    // Combine members: Creator (manager), Assignee, and selected members (deduplicated)
    const allMemberIdSet = new Set<string>([
      creatorId.toString(),
      finalAssigneeId.toString(),
      ...validatedMemberIdStrings,
    ]);

    const projectMembers = Array.from(allMemberIdSet).map((userIdStr) => ({
      userId: new mongoose.Types.ObjectId(userIdStr),
      role: userIdStr === creatorId.toString() || userIdStr === finalAssigneeId.toString()
        ? 'manager'
        : 'member',
    }));

    // 3. Create Project Record
    createdProject = await Project.create({
      companyId,
      crmCompanyId: crmCompany.id,
      managerId: creatorId,
      assigneeId: finalAssigneeId,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      color: color || '#4F46E5',
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: ['planning', 'active', 'on_hold', 'completed'].includes(status) ? status : 'planning',
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      members: projectMembers,
      progress: 0,
    });

    // 4. Automatic Project Channel Creation
    const safeChannelName = await generateSafeUniqueChannelName(name, companyId);
    const channelMemberObjectIds = Array.from(allMemberIdSet).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    let createdChannel: any = null;
    try {
      createdChannel = await Channel.create({
        companyId,
        projectId: createdProject._id,
        name: safeChannelName,
        description: description ? description.trim() : `Dedicated discussion channel for ${name.trim()}`,
        type: 'public',
        createdBy: creatorId,
        members: channelMemberObjectIds,
        isDefault: false,
      });
    } catch (channelErr: any) {
      // Rollback project creation if channel creation fails
      if (createdProject && createdProject._id) {
        await Project.findByIdAndDelete(createdProject._id);
      }
      throw new Error(`Failed to create dedicated project channel: ${channelErr.message}`);
    }

    // 5. Link Channel ID to Project
    createdProject.channelId = createdChannel._id;
    await createdProject.save();

    // 6. Populate for response
    const populatedProject = await Project.findById(createdProject._id)
      .populate('managerId', 'fullName avatar email jobTitle')
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('members.userId', 'fullName avatar email jobTitle')
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('channelId', 'name type isArchived members');

    const populatedChannel = await Channel.findById(createdChannel._id)
      .populate('members', 'fullName avatar status')
      .populate('projectId', 'name color status progress priority');

    // Emit realtime notifications to company
    emitToCompany(companyId.toString(), 'project:created', populatedProject);
    emitToCompany(companyId.toString(), 'channel:created', populatedChannel);

    res.status(201).json({
      success: true,
      project: populatedProject,
      channel: populatedChannel,
      message: `Project created and dedicated channel #${safeChannelName} generated.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid project id' });
      return;
    }
    const project = await Project.findOne(projectAccessFilter(req, req.params.id))
      .populate('managerId', 'fullName avatar email jobTitle')
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('members.userId', 'fullName avatar email jobTitle')
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('channelId', 'name type isArchived members')
      .lean();

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    res.json({ success: true, project });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assigneeId, memberIds, crmCompanyId, ...rest } = req.body;
    const companyId = req.user!.companyId;

    const updates: any = { ...rest };

    if (crmCompanyId !== undefined) {
      const crmCompany = await validateCrmCompanyId(crmCompanyId, companyId);
      if (crmCompany.error) {
        res.status(400).json({ success: false, message: crmCompany.error });
        return;
      }
      updates.crmCompanyId = crmCompany.id ?? null;
    }

    if (assigneeId) {
      const validAssignee = await User.findOne({
        _id: assigneeId,
        companyId,
        isActive: true,
      });
      if (validAssignee) {
        updates.assigneeId = assigneeId;
      }
    }

    if (Array.isArray(memberIds)) {
      const rawMemberIds = memberIds.map((m: any) => (typeof m === 'object' && m?.userId ? m.userId : m));
      const validWorkspaceUsers = await User.find({
        _id: { $in: rawMemberIds },
        companyId,
        isActive: true,
      }).select('_id');

      updates.members = validWorkspaceUsers.map((u) => ({
        userId: u._id,
        role: 'member',
      }));
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, companyId },
      updates,
      { new: true }
    )
      .populate('managerId', 'fullName avatar email jobTitle')
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('members.userId', 'fullName avatar email jobTitle')
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('channelId', 'name type isArchived members');

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Broadcast project update so all team members see the latest data in real-time
    emitToCompany(companyId.toString(), 'project:updated', project);

    res.json({ success: true, project });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      { isArchived: true },
      { new: true }
    );

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    res.json({ success: true, message: 'Project archived' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProjectTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid project id' });
      return;
    }
    const project = await Project.exists(projectAccessFilter(req, req.params.id));
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }
    const tasks = await Task.find({
      projectId: req.params.id,
      companyId: req.user!.companyId,
      isArchived: false,
    })
      .populate('assigneeId', 'fullName avatar email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProjectConnectedData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid project id' });
      return;
    }

    const project = await Project.findOne(projectAccessFilter(req, id))
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('managerId', 'fullName avatar')
      .populate('assigneeId', 'fullName avatar')
      .populate('members.userId', 'fullName avatar')
      .lean();
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    const subscription = await getEffectiveSubscription(req.user!.userId);
    const canReadMeetings = subscription.planConfig.entitlements.meetingsCalendar;
    const canReadResources = subscription.planConfig.entitlements.fileStorage;
    const canReadClientActivity = ['owner', 'admin', 'manager'].includes(req.user!.role);
    const projectObjectId = new mongoose.Types.ObjectId(id);

    const [tasks, meetings, documents, files] = await Promise.all([
      Task.find({ companyId: req.user!.companyId, projectId: projectObjectId, isArchived: false })
        .select('_id projectId title status priority dueDate assigneeId createdAt completedAt')
        .populate('assigneeId', 'fullName avatar')
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
      canReadMeetings ? Meeting.find({ companyId: req.user!.companyId, projectId: projectObjectId })
        .select('_id title description hostId participants projectId crmCompanyId crmContactIds scheduledAt startedAt endedAt status aiSummary createdAt updatedAt')
        .populate('hostId', 'fullName avatar')
        .populate('participants.userId', 'fullName avatar')
        .populate('crmContactIds', 'firstName lastName email')
        .sort({ scheduledAt: -1, createdAt: -1 })
        .limit(50)
        .lean() : Promise.resolve([]),
      canReadResources ? Document.find({ companyId: req.user!.companyId, projectId: projectObjectId, isArchived: false })
        .select('_id title type icon creatorId updatedAt createdAt')
        .populate('creatorId', 'fullName avatar')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean() : Promise.resolve([]),
      canReadResources ? File.find({ companyId: req.user!.companyId, projectId: projectObjectId, isDeleted: false })
        .select('_id name originalName mimeType size uploaderId createdAt')
        .populate('uploaderId', 'fullName avatar')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean() : Promise.resolve([]),
    ]);

    let clientActivity: any[] = [];
    let clientRequests: any[] = [];
    let approvals: any[] = [];
    let clientApprovers: { id: string; fullName: string; sharedProjects: string[]; sharedMeetings: string[]; sharedDocuments: string[]; sharedFiles: string[] }[] = [];
    if (canReadClientActivity) {
      const clients = await ClientUser.find({ companyId: req.user!.companyId, isActive: true, sharedProjects: projectObjectId })
        .select('_id fullName sharedProjects sharedMeetings sharedDocs sharedFiles')
        .lean();
      clientApprovers = clients.map((client) => ({
        id: client._id.toString(),
        fullName: client.fullName,
        sharedProjects: client.sharedProjects.map((sharedId) => sharedId.toString()),
        sharedMeetings: client.sharedMeetings.map((sharedId) => sharedId.toString()),
        sharedDocuments: client.sharedDocs.map((sharedId) => sharedId.toString()),
        sharedFiles: client.sharedFiles.map((sharedId) => sharedId.toString()),
      }));
      const clientIds = clients.map((client) => client._id);
      if (clientIds.length) {
        clientActivity = await ClientMessage.find({ companyId: req.user!.companyId, clientUserId: { $in: clientIds }, senderType: 'client' })
          .select('_id senderName content createdAt')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
      }
      clientRequests = await ClientRequestModel.find({ companyId: req.user!.companyId, projectId: projectObjectId })
        .populate('clientUserId', 'fullName')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
    }

    const approvalFilter: Record<string, any> = { companyId: req.user!.companyId, projectId: projectObjectId };
    if (!canReadClientActivity) approvalFilter.$or = [{ requesterId: req.user!.userId }, { approverId: req.user!.userId }];
    approvals = await Approval.find(approvalFilter).sort({ updatedAt: -1 }).limit(100).lean();

    const activity = [
      { id: `project-${project._id}`, type: 'project', title: `Project updated: ${project.name}`, createdAt: project.updatedAt, href: '/projects' },
      ...tasks.flatMap((task) => [
        { id: `task-${task._id}`, type: 'task', title: `Task created: ${task.title}`, createdAt: task.createdAt, href: '/tasks' },
        ...(task.completedAt ? [{ id: `task-completed-${task._id}`, type: 'task_completed', title: `Task completed: ${task.title}`, createdAt: task.completedAt, href: '/tasks' }] : []),
      ]),
      ...meetings.map((meeting) => ({ id: `meeting-${meeting._id}`, type: meeting.status === 'ended' ? 'meeting_completed' : 'meeting', title: `${meeting.status === 'ended' ? 'Meeting completed' : 'Meeting scheduled'}: ${meeting.title}`, createdAt: meeting.endedAt ?? meeting.scheduledAt ?? meeting.createdAt, href: '/meetings' })),
      ...documents.map((document) => ({ id: `document-${document._id}`, type: 'document', title: `Document updated: ${document.title}`, createdAt: document.updatedAt, href: '/docs' })),
      ...files.map((file) => ({ id: `file-${file._id}`, type: 'file', title: `File uploaded: ${file.name}`, createdAt: file.createdAt, href: '/files' })),
      ...clientActivity.map((message) => ({ id: `client-message-${message._id}`, type: 'client_message', title: `${message.senderName}: ${message.content.slice(0, 180)}`, createdAt: message.createdAt, href: '/client-portal-mgmt' })),
      ...clientRequests.flatMap((request) => [
        { id: `client-request-${request._id}`, type: 'client_request', title: `Client request submitted: ${request.title}`, createdAt: request.createdAt, href: '/client-portal-mgmt' },
        ...(request.comments ?? []).map((comment: any, index: number) => ({ id: `client-request-comment-${request._id}-${index}`, type: 'client_request_update', title: `${comment.authorName}: ${comment.content.slice(0, 180)}`, createdAt: comment.createdAt, href: '/client-portal-mgmt' })),
      ]),
      ...approvals.flatMap((approval) => (approval.history ?? []).map((entry: any, index: number) => ({ id: `approval-${approval._id}-${index}`, type: `approval_${entry.status}`, title: `${entry.actorName}: ${approval.title}${entry.comment ? ` — ${entry.comment.slice(0, 140)}` : ''}`, createdAt: entry.createdAt, href: '/projects' }))),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 75);

    res.json({
      success: true,
      project,
      tasks,
      meetings,
      documents,
      files,
      clientActivity,
      clientRequests,
      approvals,
      clientApprovers,
      activity,
      access: { meetings: canReadMeetings, resources: canReadResources, clientActivity: canReadClientActivity },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProjectStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;
    const companyId = req.user!.companyId;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ success: false, message: 'Invalid project id' });
      return;
    }
    if (!await Project.exists(projectAccessFilter(req, projectId))) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    const [total, completed, inProgress, review, todo] = await Promise.all([
      Task.countDocuments({ projectId, companyId, isArchived: false }),
      Task.countDocuments({ projectId, companyId, status: 'completed', isArchived: false }),
      Task.countDocuments({ projectId, companyId, status: 'in_progress', isArchived: false }),
      Task.countDocuments({ projectId, companyId, status: 'review', isArchived: false }),
      Task.countDocuments({ projectId, companyId, status: 'todo', isArchived: false }),
    ]);

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      success: true,
      stats: { total, completed, inProgress, review, todo, progress },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
