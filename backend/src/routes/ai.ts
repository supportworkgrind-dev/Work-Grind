import { Router } from 'express';
import { summarizeDocument } from '../controllers/documentAI.controller';
import { chatWithTavro } from '../controllers/aiAgent.controller';
import { knowledgeQuery } from '../controllers/knowledgeAI.controller';
import { authenticate, requireCompany, requireEntitlement, requireSubscription } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireEntitlement('aiAssistant'));

router.post('/chat', chatWithTavro);
router.post('/summarize-document', summarizeDocument);
router.post('/knowledge', requireCompany, requireSubscription, knowledgeQuery);

export default router;
