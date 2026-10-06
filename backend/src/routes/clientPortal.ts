import { Router } from 'express';
import { authenticate, requireCompany, requireRole } from '../middleware/auth';
import { authenticateClient } from '../controllers/clientPortal.controller';
import {
  inviteClient, listClients, shareWithClient, removeClient,
  sendMessageToClient,
  acceptInvite, clientLogin,
  getClientPortal, clientSendMessage,
  getClientRequests, createClientRequest, addClientRequestComment,
  getInternalClientRequests, updateInternalClientRequest,
} from '../controllers/clientPortal.controller';
import { validateObjectId } from '../middleware/validateObjectId';
import { rateLimiter } from '../middleware/rateLimiter';
import { getClientApprovals, respondToClientApproval } from '../controllers/approval.controller';

const router = Router();

// ── Client auth (public) ──────────────────────────────────────────────────────
router.post('/auth/accept-invite', rateLimiter(15, 10), acceptInvite);
router.post('/auth/login',         rateLimiter(15, 10), clientLogin);

// ── Client portal (client JWT) ────────────────────────────────────────────────
router.get('/portal',           authenticateClient as any, getClientPortal);
router.post('/portal/messages', authenticateClient as any, clientSendMessage);
router.get('/portal/requests', authenticateClient as any, getClientRequests);
router.post('/portal/requests', authenticateClient as any, createClientRequest);
router.post('/portal/requests/:id/comments', authenticateClient as any, validateObjectId('id'), addClientRequestComment);
router.get('/portal/approvals', authenticateClient as any, getClientApprovals);
router.patch('/portal/approvals/:id', authenticateClient as any, validateObjectId('id'), respondToClientApproval);

// ── Internal team management (WorkGrind JWT) ───────────────────────────────────
router.use(authenticate, requireCompany);
router.get('/clients',                                  listClients);
router.post('/invite',                                  inviteClient);
router.patch('/clients/:id/share', validateObjectId('id'), shareWithClient);
router.delete('/clients/:id',      validateObjectId('id'), removeClient);
router.post('/messages',                                sendMessageToClient);
router.get('/requests', requireRole('owner', 'admin', 'manager'), getInternalClientRequests);
router.patch('/requests/:id', validateObjectId('id'), requireRole('owner', 'admin', 'manager'), updateInternalClientRequest);

export default router;
