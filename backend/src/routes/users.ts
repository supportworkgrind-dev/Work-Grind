import { Router } from 'express';
import {
  getUsers,
  getUserById,
  getUserByPublicId,
  updateMe,
  updateStatus,
  inviteMember,
  uploadAvatar,
  deactivateMe,
} from '../controllers/user.controller';
import { authenticate, requireCompany, requireRole } from '../middleware/auth';
import { avatarUpload } from '../middleware/upload';
import { asyncHandler } from '../middleware/asyncHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  backfillWorkspaceCallingIds,
  checkCallingIdAvailability,
  generateMyCallingId,
  getMyCallingId,
  resolveCallingId,
} from '../controllers/callingId.controller';

const router = Router();

router.use(authenticate);

router.get('/', getUsers);
router.get('/me', (req, res, next) => {
  // handled in auth or updateMe
  next();
});
router.get('/me/calling-id', asyncHandler(getMyCallingId));
router.post('/me/calling-id/generate', asyncHandler(generateMyCallingId));
router.get('/calling-id/availability/:callingId', requireRole('owner', 'admin'), rateLimiter(15, 60), asyncHandler(checkCallingIdAvailability));
router.post('/calling-id/backfill', requireRole('owner', 'admin'), asyncHandler(backfillWorkspaceCallingIds));
router.get('/calling-id/:callingId', asyncHandler(resolveCallingId));
router.get('/public-id/:callingId', rateLimiter(1, 30), asyncHandler(getUserByPublicId));
router.patch('/me', updateMe);
router.patch('/me/deactivate', deactivateMe);
router.patch('/me/avatar', avatarUpload.single('avatar'), uploadAvatar);
router.patch('/me/status', updateStatus);
// Role guard: only owners, admins, and managers can invite members
router.post('/invite', requireRole('owner', 'admin', 'manager'), inviteMember);
router.get('/:id', getUserById);

export default router;
