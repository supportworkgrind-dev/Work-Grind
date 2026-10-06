/**
 * Client Portal Controller
 *
 * External clients get a completely separate auth flow from internal users.
 * ClientUser model is isolated — never mixed with User model.
 *
 * SECURITY:
 *   - Client tokens signed with a separate JWT claim (type: 'client')
 *   - companyId always from the server context
 *   - Clients can ONLY access explicitly shared resources
 *   - Internal fields (private chats, employee data, CRM notes) never exposed
 *   - Invitation email + token flow (token hashed before storage)
 */

import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ClientUser, ClientMessage } from '../models/ClientPortal';
import ClientRequestModel from '../models/ClientRequest';
import Project from '../models/Project';
import Task from '../models/Task';
import File from '../models/File';
import Meeting from '../models/Meeting';
import Document from '../models/Document';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import { getCompanySubscription } from '../services/companySubscription';

// ── JWT helpers for client sessions ──────────────────────────────────────────

const CLIENT_JWT_SECRET = process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET + '_client';

function issueClientToken(clientUserId: string, companyId: string): string {
  return jwt.sign(
    { clientUserId, companyId, type: 'client' },
    CLIENT_JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function verifyClientToken(token: string): { clientUserId: string; companyId: string; type: string } {
  return jwt.verify(token, CLIENT_JWT_SECRET) as any;
}

// ── Client auth middleware (used inline) ──────────────────────────────────────

export interface ClientRequest extends Request {
  client?: { clientUserId: string; companyId: string };
}

export async function authenticateClient(req: ClientRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Client token required' });
    return;
  }
  let decoded: ReturnType<typeof verifyClientToken>;
  try {
    decoded = verifyClientToken(header.split(' ')[1]);
    if (decoded.type !== 'client') throw new Error('Invalid token type');
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired client token' });
    return;
  }

  try {
    const subscription = await getCompanySubscription(decoded.companyId);
    if (!subscription.hasActiveAccess) {
      res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        source: 'client_portal',
        message: 'This workspace subscription has ended. Contact the workspace owner to restore access.',
        subscriptionStatus: subscription.status,
      });
      return;
    }
    req.client = { clientUserId: decoded.clientUserId, companyId: decoded.companyId };
    next();
  } catch (error) {
    console.error('[Client Portal] Subscription access check failed:', error);
    res.status(503).json({ success: false, code: 'SUBSCRIPTION_CHECK_UNAVAILABLE', message: 'Unable to verify workspace access. Please try again.' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TEAM ENDPOINTS (requires authenticated WorkGrind user)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/client-portal/invite
export const inviteClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin','manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher required' });
      return;
    }

    const { email, fullName } = req.body;
    if (!email || !fullName) {
      res.status(400).json({ success: false, message: 'Email and full name required' });
      return;
    }

    const rawToken   = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const existing = await ClientUser.findOne({
      companyId: req.user!.companyId,
      email:     email.toLowerCase(),
    });

    if (existing && existing.isActive) {
      res.status(409).json({ success: false, message: 'Client already has an active account' });
      return;
    }

    // Upsert: re-invite if pending
    const client = await ClientUser.findOneAndUpdate(
      { companyId: new mongoose.Types.ObjectId(req.user!.companyId), email: email.toLowerCase() },
      {
        $set: {
          fullName:     fullName.trim(),
          isActive:     false,
          isVerified:   false,
          inviteToken:  hashedToken,
          inviteExpiry: expiry,
          password:     await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10), // temp password
        },
      },
      { upsert: true, new: true },
    );

    const portalUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/client-portal/accept?token=${rawToken}`;

    // Use sendClientPortalInvite rather than sendInviteEmail (which expects a workspace token param)
    try {
      const { sendClientPortalInvite } = await import('../utils/email');
      await sendClientPortalInvite(email, fullName, portalUrl);
    } catch (emailErr) {
      console.error('[ClientPortal] Invite email failed:', emailErr);
      // Non-fatal — invitation record already created
    }

    await AuditLog.create({
      companyId:  new mongoose.Types.ObjectId(req.user!.companyId),
      userId:     new mongoose.Types.ObjectId(req.user!.userId),
      action:     'CLIENT_INVITED',
      resource:   'ClientPortal',
      resourceId: client._id.toString(),
      details:    { email },
    });

    res.status(201).json({ success: true, message: 'Invitation sent', clientId: client._id });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/client-portal/clients — list all clients for this company
export const listClients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin','manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher required' });
      return;
    }

    const clients = await ClientUser.find({ companyId: req.user!.companyId })
      .select('-password -inviteToken -refreshTokens')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, clients });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/client-portal/clients/:id/share — share resources with a client
export const shareWithClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin','manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher required' });
      return;
    }

    const client = await ClientUser.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!client) { res.status(404).json({ success: false, message: 'Client not found' }); return; }

    const { projectIds, fileIds, meetingIds, docIds } = req.body;

    // Validate that each resource actually belongs to this company
    const validate = async (model: any, ids: string[], companyId: string) => {
      if (!ids?.length) return [];
      const docs = await model.find({
        _id: { $in: ids.map((id: string) => new mongoose.Types.ObjectId(id)) },
        companyId: new mongoose.Types.ObjectId(companyId),
      }).select('_id');
      return docs.map((d: any) => d._id);
    };

    const [validProjects, validFiles, validMeetings, validDocs] = await Promise.all([
      validate(Project, projectIds, req.user!.companyId),
      validate(File,    fileIds,    req.user!.companyId),
      validate(Meeting, meetingIds, req.user!.companyId),
      validate(Document, docIds,   req.user!.companyId),
    ]);

    client.sharedProjects = validProjects;
    client.sharedFiles    = validFiles;
    client.sharedMeetings = validMeetings;
    client.sharedDocs     = validDocs;
    await client.save();

    res.json({ success: true, message: 'Resources updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/client-portal/clients/:id — remove client access
export const removeClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Owner or admin required' });
      return;
    }
    await ClientUser.findOneAndDelete({ _id: req.params.id, companyId: req.user!.companyId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/client-portal/messages — internal team sends message to client
export const sendMessageToClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, content } = req.body;
    if (!clientId || !content?.trim()) {
      res.status(400).json({ success: false, message: 'clientId and content required' });
      return;
    }

    const client = await ClientUser.findOne({ _id: clientId, companyId: req.user!.companyId }).select('_id');
    if (!client) { res.status(404).json({ success: false, message: 'Client not found' }); return; }

    const user = await import('../models/User').then(m => m.default.findById(req.user!.userId).select('fullName'));
    const msg = await ClientMessage.create({
      companyId:    new mongoose.Types.ObjectId(req.user!.companyId),
      clientUserId: client._id,
      senderType:   'team',
      senderId:     new mongoose.Types.ObjectId(req.user!.userId),
      senderName:   user?.fullName ?? 'Team',
      content:      content.trim().slice(0, 4000),
    });

    const { emitToCompany } = await import('../utils/socket');
    emitToCompany(req.user!.companyId, 'client_portal:message', { message: msg, clientId });

    res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT-FACING ENDPOINTS (authenticated with client JWT)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/client-portal/auth/accept-invite
export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token and password required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const client = await ClientUser.findOne({
      inviteToken:  hashedToken,
      inviteExpiry: { $gt: new Date() },
    }).select('+password');

    if (!client) {
      res.status(400).json({ success: false, message: 'Invalid or expired invitation' });
      return;
    }

    client.password    = password; // pre-save hook will bcrypt
    client.isActive    = true;
    client.isVerified  = true;
    client.inviteToken = undefined;
    client.inviteExpiry = undefined;
    await client.save();

    const accessToken = issueClientToken(client._id.toString(), client.companyId.toString());
    res.json({
      success: true,
      accessToken,
      client: { _id: client._id, email: client.email, fullName: client.fullName },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/client-portal/auth/login
export const clientLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const client = await ClientUser.findOne({ email: email?.toLowerCase() }).select('+password');

    if (!client || !client.isActive) {
      res.status(401).json({ success: false, message: 'Invalid credentials or inactive account' });
      return;
    }

    const valid = await (client as any).comparePassword(password);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    client.lastSeen = new Date();
    await client.save();

    const accessToken = issueClientToken(client._id.toString(), client.companyId.toString());
    res.json({
      success: true,
      accessToken,
      client: { _id: client._id, email: client.email, fullName: client.fullName, avatar: client.avatar },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/client-portal/portal — client views their portal (projects, files, meetings, docs)
export const getClientPortal = async (req: ClientRequest, res: Response): Promise<void> => {
  try {
    const client = await ClientUser.findById(req.client!.clientUserId).select(
      'fullName email avatar isActive sharedProjects sharedFiles sharedMeetings sharedDocs companyId',
    );

    if (!client || !client.isActive) {
      res.status(403).json({ success: false, message: 'Account not active' });
      return;
    }

    // Verify companyId matches (IDOR protection)
    if (client.companyId.toString() !== req.client!.companyId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const [projects, files, meetings, docs, messages] = await Promise.all([
      Project.find({ _id: { $in: client.sharedProjects }, companyId: client.companyId })
        .select('name description color status progress deadline')
        .lean(),
      File.find({ _id: { $in: client.sharedFiles }, companyId: client.companyId, isDeleted: false })
        .select('name mimeType size createdAt')
        .lean(),
      Meeting.find({ _id: { $in: client.sharedMeetings }, companyId: client.companyId })
        .select('title scheduledAt status meetingLink duration')
        .lean(),
      Document.find({ _id: { $in: client.sharedDocs }, companyId: client.companyId, isArchived: false })
        .select('title type icon createdAt updatedAt')
        .lean(),
      ClientMessage.find({ clientUserId: client._id })
        .sort({ createdAt: 1 })
        .limit(50)
        .lean(),
    ]);

    res.json({
      success: true,
      portal: {
        client: { fullName: client.fullName, email: client.email, avatar: client.avatar },
        projects, files, meetings, docs, messages,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/client-portal/portal/messages — client sends message to team
export const clientSendMessage = async (req: ClientRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ success: false, message: 'Content required' });
      return;
    }

    const client = await ClientUser.findById(req.client!.clientUserId).select('fullName companyId isActive');
    if (!client || !client.isActive) {
      res.status(403).json({ success: false, message: 'Account not active' });
      return;
    }

    const msg = await ClientMessage.create({
      companyId:    client.companyId,
      clientUserId: client._id,
      senderType:   'client',
      senderId:     client._id,
      senderName:   client.fullName,
      content:      content.trim().slice(0, 4000),
    });

    const { emitToCompany } = await import('../utils/socket');
    emitToCompany(client.companyId.toString(), 'client_portal:message', {
      message: msg,
      clientId: client._id,
    });

    res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getClientRequests = async (req: ClientRequest, res: Response): Promise<void> => {
  try {
    const client = await ClientUser.findOne({ _id: req.client!.clientUserId, companyId: req.client!.companyId, isActive: true }).select('_id sharedProjects');
    if (!client) { res.status(403).json({ success: false, message: 'Client account is not active' }); return; }
    const requests = await ClientRequestModel.find({
      companyId: client.companyId,
      clientUserId: client._id,
      projectId: { $in: client.sharedProjects },
    }).populate('projectId', 'name color').sort({ updatedAt: -1 }).lean();
    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createClientRequest = async (req: ClientRequest, res: Response): Promise<void> => {
  try {
    const { projectId, title, description } = req.body;
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId) || !title?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, message: 'Choose a shared project and provide a title and description.' });
      return;
    }
    const client = await ClientUser.findOne({ _id: req.client!.clientUserId, companyId: req.client!.companyId, isActive: true }).select('_id fullName sharedProjects');
    if (!client || !client.sharedProjects.some((id) => id.toString() === projectId)) {
      res.status(403).json({ success: false, message: 'Requests can only be submitted for projects shared with this client.' });
      return;
    }
    const project = await Project.findOne({ _id: projectId, companyId: client.companyId, isArchived: false }).select('_id');
    if (!project) { res.status(404).json({ success: false, message: 'Shared project not found.' }); return; }
    const request = await ClientRequestModel.create({
      companyId: client.companyId,
      clientUserId: client._id,
      projectId: project._id,
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 4000),
      status: 'submitted',
      comments: [],
    });
    res.status(201).json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addClientRequestComment = async (req: ClientRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ success: false, message: 'Comment is required.' }); return; }
    const client = await ClientUser.findOne({ _id: req.client!.clientUserId, companyId: req.client!.companyId, isActive: true }).select('_id fullName sharedProjects');
    if (!client) { res.status(403).json({ success: false, message: 'Client account is not active.' }); return; }
    const request = await ClientRequestModel.findOne({ _id: req.params.id, companyId: client.companyId, clientUserId: client._id, projectId: { $in: client.sharedProjects } });
    if (!request) { res.status(404).json({ success: false, message: 'Request not found or no longer shared.' }); return; }
    request.comments.push({ authorType: 'client', authorId: client._id, authorName: client.fullName, content: content.trim().slice(0, 4000), createdAt: new Date() });
    await request.save();
    res.json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getInternalClientRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, any> = { companyId: req.user!.companyId };
    if (typeof req.query.projectId === 'string') filter.projectId = req.query.projectId;
    if (typeof req.query.status === 'string') filter.status = req.query.status;
    const requests = await ClientRequestModel.find(filter)
      .populate('clientUserId', 'fullName')
      .populate('projectId', 'name color crmCompanyId')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateInternalClientRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, content } = req.body;
    const statuses = new Set(['submitted', 'in_review', 'resolved', 'rejected']);
    if (status !== undefined && !statuses.has(status)) { res.status(400).json({ success: false, message: 'Invalid request status.' }); return; }
    const request = await ClientRequestModel.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!request) { res.status(404).json({ success: false, message: 'Request not found.' }); return; }
    if (status !== undefined) request.status = status;
    if (typeof content === 'string' && content.trim()) {
      const teamUser = await import('../models/User').then((module) => module.default.findOne({ _id: req.user!.userId, companyId: req.user!.companyId }).select('fullName'));
      request.comments.push({ authorType: 'team', authorId: new mongoose.Types.ObjectId(req.user!.userId), authorName: teamUser?.fullName ?? 'Team', content: content.trim().slice(0, 4000), createdAt: new Date() });
    }
    await request.save();
    res.json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
