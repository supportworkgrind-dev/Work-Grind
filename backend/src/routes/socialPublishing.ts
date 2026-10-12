import { Router } from 'express';
import { authenticate, requireCompany, requireEntitlement, requireSubscription } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateObjectId } from '../middleware/validateObjectId';
import { asyncHandler } from '../middleware/asyncHandler';
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

router.get('/connection', asyncHandler(getLinkedInConnection));
router.delete('/connection', asyncHandler(disconnectLinkedIn));
router.get('/posts', asyncHandler(listSocialPosts));
router.post('/posts', rateLimiter(15, 30), asyncHandler(createSocialDraft));
router.post('/draft/generate', rateLimiter(15, 10), requireEntitlement('aiAssistant'), asyncHandler(generateSocialDraft));
router.patch('/posts/:id', validateObjectId('id'), asyncHandler(updateSocialDraft));
router.post('/posts/:id/request-approval', validateObjectId('id'), asyncHandler(requestSocialPostApproval));
router.post('/posts/:id/review/:decision', validateObjectId('id'), asyncHandler(reviewSocialPost));
router.post('/posts/:id/publish', rateLimiter(15, 10), validateObjectId('id'), asyncHandler(publishSocialPost));

export default router;
