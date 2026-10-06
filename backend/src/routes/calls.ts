import { Router } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  acceptGlobalCall,
  cancelGlobalCall,
  createCrmCallNote,
  createGlobalCall,
  declineGlobalCall,
  endGlobalCall,
  listCallHistory,
  refreshCallSessionToken,
} from '../controllers/globalCalling.controller';

const router = Router();
router.use(authenticate);
router.post('/', rateLimiter(15, 10), asyncHandler(createGlobalCall));
router.get('/history', asyncHandler(listCallHistory));
router.post('/history/crm-notes', requireCompany, asyncHandler(createCrmCallNote));
router.post('/:sessionId/accept', rateLimiter(15, 20), asyncHandler(acceptGlobalCall));
router.post('/:sessionId/decline', asyncHandler(declineGlobalCall));
router.post('/:sessionId/cancel', asyncHandler(cancelGlobalCall));
router.post('/:sessionId/end', asyncHandler(endGlobalCall));
router.post('/:sessionId/token', asyncHandler(refreshCallSessionToken));

export default router;
