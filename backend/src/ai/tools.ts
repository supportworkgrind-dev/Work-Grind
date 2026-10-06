/**
 * WorkGrind AI Agent Tool Definitions
 *
 * Each tool has:
 *   - An OpenAI function-calling schema (for the LLM to pick)
 *   - An execute() handler that runs against the DB with workspace isolation
 *
 * SECURITY:
 *   - companyId is ALWAYS injected server-side from req.user — never from LLM output
 *   - userId is similarly injected server-side
 *   - All DB queries are scoped by companyId
 *   - Retrieved content is treated as untrusted data (never fed back to system prompt)
 */

import mongoose from 'mongoose';
import Task      from '../models/Task';
import Project   from '../models/Project';
import Meeting   from '../models/Meeting';
import CalendarEvent from '../models/CalendarEvent';
import Channel   from '../models/Channel';
import Message   from '../models/Message';
import User      from '../models/User';
import { CrmContact } from '../models/CrmContact';
import { CrmDeal }    from '../models/CrmDeal';
import { CrmCompany } from '../models/CrmCompany';
import Document  from '../models/Document';
import File      from '../models/File';

// ── Tool context injected server-side ─────────────────────────────────────────

export interface ToolContext {
  companyId: string;
  userId:    string;
  userRole:  string;
  planName?: string;
  planId?: string;
  enabledFeatures?: string[];
  aiRequestsLimit?: number;
  aiRequestsUsed?: number;
}

// ── Tool result type ──────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?:   any;
  error?:  string;
  /** Set to true if the AI should ask the user to confirm before proceeding */
  requiresConfirmation?: boolean;
  confirmationMessage?:  string;
}

// ── Helper: sanitize mongo doc for LLM (remove sensitive fields) ──────────────

function sanitize(value: any): any {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitize);

  const source = typeof value.toObject === 'function' ? value.toObject() : value;
  const clean: Record<string, any> = {};
  for (const [key, field] of Object.entries(source)) {
    if (key === '__v' || /password|token|secret|api.?key|credential|authorization|jwt|private.?key|cookie|environment/i.test(key)) continue;
    clean[key] = sanitize(field);
  }
  return clean;
}

function canManageWorkspace(ctx: ToolContext): boolean {
  return ['owner', 'admin', 'manager'].includes(ctx.userRole);
}

