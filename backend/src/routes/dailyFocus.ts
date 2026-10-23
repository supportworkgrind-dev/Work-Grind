import { Router } from 'express';
import { getDailyFocus, refreshDailyFocus } from '../controllers/dailyFocus.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { requireAnyOrganizationFeature } from '../middleware/organizationAccess';

const router = Router();

// Daily Focus summarizes the caller's own tasks, meetings, and messages, so it
// follows the same workspace rule as tasks and projects (team and Solo).
router.use(authenticate, requireAnyOrganizationFeature('workspaceContent', 'soloWorkspace'), requireEntitlement('aiAssistant'));

router.get('/', getDailyFocus);
router.post('/refresh', refreshDailyFocus);

export default router;
