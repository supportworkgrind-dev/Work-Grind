import { Router } from 'express';
import { authenticate, requireCompany, requireEntitlement, requireSubscription } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateObjectId } from '../middleware/validateObjectId';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createSocialDraft,
  deleteSocialDraft,
  disconnectLinkedIn,
  disconnectYouTube,
  getYouTubeConnection,
  generateSocialDraft,
  getSocialAccounts,
  getLinkedInConnection,
  getSocialProviders,
  previewSocialMedia,
  listSocialPosts,
  publishSocialPost,
  requestSocialPostApproval,
  reviewSocialPost,
  scheduleSocialPost,
  cancelSocialPostSchedule,
  dispatchScheduledSocialPosts,
  updateSocialDraft,
} from '../controllers/socialPublishing.controller';

const router = Router();

router.get('/dispatch', asyncHandler(dispatchScheduledSocialPosts));
router.use(
  authenticate,
  requireCompany,
  requireOrganizationFeature('socialPublishing'),
  requireSubscription,
);

router.get('/providers', asyncHandler(getSocialProviders));
router.get('/accounts', asyncHandler(getSocialAccounts));
router.get('/connection', asyncHandler(getLinkedInConnection));
router.get('/media/:id', validateObjectId('id'), asyncHandler(previewSocialMedia));
router.delete('/connection', asyncHandler(disconnectLinkedIn));
router.get('/youtube/connection', asyncHandler(getYouTubeConnection));
router.delete('/youtube/connection', asyncHandler(disconnectYouTube));
router.get('/posts', asyncHandler(listSocialPosts));
router.post('/posts', rateLimiter(15, 30), asyncHandler(createSocialDraft));
router.post('/draft/generate', rateLimiter(15, 10), requireEntitlement('aiAssistant'), asyncHandler(generateSocialDraft));
router.patch('/posts/:id', validateObjectId('id'), asyncHandler(updateSocialDraft));
router.delete('/posts/:id', validateObjectId('id'), asyncHandler(deleteSocialDraft));
router.post('/posts/:id/request-approval', validateObjectId('id'), asyncHandler(requestSocialPostApproval));
router.post('/posts/:id/review/:decision', validateObjectId('id'), asyncHandler(reviewSocialPost));
router.post('/posts/:id/schedule', validateObjectId('id'), asyncHandler(scheduleSocialPost));
router.delete('/posts/:id/schedule', validateObjectId('id'), asyncHandler(cancelSocialPostSchedule));
router.post('/posts/:id/publish', rateLimiter(15, 10), validateObjectId('id'), asyncHandler(publishSocialPost));

export default router;
