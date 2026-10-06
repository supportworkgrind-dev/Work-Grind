import { Router } from 'express';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  runAgent,
  getConversationHistory,
  getConversation,
  deleteConversation,
  getTools,
} from '../controllers/aiAgent.controller';

const router = Router();

router.use(authenticate, requireEntitlement('aiAssistant'));

// 30 agent requests per hour — prevents abuse while keeping normal usage smooth
router.use(rateLimiter(60, 30));

router.post('/agent',                        runAgent);
router.get('/agent/tools',                   getTools);
router.get('/agent/history',                 getConversationHistory);
router.get('/agent/conversations/:id',       getConversation);
router.delete('/agent/conversations/:id',    deleteConversation);

export default router;
