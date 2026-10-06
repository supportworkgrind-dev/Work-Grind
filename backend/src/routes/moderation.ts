import { Router } from 'express';
import {
  submitReport,
  getReports,
  getReport,
  moderateReport,
  getModerationStats,
} from '../controllers/moderation.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Any authenticated workspace member can file a report
router.post('/reports', submitReport);

// Owner/Admin only — view and act on reports
router.get('/reports',            requireRole('owner', 'admin'), getReports);
router.get('/reports/stats',      requireRole('owner', 'admin'), getModerationStats);
router.get('/reports/:id',        requireRole('owner', 'admin'), getReport);
router.post('/reports/:id/action',requireRole('owner', 'admin'), moderateReport);

export default router;
