import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CrmContact } from '../models/CrmContact';
import { CrmCompany } from '../models/CrmCompany';
import { CrmDeal }    from '../models/CrmDeal';
import Project from '../models/Project';
import Task from '../models/Task';
import Meeting from '../models/Meeting';
import Document from '../models/Document';
import File from '../models/File';
import { ClientUser, ClientMessage } from '../models/ClientPortal';
import ClientRequestModel from '../models/ClientRequest';
import Approval from '../models/Approval';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './channel.controller';
import { getEffectiveSubscription } from '../services/companySubscription';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Pull companyId from the JWT-injected req.user, throw if missing. */
function getCompanyId(req: Request): mongoose.Types.ObjectId {
  const id = (req as any).user?.companyId;
  if (!id) throw new Error('No companyId on request');
  return new mongoose.Types.ObjectId(id);
}

function getUserId(req: Request): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId((req as any).user._id);
}

function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════════════════════════════════════════════

export const getContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { status, search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const filter: Record<string, any> = { companyId };
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { firstName: re }, { lastName: re },
        { email: re },     { jobTitle: re },
      ];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await CrmContact.countDocuments(filter);
    const contacts = await CrmContact.find(filter)
      .populate('ownerId',      'fullName avatar email')
      .populate('crmCompanyId', 'name domain logoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, contacts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const contact = await CrmContact.findOne({ _id: id, companyId })
      .populate('ownerId',      'fullName avatar email')
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('dealIds',      'title value stage priority closeDate')
      .lean();

    if (!contact) { res.status(404).json({ success: false, message: 'Contact not found' }); return; }
    res.json({ success: true, contact });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const ownerId   = getUserId(req);

    const {
      firstName, lastName, email, phone, jobTitle, department,
      crmCompanyId, status, tags, notes, linkedInUrl, avatarUrl,
    } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      res.status(400).json({ success: false, message: 'firstName and lastName are required' });
      return;
    }

    const contact = await CrmContact.create({
      companyId,
      ownerId,
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email?.trim()?.toLowerCase() || undefined,
      phone:     phone?.trim()    || undefined,
      jobTitle:  jobTitle?.trim() || undefined,
      department: department?.trim() || undefined,
      crmCompanyId: crmCompanyId && isValidId(crmCompanyId) ? crmCompanyId : undefined,
      status:    status || 'lead',
      tags:      Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      notes:     notes?.trim()       || undefined,
      linkedInUrl: linkedInUrl?.trim() || undefined,
      avatarUrl:   avatarUrl?.trim()   || undefined,
    });

    const populated = await contact.populate([
      { path: 'ownerId',      select: 'fullName avatar email' },
      { path: 'crmCompanyId', select: 'name domain logoUrl'  },
    ]);

    res.status(201).json({ success: true, contact: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const ALLOWED = [
      'firstName', 'lastName', 'email', 'phone', 'jobTitle', 'department',
      'crmCompanyId', 'status', 'tags', 'notes', 'linkedInUrl', 'avatarUrl', 'lastContactedAt',
    ];
    const updates: Record<string, any> = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.email)   updates.email = updates.email.trim().toLowerCase();
    if (updates.firstName) updates.firstName = updates.firstName.trim();
    if (updates.lastName)  updates.lastName  = updates.lastName.trim();

    const contact = await CrmContact.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('ownerId',      'fullName avatar email')
      .populate('crmCompanyId', 'name domain logoUrl')
      .lean();

    if (!contact) { res.status(404).json({ success: false, message: 'Contact not found' }); return; }
    res.json({ success: true, contact });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const contact = await CrmContact.findOneAndDelete({ _id: id, companyId });
    if (!contact) { res.status(404).json({ success: false, message: 'Contact not found' }); return; }

    res.json({ success: true, message: 'Contact deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRM COMPANIES
// ═══════════════════════════════════════════════════════════════════════════════

export const getCrmCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const filter: Record<string, any> = { companyId };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { domain: re }, { industry: re }];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await CrmCompany.countDocuments(filter);
    const companies = await CrmCompany.find(filter)
      .populate('ownerId', 'fullName avatar email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Attach contact count
    const ids = companies.map((c) => c._id);
    const contactCounts = await CrmContact.aggregate([
      { $match: { companyId, crmCompanyId: { $in: ids } } },
      { $group: { _id: '$crmCompanyId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(contactCounts.map((x) => [x._id.toString(), x.count]));
    const enriched = companies.map((c) => ({ ...c, contactCount: countMap[c._id.toString()] ?? 0 }));

    res.json({ success: true, companies: enriched, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCrmCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const company = await CrmCompany.findOne({ _id: id, companyId })
      .populate('ownerId', 'fullName avatar email')
      .lean();
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    const [contacts, deals] = await Promise.all([
      CrmContact.find({ companyId, crmCompanyId: id })
        .select('firstName lastName email jobTitle status avatarUrl createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      CrmDeal.find({ companyId, crmCompanyId: id })
        .select('title value currency stage priority closeDate probability activities createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const activity = [
      ...contacts.map((contact) => ({
        id: `contact-${contact._id}`,
        type: 'contact',
        title: `Contact added: ${contact.firstName} ${contact.lastName}`,
        createdAt: contact.createdAt,
      })),
      ...deals.flatMap((deal) => [
        {
          id: `deal-${deal._id}`,
          type: 'deal',
          title: `Deal created: ${deal.title}`,
          createdAt: deal.createdAt,
        },
        ...(deal.activities ?? []).map((item: any) => ({
          id: `deal-activity-${deal._id}-${item._id}`,
          type: item.type,
          title: item.content,
          createdAt: item.createdAt,
        })),
      ]),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 30);

    res.json({ success: true, company: { ...company, contacts, deals, activity } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCrmCompanyConnectedWork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const crmCompany = await CrmCompany.exists({ _id: id, companyId });
    if (!crmCompany) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    const subscription = await getEffectiveSubscription(req.user!.userId);
    const canReadProjects = subscription.planConfig.entitlements.tasksProjects;
    const canReadMeetings = subscription.planConfig.entitlements.meetingsCalendar;
    const canReadResources = subscription.planConfig.entitlements.fileStorage;
    const canReadClientActivity = ['owner', 'admin', 'manager'].includes(req.user!.role);

    const projectFilter: Record<string, any> = {
      companyId,
      crmCompanyId: id,
      isArchived: false,
    };
    if (req.user!.role === 'employee') {
      projectFilter.$or = [
        { 'members.userId': req.user!.userId },
        { assigneeId: req.user!.userId },
        { managerId: req.user!.userId },
      ];
    }

    const projects = canReadProjects ? await Project.find(projectFilter)
      .select('_id companyId crmCompanyId name description color priority managerId assigneeId status progress startDate deadline createdAt')
      .populate('managerId', 'fullName avatar')
      .populate('assigneeId', 'fullName avatar')
      .sort({ updatedAt: -1 })
      .lean() : [];

    const projectIds = projects.map((project) => project._id);
    const [tasks, meetings, documents, files] = await Promise.all([
      canReadProjects && projectIds.length
      ? await Task.find({ companyId, projectId: { $in: projectIds }, isArchived: false })
          .select('_id projectId title status priority dueDate assigneeId createdAt')
          .populate('assigneeId', 'fullName avatar')
          .sort({ dueDate: 1, createdAt: -1 })
          .lean()
      : Promise.resolve([]),
      canReadMeetings ? await Meeting.find({
        companyId,
        $or: [
          { crmCompanyId: id },
          ...(projectIds.length ? [{ projectId: { $in: projectIds } }] : []),
        ],
        ...(req.user!.role === 'employee' ? {
          $and: [{ $or: [
            { hostId: req.user!.userId },
            { 'participants.userId': req.user!.userId },
            ...(projectIds.length ? [{ projectId: { $in: projectIds } }] : []),
          ] }],
        } : {}),
      })
        .select('_id title description hostId participants projectId crmCompanyId crmContactIds scheduledAt startedAt endedAt status aiSummary createdAt updatedAt')
        .populate('hostId', 'fullName avatar')
        .populate('participants.userId', 'fullName avatar')
        .populate('projectId', 'name color')
        .populate('crmCompanyId', 'name domain logoUrl')
        .populate('crmContactIds', 'firstName lastName email jobTitle')
        .sort({ scheduledAt: -1, createdAt: -1 })
        .limit(50)
        .lean() : Promise.resolve([]),
      canReadResources && projectIds.length ? await Document.find({ companyId, projectId: { $in: projectIds }, isArchived: false })
        .select('_id projectId title type icon creatorId updatedAt createdAt')
        .populate('creatorId', 'fullName avatar')
        .populate('projectId', 'name color')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean() : Promise.resolve([]),
      canReadResources && projectIds.length ? await File.find({ companyId, projectId: { $in: projectIds }, isDeleted: false })
        .select('_id projectId name originalName mimeType size uploaderId createdAt')
        .populate('uploaderId', 'fullName avatar')
        .populate('projectId', 'name color')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean() : Promise.resolve([]),
    ]);

    let clientActivity: any[] = [];
    let clientPortal: { clients: { id: string; fullName: string; projectIds: string[] }[]; documents: any[]; files: any[] } | null = null;
    let clientRequests: any[] = [];
    let approvals: any[] = [];
    if (canReadClientActivity && projectIds.length) {
      const clientUsers = await ClientUser.find({ companyId, isActive: true, sharedProjects: { $in: projectIds } })
        .select('_id fullName sharedProjects sharedDocs sharedFiles')
        .lean();
      const clientUserIds = clientUsers.map((client) => client._id);
      const sharedDocumentIds = [...new Set(clientUsers.flatMap((client) => client.sharedDocs.map((documentId) => documentId.toString())))];
      const sharedFileIds = [...new Set(clientUsers.flatMap((client) => client.sharedFiles.map((fileId) => fileId.toString())))];
      const [clientDocuments, clientFiles] = await Promise.all([
        sharedDocumentIds.length ? Document.find({ _id: { $in: sharedDocumentIds }, companyId, isArchived: false })
          .select('_id title type projectId updatedAt createdAt')
          .populate('projectId', 'name color')
          .sort({ updatedAt: -1 })
          .lean() : Promise.resolve([]),
        sharedFileIds.length ? File.find({ _id: { $in: sharedFileIds }, companyId, isDeleted: false })
          .select('_id name originalName mimeType size projectId createdAt')
          .populate('projectId', 'name color')
          .sort({ createdAt: -1 })
          .lean() : Promise.resolve([]),
      ]);
      clientPortal = {
        clients: clientUsers.map((client) => ({
          id: client._id.toString(),
          fullName: client.fullName,
          projectIds: client.sharedProjects.filter((sharedProjectId) => projectIds.some((projectId) => projectId.toString() === sharedProjectId.toString())).map((sharedProjectId) => sharedProjectId.toString()),
        })),
        documents: clientDocuments,
        files: clientFiles,
      };
      if (clientUserIds.length) {
        clientActivity = await ClientMessage.find({ companyId, clientUserId: { $in: clientUserIds }, senderType: 'client' })
          .select('_id clientUserId senderName content createdAt')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
      }
      clientRequests = await ClientRequestModel.find({ companyId, projectId: { $in: projectIds } })
        .populate('clientUserId', 'fullName')
        .populate('projectId', 'name color')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
    }

    if (projectIds.length) {
      const approvalFilter: Record<string, any> = { companyId, projectId: { $in: projectIds } };
      if (!canReadClientActivity) approvalFilter.$or = [{ requesterId: req.user!.userId }, { approverId: req.user!.userId }];
      approvals = await Approval.find(approvalFilter).sort({ updatedAt: -1 }).limit(100).lean();
    }

    const [contacts, deals] = await Promise.all([
      CrmContact.find({ companyId, crmCompanyId: id }).select('_id firstName lastName createdAt').lean(),
      CrmDeal.find({ companyId, crmCompanyId: id }).select('_id title createdAt updatedAt activities').lean(),
    ]);
    const activity = [
      ...contacts.map((contact) => ({ id: `contact-${contact._id}`, type: 'contact', title: `Contact added: ${contact.firstName} ${contact.lastName}`, createdAt: contact.createdAt, href: '/crm' })),
      ...deals.flatMap((deal) => [
        { id: `deal-${deal._id}`, type: 'deal', title: `Deal created: ${deal.title}`, createdAt: deal.createdAt, href: '/crm' },
        ...(deal.activities ?? []).map((event: any) => ({ id: `deal-activity-${deal._id}-${event._id}`, type: event.type, title: event.content, createdAt: event.createdAt, href: '/crm' })),
      ]),
      ...projects.map((project) => ({ id: `project-${project._id}`, type: 'project', title: `Project updated: ${project.name}`, createdAt: project.updatedAt, href: '/projects' })),
      ...tasks.map((task) => ({ id: `task-${task._id}`, type: task.status === 'completed' ? 'task_completed' : 'task', title: task.status === 'completed' ? `Task completed: ${task.title}` : `Task: ${task.title}`, createdAt: task.createdAt, href: '/tasks' })),
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
      projects,
      tasks,
      meetings,
      documents,
      files,
      clientActivity,
      clientPortal,
      clientRequests,
      approvals,
      activity,
      access: { projects: canReadProjects, meetings: canReadMeetings, resources: canReadResources, clientActivity: canReadClientActivity },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createCrmCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const ownerId   = getUserId(req);

    const { name, domain, website, industry, employeeCount, annualRevenue, country, city, address, phone, logoUrl, tags, notes, linkedInUrl } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, message: 'name is required' });
      return;
    }

    const company = await CrmCompany.create({
      companyId,
      ownerId,
      name: name.trim(),
      domain:        domain?.trim()?.toLowerCase() || undefined,
      website:       website?.trim()     || undefined,
      industry:      industry?.trim()    || undefined,
      employeeCount: employeeCount       || undefined,
      annualRevenue: annualRevenue       || undefined,
      country:       country?.trim()     || undefined,
      city:          city?.trim()        || undefined,
      address:       address?.trim()     || undefined,
      phone:         phone?.trim()       || undefined,
      logoUrl:       logoUrl?.trim()     || undefined,
      tags:          Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      notes:         notes?.trim()       || undefined,
      linkedInUrl:   linkedInUrl?.trim() || undefined,
    });

    const populated = await company.populate('ownerId', 'fullName avatar email');
    res.status(201).json({ success: true, company: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCrmCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const ALLOWED = ['name', 'domain', 'website', 'industry', 'employeeCount', 'annualRevenue', 'country', 'city', 'address', 'phone', 'logoUrl', 'tags', 'notes', 'linkedInUrl'];
    const updates: Record<string, any> = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const company = await CrmCompany.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('ownerId', 'fullName avatar email')
      .lean();

    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }
    res.json({ success: true, company });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCrmCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const company = await CrmCompany.findOneAndDelete({ _id: id, companyId });
    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }

    res.json({ success: true, message: 'Company deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEALS
// ═══════════════════════════════════════════════════════════════════════════════

export const getDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { stage, search, page = '1', limit = '100' } = req.query as Record<string, string>;

    const filter: Record<string, any> = { companyId };
    if (stage) filter.stage = stage;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.title = re;
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await CrmDeal.countDocuments(filter);
    const deals = await CrmDeal.find(filter)
      .populate('ownerId',      'fullName avatar email')
      .populate('contactId',    'firstName lastName email avatarUrl')
      .populate('crmCompanyId', 'name domain logoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, deals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const deal = await CrmDeal.findOne({ _id: id, companyId })
      .populate('ownerId',      'fullName avatar email')
      .populate('contactId',    'firstName lastName email avatarUrl jobTitle')
      .populate('crmCompanyId', 'name domain logoUrl')
      .populate('activities.createdBy', 'fullName avatar')
      .lean();

    if (!deal) { res.status(404).json({ success: false, message: 'Deal not found' }); return; }
    res.json({ success: true, deal });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const ownerId   = getUserId(req);

    const { title, value, currency, stage, priority, contactId, crmCompanyId, closeDate, probability, description, tags } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, message: 'title is required' });
      return;
    }

    const deal = await CrmDeal.create({
      companyId,
      ownerId,
      title:       title.trim(),
      value:       value        || undefined,
      currency:    currency     || 'USD',
      stage:       stage        || 'new_lead',
      priority:    priority     || 'medium',
      contactId:   contactId    && isValidId(contactId)    ? contactId    : undefined,
      crmCompanyId: crmCompanyId && isValidId(crmCompanyId) ? crmCompanyId : undefined,
      closeDate:   closeDate    || undefined,
      probability: probability  ?? undefined,
      description: description?.trim() || undefined,
      tags:        Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      activities:  [],
    });

    // If linked to a contact, push this deal into contact.dealIds
    if (deal.contactId) {
      await CrmContact.findByIdAndUpdate(deal.contactId, { $addToSet: { dealIds: deal._id } });
    }

    const populated = await deal.populate([
      { path: 'ownerId',      select: 'fullName avatar email' },
      { path: 'contactId',    select: 'firstName lastName email avatarUrl' },
      { path: 'crmCompanyId', select: 'name domain logoUrl' },
    ]);

    res.status(201).json({ success: true, deal: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const ALLOWED = ['title', 'value', 'currency', 'stage', 'priority', 'contactId', 'crmCompanyId', 'closeDate', 'probability', 'description', 'tags', 'lostReason'];
    const updates: Record<string, any> = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const deal = await CrmDeal.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('ownerId',      'fullName avatar email')
      .populate('contactId',    'firstName lastName email avatarUrl')
      .populate('crmCompanyId', 'name domain logoUrl')
      .lean();

    if (!deal) { res.status(404).json({ success: false, message: 'Deal not found' }); return; }
    const dealOwner = deal.ownerId as any;
    const dealOwnerId = String(dealOwner?._id ?? dealOwner);
    const currentUserId = String((req as any).user?.userId ?? '');
    if (Object.keys(updates).length > 0 && dealOwnerId && dealOwnerId !== currentUserId) {
      await createNotification({
        companyId: String(companyId),
        userId: dealOwnerId,
        type: 'deal_update',
        title: updates.stage !== undefined ? 'Deal stage updated' : 'Deal updated',
        body: updates.stage !== undefined
          ? `${deal.title} moved to ${String(updates.stage).replace(/_/g, ' ')}.`
          : `${deal.title} was updated.`,
        actionUrl: '/crm?tab=deals',
      });
    }
    res.json({ success: true, deal });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const deal = await CrmDeal.findOneAndDelete({ _id: id, companyId });
    if (!deal) { res.status(404).json({ success: false, message: 'Deal not found' }); return; }

    // Remove deal reference from contact
    if (deal.contactId) {
      await CrmContact.findByIdAndUpdate(deal.contactId, { $pull: { dealIds: deal._id } });
    }

    res.json({ success: true, message: 'Deal deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addDealActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId    = getUserId(req);
    const { id }    = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }

    const { type, content } = req.body;
    if (!type || !content?.trim()) {
      res.status(400).json({ success: false, message: 'type and content are required' });
      return;
    }

    const deal = await CrmDeal.findOneAndUpdate(
      { _id: id, companyId },
      { $push: { activities: { type, content: content.trim(), createdBy: userId, createdAt: new Date() } } },
      { new: true }
    )
      .populate('activities.createdBy', 'fullName avatar')
      .lean();

    if (!deal) { res.status(404).json({ success: false, message: 'Deal not found' }); return; }
    res.json({ success: true, activities: deal.activities });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE STATS  (for Overview snapshot)
// ═══════════════════════════════════════════════════════════════════════════════

export const getPipelineStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getCompanyId(req);

    const [dealAgg, contactCount, companyCount] = await Promise.all([
      CrmDeal.aggregate([
        { $match: { companyId } },
        {
          $group: {
            _id:           '$stage',
            count:         { $sum: 1 },
            totalValue:    { $sum: { $ifNull: ['$value', 0] } },
          },
        },
      ]),
      CrmContact.countDocuments({ companyId }),
      CrmCompany.countDocuments({ companyId }),
    ]);

    const stageOrder = ['new_lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const stageMap: Record<string, { count: number; totalValue: number }> = {};
    for (const s of stageOrder) stageMap[s] = { count: 0, totalValue: 0 };
    for (const row of dealAgg) stageMap[row._id] = { count: row.count, totalValue: row.totalValue };

    const totalPipelineValue = stageOrder
      .filter((s) => s !== 'lost')
      .reduce((sum, s) => sum + stageMap[s].totalValue, 0);

    const openDeals = stageOrder
      .filter((s) => s !== 'won' && s !== 'lost')
      .reduce((sum, s) => sum + stageMap[s].count, 0);

    res.json({
      success: true,
      stats: {
        stageMap,
        totalPipelineValue,
        openDeals,
        wonDeals:     stageMap['won'].count,
        lostDeals:    stageMap['lost'].count,
        contactCount,
        companyCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