function sanitizeArr(arr: any[]): any[] {
  return arr.map(sanitize);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentTool {
  /** Must match OpenAI function name */
  name:        string;
  description: string;
  parameters:  Record<string, any>; // JSON Schema
  execute:     (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;
}

export const TOOLS: AgentTool[] = [

  // ── TASKS ──────────────────────────────────────────────────────────────────

  {
    name: 'searchTasks',
    description: 'Search tasks in the workspace. Can filter by status, priority, assignee, overdue, or free-text query.',
    parameters: {
      type: 'object',
      properties: {
        query:    { type: 'string', description: 'Free-text search on task title' },
        status:   { type: 'string', enum: ['todo','in_progress','review','completed','blocked'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low','medium','high','urgent'] },
        overdue:  { type: 'boolean', description: 'If true, only return overdue tasks' },
        assignedToMe: { type: 'boolean', description: 'If true, only tasks assigned to the requesting user' },
        limit:    { type: 'number', description: 'Max results (default 20)' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId, isArchived: false };
      if (!canManageWorkspace(ctx)) {
        filter.$or = [
          { assigneeId: new mongoose.Types.ObjectId(ctx.userId) },
          { creatorId: new mongoose.Types.ObjectId(ctx.userId) },
        ];
      }
      if (args.status)   filter.status   = args.status;
      if (args.priority) filter.priority = args.priority;
      if (args.assignedToMe) filter.assigneeId = new mongoose.Types.ObjectId(ctx.userId);
      if (args.overdue)  { filter.dueDate = { $lt: new Date() }; filter.status = { $ne: 'completed' }; }
      if (args.query)    filter.title = { $regex: args.query, $options: 'i' };

      const tasks = await Task.find(filter)
        .populate('assigneeId', 'fullName email avatar')
        .populate('projectId',  'name color')
        .sort({ dueDate: 1, priority: -1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();

      return { success: true, data: { tasks: sanitizeArr(tasks), count: tasks.length } };
    },
  },

  {
    name: 'createTask',
    description: 'Create a new task in the workspace.',
    parameters: {
      type: 'object',
      required: ['title'],
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        priority:    { type: 'string', enum: ['low','medium','high','urgent'], default: 'medium' },
        dueDate:     { type: 'string', description: 'ISO 8601 date string' },
        assigneeEmail: { type: 'string', description: 'Email of team member to assign' },
        projectName: { type: 'string', description: 'Name of project to attach this task to' },
      },
    },
    async execute(args, ctx) {
      if (args.assigneeEmail && !canManageWorkspace(ctx)) {
        return { success: false, error: 'You need owner, admin, or manager permissions to assign tasks to other members.' };
      }
      let assigneeId: mongoose.Types.ObjectId | undefined;
      if (args.assigneeEmail) {
        const member = await User.findOne({ email: args.assigneeEmail, companyId: ctx.companyId }).select('_id');
        if (!member) return { success: false, error: `No team member found with email: ${args.assigneeEmail}` };
        assigneeId = member._id as mongoose.Types.ObjectId;
      }

      let projectId: mongoose.Types.ObjectId | undefined;
      if (args.projectName) {
        const project = await Project.findOne({ companyId: ctx.companyId, name: { $regex: args.projectName, $options: 'i' } }).select('_id');
        if (project) projectId = project._id as mongoose.Types.ObjectId;
      }

      const task = await Task.create({
        companyId:   new mongoose.Types.ObjectId(ctx.companyId),
        creatorId:   new mongoose.Types.ObjectId(ctx.userId),
        assigneeId:  assigneeId ?? new mongoose.Types.ObjectId(ctx.userId),
        projectId,
        title:       args.title.trim(),
        description: args.description?.trim(),
        priority:    args.priority ?? 'medium',
        status:      'todo',
        dueDate:     args.dueDate ? new Date(args.dueDate) : undefined,
      });

      return {
        success: true,
        data: { task: sanitize(task), message: `Task "${task.title}" created successfully.` },
      };
    },
  },

  {
    name: 'updateTask',
    description: 'Update a task by its ID. Can change status, priority, due date, or title.',
    parameters: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId:      { type: 'string' },
        title:       { type: 'string' },
        status:      { type: 'string', enum: ['todo','in_progress','review','completed','blocked'] },
        priority:    { type: 'string', enum: ['low','medium','high','urgent'] },
        dueDate:     { type: 'string' },
        description: { type: 'string' },
      },
    },
    async execute(args, ctx) {
      const task = await Task.findOne({ _id: args.taskId, companyId: ctx.companyId });
      if (!task) return { success: false, error: 'Task not found or access denied.' };
      if (!canManageWorkspace(ctx) && String(task.assigneeId) !== ctx.userId && String(task.creatorId) !== ctx.userId) {
        return { success: false, error: 'You can only update tasks assigned to you or created by you.' };
      }

      const ALLOWED = ['title','status','priority','dueDate','description'];
      const updates: any = {};
      for (const k of ALLOWED) { if (args[k] !== undefined) updates[k] = args[k]; }
      if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
      if (updates.status === 'completed') updates.completedAt = new Date();

      Object.assign(task, updates);
      await task.save();

      return { success: true, data: { task: sanitize(task), message: `Task "${task.title}" updated.` } };
    },
  },

  // ── PROJECTS ───────────────────────────────────────────────────────────────

  {
    name: 'searchProjects',
    description: 'Search projects in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        query:    { type: 'string' },
        status:   { type: 'string', enum: ['planning','active','on_hold','completed'] },
        behindSchedule: { type: 'boolean', description: 'If true, return projects past deadline and not completed' },
        limit:    { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId, isArchived: false };
      if (args.status) filter.status = args.status;
      if (args.query)  filter.name = { $regex: args.query, $options: 'i' };
      if (args.behindSchedule) {
        filter.deadline = { $lt: new Date() };
        filter.status   = { $ne: 'completed' };
      }

      const projects = await Project.find(filter)
        .populate('managerId', 'fullName email')
        .sort({ updatedAt: -1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();

      return { success: true, data: { projects: sanitizeArr(projects), count: projects.length } };
    },
  },

  {
    name: 'createProject',
    description: 'Create a new project in the workspace.',
    parameters: {
      type: 'object',
      required: ['name'],
      properties: {
        name:        { type: 'string' },
        description: { type: 'string' },
        deadline:    { type: 'string', description: 'ISO 8601' },
        priority:    { type: 'string', enum: ['low','medium','high','urgent'] },
      },
    },
    async execute(args, ctx) {
      // Only owner/admin/manager can create projects
      if (!['owner','admin','manager'].includes(ctx.userRole)) {
        return { success: false, error: 'You need manager or higher role to create projects.' };
      }

      const project = await Project.create({
        companyId:   new mongoose.Types.ObjectId(ctx.companyId),
        managerId:   new mongoose.Types.ObjectId(ctx.userId),
        name:        args.name.trim(),
        description: args.description?.trim(),
        status:      'active',
        color:       '#4F46E5',
        progress:    0,
        priority:    args.priority ?? 'medium',
        deadline:    args.deadline ? new Date(args.deadline) : undefined,
        members:     [{ userId: new mongoose.Types.ObjectId(ctx.userId), role: 'manager' }],
      });

      return { success: true, data: { project: sanitize(project), message: `Project "${project.name}" created.` } };
    },
  },

  // ── MEETINGS ───────────────────────────────────────────────────────────────

  {
    name: 'searchMeetings',
    description: 'Search meetings. Can filter by upcoming, past, or by title.',
    parameters: {
      type: 'object',
      properties: {
        query:    { type: 'string' },
        upcoming: { type: 'boolean', description: 'Only future meetings' },
        today:    { type: 'boolean', description: 'Only today\'s meetings' },
        thisWeek: { type: 'boolean', description: 'Meetings this week' },
        limit:    { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId };
      if (args.query)    filter.title = { $regex: args.query, $options: 'i' };
      if (args.upcoming) filter.scheduledAt = { $gte: new Date() };
      if (args.today) {
        const start = new Date(); start.setHours(0,0,0,0);
        const end   = new Date(); end.setHours(23,59,59,999);
        filter.scheduledAt = { $gte: start, $lte: end };
      }
      if (args.thisWeek) {
        const start = new Date(); start.setHours(0,0,0,0);
        const end   = new Date(start.getTime() + 7 * 86400000);
        filter.scheduledAt = { $gte: start, $lte: end };
      }

      const meetings = await Meeting.find(filter)
        .populate('hostId', 'fullName email')
        .sort({ scheduledAt: 1 })
        .limit(Math.min(args.limit ?? 15, 50))
        .lean();

      return { success: true, data: { meetings: sanitizeArr(meetings), count: meetings.length } };
    },
  },

  {
    name: 'searchCalendarEvents',
    description: 'Search authorized workspace calendar events by title, type, and date range.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type: { type: 'string', enum: ['meeting','task','deadline','event','reminder'] },
        from: { type: 'string', description: 'Optional ISO date/time lower bound' },
        to: { type: 'string', description: 'Optional ISO date/time upper bound' },
        limit: { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const from = args.from ? new Date(args.from) : new Date();
      const to = args.to ? new Date(args.to) : new Date(Date.now() + 30 * 86400000);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return { success: false, error: 'Invalid calendar date range.' };
      }
      const filter: any = { companyId: ctx.companyId, startDate: { $gte: from, $lte: to } };
      if (args.type) filter.type = args.type;
      if (args.query) filter.title = { $regex: args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      const events = await CalendarEvent.find(filter)
        .select('title description type startDate endDate allDay location projectId taskId')
        .sort({ startDate: 1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();
      return { success: true, data: { events: sanitizeArr(events), count: events.length } };
    },
  },

  {
    name: 'createMeeting',
    description: 'Schedule a new meeting. Always show a confirmation before creating.',
    parameters: {
      type: 'object',
      required: ['title','scheduledAt'],
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        scheduledAt: { type: 'string', description: 'ISO 8601 datetime' },
        durationMinutes: { type: 'number', description: 'Duration in minutes (default 60)' },
      },
    },
    async execute(args, ctx) {
      const scheduledAt = new Date(args.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        return { success: false, error: 'Invalid date/time provided for meeting.' };
      }

      const { v4: uuidv4 } = require('uuid');
      const meeting = await Meeting.create({
        companyId:   new mongoose.Types.ObjectId(ctx.companyId),
        hostId:      new mongoose.Types.ObjectId(ctx.userId),
        title:       args.title.trim(),
        description: args.description?.trim(),
        scheduledAt,
        duration:    args.durationMinutes ?? 60,
        status:      'scheduled',
        meetingLink: uuidv4(),
        participants: [{ userId: new mongoose.Types.ObjectId(ctx.userId), status: 'accepted' }],
      });

      return {
        success: true,
        data: { meeting: sanitize(meeting), message: `Meeting "${meeting.title}" scheduled for ${scheduledAt.toLocaleString()}.` },
      };
    },
  },

  // ── CRM ────────────────────────────────────────────────────────────────────

  {
    name: 'searchContacts',
    description: 'Search CRM contacts by name, email, job title, or company.',
    parameters: {
      type: 'object',
      properties: {
        query:  { type: 'string' },
        status: { type: 'string', enum: ['lead','prospect','customer','churned','inactive'] },
        limit:  { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId };
      if (args.status) filter.status = args.status;
      if (args.query) {
        const re = new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { jobTitle: re }];
      }

      const contacts = await CrmContact.find(filter)
        .populate('crmCompanyId', 'name domain')
        .populate('ownerId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();

      return { success: true, data: { contacts: sanitizeArr(contacts), count: contacts.length } };
    },
  },

  {
    name: 'searchDeals',
    description: 'Search CRM deals. Can filter by stage, overdue close date, or title.',
    parameters: {
      type: 'object',
      properties: {
        query:       { type: 'string' },
        stage:       { type: 'string', enum: ['new_lead','qualified','proposal','negotiation','won','lost'] },
        overdueOnly: { type: 'boolean', description: 'Only deals past close date and not won/lost' },
        limit:       { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId };
      if (args.stage)  filter.stage = args.stage;
      if (args.query)  filter.title = { $regex: args.query, $options: 'i' };
      if (args.overdueOnly) {
        filter.closeDate = { $lt: new Date() };
        filter.stage     = { $nin: ['won','lost'] };
      }

      const deals = await CrmDeal.find(filter)
        .populate('contactId',    'firstName lastName email')
        .populate('crmCompanyId', 'name')
        .populate('ownerId',      'fullName email')
        .sort({ closeDate: 1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();

      return { success: true, data: { deals: sanitizeArr(deals), count: deals.length } };
    },
  },

  {
    name: 'searchCrmCompanies',
    description: 'Search CRM companies/accounts by name, industry, or domain.',
    parameters: {
      type: 'object',
      properties: {
        query:  { type: 'string' },
        limit:  { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId };
      if (args.query) {
        const re = new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: re }, { domain: re }, { industry: re }];
      }

      const companies = await CrmCompany.find(filter)
        .populate('ownerId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();

      return { success: true, data: { companies: sanitizeArr(companies), count: companies.length } };
    },
  },

  {
    name: 'createDeal',
    description: 'Create a new CRM deal.',
    parameters: {
      type: 'object',
      required: ['title'],
      properties: {
        title:     { type: 'string' },
        value:     { type: 'number', description: 'Deal value in USD' },
        stage:     { type: 'string', enum: ['new_lead','qualified','proposal','negotiation','won','lost'], default: 'new_lead' },
        priority:  { type: 'string', enum: ['low','medium','high','urgent'], default: 'medium' },
        closeDate: { type: 'string', description: 'ISO 8601 date' },
        companyName: { type: 'string', description: 'Name of the CRM company this deal belongs to' },
      },
    },
    async execute(args, ctx) {
      if (!canManageWorkspace(ctx)) {
        return { success: false, error: 'You need owner, admin, or manager permissions to create CRM deals.' };
      }
      let crmCompanyId: mongoose.Types.ObjectId | undefined;
      if (args.companyName) {
        const co = await CrmCompany.findOne({
          companyId: ctx.companyId,
          name: { $regex: args.companyName, $options: 'i' },
        }).select('_id');
        if (co) crmCompanyId = co._id as mongoose.Types.ObjectId;
      }

      const deal = await CrmDeal.create({
        companyId:    new mongoose.Types.ObjectId(ctx.companyId),
        ownerId:      new mongoose.Types.ObjectId(ctx.userId),
        title:        args.title.trim(),
        value:        args.value,
        stage:        args.stage ?? 'new_lead',
        priority:     args.priority ?? 'medium',
        closeDate:    args.closeDate ? new Date(args.closeDate) : undefined,
        crmCompanyId,
        currency:     'USD',
        activities:   [],
        tags:         [],
      });

      return { success: true, data: { deal: sanitize(deal), message: `Deal "${deal.title}" created.` } };
    },
  },

  // ── TEAM ───────────────────────────────────────────────────────────────────

  {
    name: 'searchTeamMembers',
    description: 'Search team members in the workspace by name, email, department, or role.',
    parameters: {
      type: 'object',
      properties: {
        query:      { type: 'string' },
        department: { type: 'string' },
        role:       { type: 'string' },
        limit:      { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId, isActive: true };
      if (args.department) filter.department = { $regex: args.department, $options: 'i' };
      if (args.role)       filter.role = args.role;
      if (args.query) {
        const re = new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ fullName: re }, { email: re }, { jobTitle: re }];
      }

      const members = await User.find(filter)
        .select(canManageWorkspace(ctx)
          ? 'fullName email jobTitle department role status avatar lastSeen'
          : 'fullName jobTitle department role status avatar')
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();

      return { success: true, data: { members: sanitizeArr(members), count: members.length } };
    },
  },

  // ── DOCUMENTS ──────────────────────────────────────────────────────────────

  {
    name: 'searchDocuments',
    description: 'Search documents in the workspace by title or type.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type:  { type: 'string', enum: ['document','meeting_notes','sop','policy','report'] },
        limit: { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId };
      if (args.type)  filter.type  = args.type;
      if (args.query) filter.title = { $regex: args.query, $options: 'i' };

      const docs = await Document.find(filter)
        .select('title type createdAt updatedAt creatorId icon')
        .populate('creatorId', 'fullName')
        .sort({ updatedAt: -1 })
        .limit(Math.min(args.limit ?? 15, 50))
        .lean();

      return { success: true, data: { documents: sanitizeArr(docs), count: docs.length } };
    },
  },

  {
    name: 'searchFiles',
    description: 'Search files the current user can access in the authenticated workspace. Never returns file URLs, storage keys, or sharing credentials.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        mimeType: { type: 'string' },
        limit: { type: 'number' },
      },
    },
    async execute(args, ctx) {
      const filter: any = { companyId: ctx.companyId, isDeleted: false };
      const accessConditions: Record<string, any>[] = [];
      if (!canManageWorkspace(ctx)) {
        accessConditions.push({ $or: [
          { uploaderId: new mongoose.Types.ObjectId(ctx.userId) },
          { 'sharedWith.userId': new mongoose.Types.ObjectId(ctx.userId) },
        ] });
      }
      if (args.query) {
        const escaped = args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        accessConditions.push({ $or: [{ name: { $regex: escaped, $options: 'i' } }, { originalName: { $regex: escaped, $options: 'i' } }] });
      }
      if (accessConditions.length > 0) filter.$and = accessConditions;
      if (args.mimeType) filter.mimeType = args.mimeType;
      const files = await File.find(filter)
        .select('name originalName mimeType size folderId projectId tags createdAt uploaderId')
        .populate('uploaderId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(Math.min(args.limit ?? 20, 50))
        .lean();
      return { success: true, data: { files: sanitizeArr(files), count: files.length } };
    },
  },

  // ── WORKSPACE SUMMARY ──────────────────────────────────────────────────────

  {
    name: 'getWorkspaceSummary',
    description: 'Get a high-level summary of the workspace: task counts, active projects, upcoming meetings, and CRM overview.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const cid = ctx.companyId;
      const uid = ctx.userId;

      const [
        myTasksTotal, myOverdue, myUrgent,
        activeProjects, projectsBehind,
        upcomingMeetings,
        openDeals, overdueDeals,
        teamMembers,
      ] = await Promise.all([
        Task.countDocuments({ companyId: cid, assigneeId: uid, isArchived: false, status: { $ne: 'completed' } }),
        Task.countDocuments({ companyId: cid, assigneeId: uid, isArchived: false, status: { $ne: 'completed' }, dueDate: { $lt: new Date() } }),
        Task.countDocuments({ companyId: cid, assigneeId: uid, isArchived: false, priority: 'urgent', status: { $ne: 'completed' } }),
        Project.countDocuments({ companyId: cid, status: 'active', isArchived: false }),
        Project.countDocuments({ companyId: cid, status: { $ne: 'completed' }, deadline: { $lt: new Date() }, isArchived: false }),
        Meeting.countDocuments({ companyId: cid, scheduledAt: { $gte: new Date() }, status: 'scheduled' }),
        CrmDeal.countDocuments({ companyId: cid, stage: { $nin: ['won','lost'] } }),
        CrmDeal.countDocuments({ companyId: cid, stage: { $nin: ['won','lost'] }, closeDate: { $lt: new Date() } }),
        User.countDocuments({ companyId: cid, isActive: true }),
      ]);

      return {
        success: true,
        data: {
          myTasks:         { total: myTasksTotal, overdue: myOverdue, urgent: myUrgent },
          projects:        { active: activeProjects, behindSchedule: projectsBehind },
          meetings:        { upcoming: upcomingMeetings },
          crm:             { openDeals, overdueDeals },
          team:            { activeMembers: teamMembers },
        },
      };
    },
  },

  // ── CRM ACCOUNT SUMMARY ────────────────────────────────────────────────────

  {
    name: 'getCrmAccountSummary',
    description: 'Get a full summary of a specific CRM company/account including contacts, deals, and recent activity.',
    parameters: {
      type: 'object',
      required: ['companyName'],
      properties: {
        companyName: { type: 'string', description: 'Name of the CRM company to look up' },
      },
    },
    async execute(args, ctx) {
      const crmCo = await CrmCompany.findOne({
        companyId: ctx.companyId,
        name: { $regex: args.companyName, $options: 'i' },
      }).lean();

      if (!crmCo) return { success: false, error: `No CRM company found matching "${args.companyName}".` };

      const [contacts, deals] = await Promise.all([
        CrmContact.find({ companyId: ctx.companyId, crmCompanyId: crmCo._id })
          .select('firstName lastName email jobTitle status').lean(),
        CrmDeal.find({ companyId: ctx.companyId, crmCompanyId: crmCo._id })
          .populate('ownerId', 'fullName').lean(),
      ]);

      return {
        success: true,
        data: {
          company:  sanitize(crmCo),
          contacts: sanitizeArr(contacts),
          deals:    sanitizeArr(deals),
        },
      };
    },
  },
];

/** Lookup by name */
export function getTool(name: string): AgentTool | undefined {
  return TOOLS.find(t => t.name === name);
}

/** OpenAI-compatible function schemas (kept for reference / fallback) */
export function getOpenAIFunctions(availableTools: AgentTool[] = TOOLS) {
  return availableTools.map(t => ({
    type: 'function' as const,
    function: {
      name:        t.name,
      description: t.description,
      parameters:  t.parameters,
    },
  }));
}

/**
 * Gemini-compatible function declarations.
 * The @google/genai SDK accepts a `tools` array with `functionDeclarations`.
 */
export function getGeminiFunctionDeclarations(availableTools: AgentTool[] = TOOLS) {
  return availableTools.map(t => ({
    name:        t.name,
    description: t.description,
    // Gemini accepts standard JSON Schema objects directly
    parameters:  t.parameters as any,
  }));
}

// ── ADDITIONAL TOOLS (appended) ────────────────────────────────────────────

// Append these to the TOOLS array at module load time
const EXTRA_TOOLS: AgentTool[] = [

  {
    name: 'getWorkspacePlan',
    description: 'Get the authenticated user\'s current workspace plan, AI request usage, and enabled features.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      return {
        success: true,
        data: {
          plan: ctx.planName ?? 'Unknown',
          planId: ctx.planId ?? 'unknown',
          aiRequestsLimit: ctx.aiRequestsLimit ?? null,
          aiRequestsUsed: ctx.aiRequestsUsed ?? null,
          enabledFeatures: ctx.enabledFeatures ?? [],
        },
      };
    },
  },

  {
    name: 'updateDeal',
    description: 'Update a CRM deal stage, value, or close date.',
    parameters: {
      type: 'object',
      required: ['dealId'],
      properties: {
        dealId:    { type: 'string' },
        stage:     { type: 'string', enum: ['new_lead','qualified','proposal','negotiation','won','lost'] },
        value:     { type: 'number' },
        closeDate: { type: 'string' },
        priority:  { type: 'string', enum: ['low','medium','high','urgent'] },
      },
    },
    async execute(args, ctx) {
      const deal = await CrmDeal.findOne({ _id: args.dealId, companyId: ctx.companyId });
      if (!deal) return { success: false, error: 'Deal not found or access denied.' };
      if (!canManageWorkspace(ctx) && String(deal.ownerId) !== ctx.userId) {
        return { success: false, error: 'You can only update deals assigned to you.' };
      }

      const changes: string[] = [];
      if (args.stage)     { deal.stage = args.stage;               changes.push(`stage → ${args.stage}`); }
      if (args.value)     { deal.value = args.value;               changes.push(`value → $${args.value}`); }
      if (args.closeDate) { deal.closeDate = new Date(args.closeDate); changes.push(`close date → ${args.closeDate}`); }
      if (args.priority)  { deal.priority = args.priority;         changes.push(`priority → ${args.priority}`); }

      // Record activity
      deal.activities.push({
        type:      'stage_change',
        content:   `AI Agent updated: ${changes.join(', ')}`,
        createdBy: new mongoose.Types.ObjectId(ctx.userId),
        createdAt: new Date(),
      } as any);

      await deal.save();
      return { success: true, data: { deal: sanitize(deal), changes, message: `Deal "${deal.title}" updated: ${changes.join(', ')}.` } };
    },
  },

  {
    name: 'completeTask',
    description: 'Mark a task as completed.',
    parameters: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: { type: 'string' },
      },
    },
    async execute(args, ctx) {
      const task = await Task.findOne({ _id: args.taskId, companyId: ctx.companyId });
      if (!task) return { success: false, error: 'Task not found or access denied.' };
      if (!canManageWorkspace(ctx) && String(task.assigneeId) !== ctx.userId && String(task.creatorId) !== ctx.userId) {
        return { success: false, error: 'You can only complete tasks assigned to you or created by you.' };
      }

      task.status = 'completed';
      task.completedAt = new Date();
      await task.save();

      return { success: true, data: { task: sanitize(task), message: `Task "${task.title}" marked as completed.` } };
    },
  },

  {
    name: 'assignTask',
    description: 'Assign or re-assign a task to a team member by their email.',
    parameters: {
      type: 'object',
      required: ['taskId', 'assigneeEmail'],
      properties: {
        taskId:        { type: 'string' },
        assigneeEmail: { type: 'string' },
      },
    },
    async execute(args, ctx) {
      if (!canManageWorkspace(ctx)) {
        return { success: false, error: 'You need owner, admin, or manager permissions to assign tasks.' };
      }
      const task = await Task.findOne({ _id: args.taskId, companyId: ctx.companyId });
      if (!task) return { success: false, error: 'Task not found or access denied.' };

      const member = await User.findOne({ email: args.assigneeEmail, companyId: ctx.companyId }).select('_id fullName');
      if (!member) return { success: false, error: `No team member found with email: ${args.assigneeEmail}` };

      task.assigneeId = member._id as mongoose.Types.ObjectId;
      await task.save();

      return { success: true, data: { message: `Task "${task.title}" assigned to ${member.fullName}.` } };
    },
  },

  {
    name: 'searchMessages',
    description: 'Search channel messages in the workspace (not private DMs).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search in messages' },
        limit: { type: 'number' },
      },
    },
    async execute(args, ctx) {
      if (!args.query) return { success: false, error: 'query parameter required' };
      const accessibleChannels = await Channel.find({
        companyId: ctx.companyId,
        isArchived: false,
        $or: [{ type: 'public' }, { members: new mongoose.Types.ObjectId(ctx.userId) }],
      }).select('_id').lean();
      if (accessibleChannels.length === 0) return { success: true, data: { messages: [], count: 0 } };
      const msgs = await Message.find({
        companyId: ctx.companyId,
        deletedAt: null,
        content: { $regex: args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
        channelId: { $in: accessibleChannels.map((channel) => channel._id) },
        conversationId: { $exists: false },
      })
        .populate('senderId', 'fullName')
        .populate('channelId', 'name')
        .sort({ createdAt: -1 })
        .limit(Math.min(args.limit ?? 10, 20))
        .lean();

      return { success: true, data: { messages: sanitizeArr(msgs), count: msgs.length } };
    },
  },

  {
    name: 'createContact',
    description: 'Create a new CRM contact.',
    parameters: {
      type: 'object',
      required: ['firstName', 'email'],
      properties: {
        firstName: { type: 'string' },
        lastName:  { type: 'string' },
        email:     { type: 'string' },
        jobTitle:  { type: 'string' },
        status:    { type: 'string', enum: ['lead','prospect','customer','churned','inactive'], default: 'lead' },
        companyName: { type: 'string', description: 'Name of the CRM company' },
      },
    },
    async execute(args, ctx) {
      let crmCompanyId: mongoose.Types.ObjectId | undefined;
      if (args.companyName) {
        const co = await CrmCompany.findOne({ companyId: ctx.companyId, name: { $regex: args.companyName, $options: 'i' } }).select('_id');
        if (co) crmCompanyId = co._id as mongoose.Types.ObjectId;
      }

      const contact = await CrmContact.create({
        companyId:    new mongoose.Types.ObjectId(ctx.companyId),
        ownerId:      new mongoose.Types.ObjectId(ctx.userId),
        firstName:    args.firstName.trim(),
        lastName:     args.lastName?.trim(),
        email:        args.email.toLowerCase().trim(),
        jobTitle:     args.jobTitle?.trim(),
        status:       args.status ?? 'lead',
        crmCompanyId,
        tags:    [],
        dealIds: [],
      });

      return { success: true, data: { contact: sanitize(contact), message: `Contact "${contact.firstName} ${contact.lastName ?? ''}" created.` } };
    },
  },

  {
    name: 'getTeamMembers',
    description: 'Get a list of all active team members in the workspace.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    async execute(args, ctx) {
      const members = await User.find({ companyId: ctx.companyId, isActive: true })
        .select('fullName email jobTitle department role status')
        .limit(Math.min(args.limit ?? 30, 50))
        .lean();
      return { success: true, data: { members: sanitizeArr(members), count: members.length } };
    },
  },
];

