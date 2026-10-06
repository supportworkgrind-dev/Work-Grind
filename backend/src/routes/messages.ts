import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  pinMessage,
} from '../controllers/channel.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate, requireEntitlement('teamChat'));

router.get('/', getMessages);
// 120 messages per minute per IP — generous for real usage, blocks automated spam
router.post('/', rateLimiter(1, 120), sendMessage);
router.patch('/:id', editMessage);
router.delete('/:id', deleteMessage);
router.post('/:id/react', reactToMessage);
router.post('/:id/pin', pinMessage);

export default router;
