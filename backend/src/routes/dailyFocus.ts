import { Router } from 'express';
import { getDailyFocus, refreshDailyFocus } from '../controllers/dailyFocus.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';

const router = Router();

router.use(authenticate, requireOrganizationFeature('workspaceContent'), requireEntitlement('aiAssistant'));

router.get('/', getDailyFocus);
router.post('/refresh', refreshDailyFocus);

export default router;