// Register extra tools in the main TOOLS array
TOOLS.push(...EXTRA_TOOLS);

const TOOL_ENTITLEMENTS: Partial<Record<string, string>> = {
  searchTasks: 'tasksProjects', createTask: 'tasksProjects', updateTask: 'tasksProjects', completeTask: 'tasksProjects', assignTask: 'tasksProjects',
  searchProjects: 'tasksProjects', createProject: 'tasksProjects',
  searchMeetings: 'meetingsCalendar', createMeeting: 'meetingsCalendar', searchCalendarEvents: 'meetingsCalendar',
  searchContacts: 'crm', searchDeals: 'crm', searchCrmCompanies: 'crm', createDeal: 'crm', updateDeal: 'crm', getCrmAccountSummary: 'crm',
  searchDocuments: 'fileStorage', searchFiles: 'fileStorage',
  searchMessages: 'teamChat', searchTeamMembers: 'teamChat', getTeamMembers: 'teamChat',
};

export function isToolAvailable(name: string, ctx: ToolContext): boolean {
  const entitlement = TOOL_ENTITLEMENTS[name];
  return !entitlement || !ctx.enabledFeatures || ctx.enabledFeatures.includes(entitlement);
}

export function getAvailableTools(ctx: ToolContext): AgentTool[] {
  return TOOLS.filter((tool) => isToolAvailable(tool.name, ctx));
}
