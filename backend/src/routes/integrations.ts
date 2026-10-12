import { Router } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import {
  getIntegrations, connectIntegration, disconnectIntegration,
  receiveWebhook, updateIntegrationConfig,
} from '../controllers/integration.controller';

const router = Router();

// Inbound webhook from third-party — no auth (verified by HMAC)
router.post('/webhook/:token', receiveWebhook);

// All other routes require authentication
router.use(authenticate, requireCompany, requireOrganizationFeature('businessIntegrations'));

router.get('/',                              getIntegrations);
router.post('/:provider/connect',            connectIntegration);
router.delete('/:provider',                  disconnectIntegration);
router.patch('/:provider/config',            updateIntegrationConfig);

export default router;
