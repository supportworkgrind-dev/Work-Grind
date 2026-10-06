import { Request, Response } from 'express';
import mongoose, { Model } from 'mongoose';
import { CrmContact } from '../models/CrmContact';
import { CrmCompany } from '../models/CrmCompany';
import { CrmDeal } from '../models/CrmDeal';
import Project from '../models/Project';
import Task from '../models/Task';
import User from '../models/User';
import { ConnectApiRequest } from '../middleware/connectApiKey';
import { CONNECT_RESOURCES, type ConnectResource } from '../models/DeveloperAccess';

const models: Record<ConnectResource, Model<any>> = {
  contacts: CrmContact,
  companies: CrmCompany,
  deals: CrmDeal,
  projects: Project,
  tasks: Task,
  team: User,
};

const fields: Record<Exclude<ConnectResource, 'team'>, string[]> = {
  contacts: ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'department', 'crmCompanyId', 'status', 'tags', 'notes', 'linkedInUrl', 'lastContactedAt'],
  companies: ['name', 'domain', 'website', 'industry', 'employeeCount', 'annualRevenue', 'country', 'city', 'address', 'phone', 'tags', 'notes', 'linkedInUrl'],
  deals: ['title', 'value', 'currency', 'stage', 'priority', 'contactId', 'crmCompanyId', 'closeDate', 'probability', 'description', 'tags', 'lostReason'],
  projects: ['name', 'crmCompanyId', 'description', 'color', 'priority', 'assigneeId', 'startDate', 'deadline', 'status'],
  tasks: ['title', 'description', 'projectId', 'assigneeId', 'priority', 'status', 'startDate', 'dueDate', 'estimatedMinutes', 'tags', 'subtasks'],
};

function resourceName(req: Request): ConnectResource | undefined {
  return CONNECT_RESOURCES.find((resource) => resource === req.params.resource);
}

