import { Router } from 'express';
import {
  getAdminMembers,
  updateMemberRole,
  updateMemberStatus,
  getAuditLogs,
  getAdminStats,
  getAdminCrmStats,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';

const router = Router();

router.use(authenticate);
router.use(requireRole('owner', 'admin'));

router.get('/members', requireOrganizationFeature('memberDirectory'), getAdminMembers);
router.patch('/members/:userId/role', requireOrganizationFeature('memberDirectory'), updateMemberRole);
router.patch('/members/:userId/status', requireOrganizationFeature('memberDirectory'), updateMemberStatus);
router.get('/audit-logs', requireOrganizationFeature('memberDirectory'), getAuditLogs);
router.get('/stats', requireOrganizationFeature('businessAdmin'), getAdminStats);
router.get('/crm-stats', requireOrganizationFeature('businessCrm'), getAdminCrmStats);

export default router;
