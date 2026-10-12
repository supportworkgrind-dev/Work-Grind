import { Router } from 'express';
import { authenticate, requireCompany, requireEntitlement, requireSubscription } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateObjectId } from '../middleware/validateObjectId';
import {
  createSocialDraft,
  disconnectLinkedIn,
  generateSocialDraft,
  getLinkedInConnection,
  listSocialPosts,
  publishSocialPost,
  requestSocialPostApproval,
  reviewSocialPost,
  updateSocialDraft,
} from '../controllers/socialPublishing.controller';

const router = Router();

router.use(
  authenticate,
  requireCompany,
  requireOrganizationFeature('businessAutomation'),
  requireSubscription,
);

router.get('/connection', getLinkedInConnection);
router.delete('/connection', disconnectLinkedIn);
router.get('/posts', listSocialPosts);
router.post('/posts', rateLimiter(15, 30), createSocialDraft);
router.post('/draft/generate', rateLimiter(15, 10), requireEntitlement('aiAssistant'), generateSocialDraft);
router.patch('/posts/:id', validateObjectId('id'), updateSocialDraft);
router.post('/posts/:id/request-approval', validateObjectId('id'), requestSocialPostApproval);
router.post('/posts/:id/review/:decision', validateObjectId('id'), reviewSocialPost);
router.post('/posts/:id/publish', rateLimiter(15, 10), validateObjectId('id'), publishSocialPost);

export default router;
