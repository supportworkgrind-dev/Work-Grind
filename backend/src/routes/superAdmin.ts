import { Router } from 'express';
import {
  loginSuperAdmin,
  verifySuperAdminMfaLogin,
  getMfaStatus,
  startMfaSetup,
  verifyAndEnableMfa,
  regenerateRecoveryCodes,
  disableMfa,
  getSuperAdminMe,
  getPlatformAnalytics,
  getUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  resetUserPassword,
  updateUserPlan,
  getWorkspaces,
  updateWorkspacePlan,
  deleteWorkspace,
  getTickets,
  getTicketDetails,
  markTicketAsRead,
  replyTicket,
  updateTicket,
  deleteTicket,
  getSystemHealth,
  testEmailConnection,
  getCrmStats,
  getAiAnalytics,
} from '../controllers/superAdmin.controller';
import { requireSuperAdmin } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public Super Admin login endpoint (protected by password and rate limiting)
router.post('/auth/login', rateLimiter(15, 5), loginSuperAdmin);
router.post('/auth/verify-mfa', rateLimiter(15, 5), verifySuperAdminMfaLogin);

// All subsequent routes require a valid Super Admin token
router.use(requireSuperAdmin);

// Super Admin Profile & MFA Management
router.get('/auth/me', getSuperAdminMe);
router.get('/mfa/status', getMfaStatus);
router.post('/mfa/setup', startMfaSetup);
router.post('/mfa/enable', verifyAndEnableMfa);
router.post('/mfa/regenerate-recovery-codes', regenerateRecoveryCodes);
router.post('/mfa/disable', disableMfa);

// Platform Overview & Analytics
router.get('/analytics', getPlatformAnalytics);

// User Management
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/reset-password', resetUserPassword);
router.patch('/users/:id/plan', updateUserPlan);

// Workspace / Company Management
router.get('/workspaces', getWorkspaces);
router.patch('/workspaces/:id/plan', updateWorkspacePlan);
router.delete('/workspaces/:id', deleteWorkspace);

// Support & Moderation Queue / Contact Inbox
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicketDetails);
router.patch('/tickets/:id', updateTicket);
router.patch('/tickets/:id/read', markTicketAsRead);
router.post('/tickets/:id/reply', replyTicket);
router.delete('/tickets/:id', deleteTicket);

// System Health & Monitoring
router.get('/system/health', getSystemHealth);
router.post('/system/test-email', testEmailConnection);

// CRM statistics — platform-wide (matches frontend call: adminApi.get('/admin/crm-stats'))
router.get('/admin/crm-stats', getCrmStats);

// AI Analytics
router.get('/ai/analytics', getAiAnalytics);

export default router;