function filteredPayload(resource: Exclude<ConnectResource, 'team'>, body: Record<string, unknown>) {
  return Object.fromEntries(fields[resource].filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
}

function serialize(resource: ConnectResource, value: any) {
  if (resource === 'team') return {
    id: value._id,
    fullName: value.fullName,
    email: value.email,
    role: value.role,
    jobTitle: value.jobTitle,
    department: value.department,
    avatar: value.avatar,
    status: value.status,
    lastSeen: value.lastSeen,
    createdAt: value.createdAt,
  };
  const record = typeof value.toObject === 'function' ? value.toObject() : value;
  delete record.__v;
  delete record.password;
  delete record.refreshTokens;
  delete record.verificationToken;
  delete record.resetPasswordToken;
  return { ...record, id: record._id };
}

async function ensureRelatedRecords(resource: Exclude<ConnectResource, 'team'>, payload: Record<string, any>, companyId: mongoose.Types.ObjectId) {
  const checks: Promise<number>[] = [];
  const relationshipIds = ['crmCompanyId', 'contactId', 'assigneeId', 'projectId'].filter((field) => payload[field] !== undefined).map((field) => payload[field]);
  if (relationshipIds.some((id) => !mongoose.isValidObjectId(id))) return false;
  if (resource === 'contacts' && payload.crmCompanyId) checks.push(CrmCompany.countDocuments({ _id: payload.crmCompanyId, companyId }));
  if (resource === 'deals') {
    if (payload.contactId) checks.push(CrmContact.countDocuments({ _id: payload.contactId, companyId }));
    if (payload.crmCompanyId) checks.push(CrmCompany.countDocuments({ _id: payload.crmCompanyId, companyId }));
  }
  if (resource === 'projects' && payload.crmCompanyId) checks.push(CrmCompany.countDocuments({ _id: payload.crmCompanyId, companyId }));
  if (resource === 'projects' && payload.assigneeId) checks.push(User.countDocuments({ _id: payload.assigneeId, companyId, isActive: true }));
  if (resource === 'tasks') {
    if (payload.subtasks !== undefined) {
      if (!Array.isArray(payload.subtasks) || payload.subtasks.length > 100 || payload.subtasks.some((item) => !item || typeof item.title !== 'string' || !item.title.trim())) return false;
      const subtaskAssignees = payload.subtasks.map((item) => item.assigneeId).filter(Boolean);
      if (subtaskAssignees.some((id: unknown) => !mongoose.isValidObjectId(id))) return false;
      if (subtaskAssignees.length) {
        const validAssignees = await User.countDocuments({ _id: { $in: [...new Set(subtaskAssignees)] }, companyId, isActive: true });
        if (validAssignees !== new Set(subtaskAssignees).size) return false;
      }
    }
    if (payload.projectId) checks.push(Project.countDocuments({ _id: payload.projectId, companyId }));
    if (payload.assigneeId) checks.push(User.countDocuments({ _id: payload.assigneeId, companyId, isActive: true }));
  }
  const results = await Promise.all(checks);
  return results.every((count) => count > 0);
}

export function connectResourceMiddleware(req: ConnectApiRequest, res: Response, next: () => void) {
  const resource = resourceName(req);
  if (!resource) {
    res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Supported resources: contacts, companies, deals, projects, tasks, team.' } });
    return;
  }
  if (resource === 'team' && req.method !== 'GET') {
    res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Team member writes are not available through the Connect API.' } });
    return;
  }
  const access = req.connectApiKey;
  const scope = `${resource}:${req.method === 'GET' ? 'read' : 'write'}`;
  if (!access?.scopes.includes(scope as any)) {
    res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_SCOPE', message: `This API key requires the ${scope} scope.` } });
    return;
  }
  next();
}

export async function listConnectResource(req: ConnectApiRequest, res: Response) {
  const resource = resourceName(req)!;
  const companyId = req.connectApiKey!.companyId;
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
  const filter: Record<string, any> = resource === 'team'
    ? { companyId, isActive: true, isDeleted: { $ne: true } }
    : { companyId };
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (query && resource !== 'team') {
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = resource === 'contacts'
      ? [{ firstName: pattern }, { lastName: pattern }, { email: pattern }]
      : resource === 'companies'
        ? [{ name: pattern }, { domain: pattern }]
        : resource === 'deals'
          ? [{ title: pattern }]
          : [{ name: pattern }, { title: pattern }];
  }
  const model = models[resource];
  const projection = resource === 'team' ? 'fullName email role jobTitle department avatar status lastSeen createdAt' : undefined;
  const [records, total] = await Promise.all([
    model.find(filter, projection).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    model.countDocuments(filter),
  ]);
  res.json({ success: true, data: records.map((record) => serialize(resource, record)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function getConnectResource(req: ConnectApiRequest, res: Response) {
  const resource = resourceName(req)!;
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'The resource ID is invalid.' } });
    return;
  }
  const filter: Record<string, unknown> = { _id: req.params.id, companyId: req.connectApiKey!.companyId };
  if (resource === 'team') Object.assign(filter, { isActive: true, isDeleted: { $ne: true } });
  const projection = resource === 'team' ? 'fullName email role jobTitle department avatar status lastSeen createdAt' : undefined;
  const record = await models[resource].findOne(filter, projection).lean();
  if (!record) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource record was not found in this workspace.' } }); return; }
  res.json({ success: true, data: serialize(resource, record) });
}

export async function createConnectResource(req: ConnectApiRequest, res: Response) {
  const resource = resourceName(req)!;
  if (resource === 'team') { res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Team member writes are not available through the Connect API.' } }); return; }
  const payload = filteredPayload(resource, req.body || {});
  const companyId = req.connectApiKey!.companyId;
  const creatorId = req.connectApiKey!.createdBy;
  if (!(await ensureRelatedRecords(resource, payload, companyId))) {
    res.status(400).json({ success: false, error: { code: 'INVALID_RELATIONSHIP', message: 'A referenced record must exist in the same workspace.' } });
    return;
  }
  Object.assign(payload, { companyId });
  if (resource === 'contacts' || resource === 'companies' || resource === 'deals') payload.ownerId = creatorId;
  if (resource === 'projects') payload.managerId = creatorId;
  if (resource === 'tasks') payload.creatorId = creatorId;
  const created = await models[resource].create(payload);
  res.status(201).json({ success: true, data: serialize(resource, created) });
}

export async function updateConnectResource(req: ConnectApiRequest, res: Response) {
  const resource = resourceName(req)!;
  if (resource === 'team') { res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Team member writes are not available through the Connect API.' } }); return; }
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'The resource ID is invalid.' } });
    return;
  }
  const payload = filteredPayload(resource, req.body || {});
  const companyId = req.connectApiKey!.companyId;
  if (!(await ensureRelatedRecords(resource, payload, companyId))) {
    res.status(400).json({ success: false, error: { code: 'INVALID_RELATIONSHIP', message: 'A referenced record must exist in the same workspace.' } });
    return;
  }
  const updated = await models[resource].findOneAndUpdate(
    { _id: req.params.id, companyId },
    { $set: payload },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource record was not found in this workspace.' } }); return; }
  res.json({ success: true, data: serialize(resource, updated) });
}
