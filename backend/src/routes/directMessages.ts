import { Router } from 'express';
import {
  getConversations,
  startConversation,
  getDMMessages,
  sendDMMessage,
  markDMAsRead,
} from '../controllers/directMessage.controller';
// Re-use channel message mutation controllers — they already handle conversationId
// and now also emit the correct DM socket events
import {
  editMessage,
  deleteMessage,
  reactToMessage,
  pinMessage,
} from '../controllers/channel.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate, requireEntitlement('teamChat'));

// ── Conversations ─────────────────────────────────────────────────────────────
router.get('/conversations',  getConversations);
router.post('/conversations', rateLimiter(1, 20), startConversation);

// ── Messages ──────────────────────────────────────────────────────────────────
router.get( '/:conversationId/messages',            getDMMessages);
router.post('/:conversationId/messages',            sendDMMessage);
router.patch('/:conversationId/read',               markDMAsRead);

// ── Per-message mutations (shared with channel controller, now DM-aware) ──────
router.patch( '/:conversationId/messages/:id',      editMessage);
router.delete('/:conversationId/messages/:id',      deleteMessage);
router.post(  '/:conversationId/messages/:id/react',reactToMessage);
router.post(  '/:conversationId/messages/:id/pin',  pinMessage);

export default router;
