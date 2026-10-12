import { Router } from 'express';
import { summarizeDocument } from '../controllers/documentAI.controller';
import { chatWithTavro } from '../controllers/aiAgent.controller';
import { knowledgeQuery } from '../controllers/knowledgeAI.controller';
import { authenticate, requireCompany, requireEntitlement, requireSubscription } from '../middleware/auth';
import { requireAnyOrganizationFeature } from '../middleware/organizationAccess';

const router = Router();

router.use(
  authenticate,
  requireAnyOrganizationFeature('workspaceContent', 'soloWorkspace', 'educationAi'),
  requireEntitlement('aiAssistant'),
);

router.post('/chat', chatWithTavro);
router.post('/summarize-document', summarizeDocument);
router.post('/knowledge', requireCompany, requireSubscription, knowledgeQuery);

export default router;
