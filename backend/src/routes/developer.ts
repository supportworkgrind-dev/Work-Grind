import { Router } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireDeveloperAdmin } from '../middleware/requireDeveloperAdmin';
import { validateObjectId } from '../middleware/validateObjectId';
import {
  createApiKey, createWebhook, deleteWebhook, listApiKeys, listApiRequestLogs,
  listWebhooks, revokeApiKey, rotateApiKey, runDeveloperTest, updateWebhook,
} from '../controllers/developer.controller';

const router = Router();
router.use(authenticate, requireCompany, requireDeveloperAdmin);
router.get('/keys', asyncHandler(listApiKeys));
router.post('/keys', asyncHandler(createApiKey));
router.post('/keys/:id/rotate', validateObjectId('id'), asyncHandler(rotateApiKey));
router.delete('/keys/:id', validateObjectId('id'), asyncHandler(revokeApiKey));
router.get('/logs', asyncHandler(listApiRequestLogs));
router.get('/webhooks', asyncHandler(listWebhooks));
router.post('/webhooks', asyncHandler(createWebhook));
router.patch('/webhooks/:id', validateObjectId('id'), asyncHandler(updateWebhook));
router.delete('/webhooks/:id', validateObjectId('id'), asyncHandler(deleteWebhook));
router.post('/test', runDeveloperTest);

export default router;
