import { Router } from 'express';
import { getDailyFocus, refreshDailyFocus } from '../controllers/dailyFocus.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireEntitlement('aiAssistant'));

router.get('/', getDailyFocus);
router.post('/refresh', refreshDailyFocus);

export default router;
