import { Router } from 'express';
import { authenticate, requireCompany, requireEntitlement, requireSubscription } from '../middleware/auth';
import { getOverview, getCrmAnalytics, getTaskAnalytics, getTeamAnalytics, getMeetingAnalytics } from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate, requireCompany, requireSubscription, requireEntitlement('advancedAnalytics'));

router.get('/overview',  getOverview);
router.get('/crm',       getCrmAnalytics);
router.get('/tasks',     getTaskAnalytics);
router.get('/team',      getTeamAnalytics);
router.get('/meetings',  getMeetingAnalytics);

export default router;
