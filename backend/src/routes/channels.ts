import { Router } from 'express';
import {
  getChannels,
  createChannel,
  getChannel,
  updateChannel,
  joinChannel,
  leaveChannel,
} from '../controllers/channel.controller';
import { authenticate, requireEntitlement, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireEntitlement('teamChat'));

router.get('/', getChannels);
router.post('/', requireRole('owner', 'admin', 'manager'), createChannel);
router.get('/:id', getChannel);
router.patch('/:id', requireRole('owner', 'admin'), updateChannel);
router.post('/:id/join', joinChannel);
router.post('/:id/leave', leaveChannel);

export default router;
