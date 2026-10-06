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

const router = Router();

router.use(authenticate);
router.use(requireRole('owner', 'admin'));

router.get('/members', getAdminMembers);
router.patch('/members/:userId/role', updateMemberRole);
router.patch('/members/:userId/status', updateMemberStatus);
router.get('/audit-logs', getAuditLogs);
router.get('/stats', getAdminStats);
router.get('/crm-stats', getAdminCrmStats);

export default router;
