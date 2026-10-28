import { Router } from 'express';
import { acceptInvitation, getPublicInvitation } from '../controllers/academicInvitation.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Invitation links are opened before sign-in; the token itself is the credential.
router.get('/:token', rateLimiter(15, 30), getPublicInvitation);
router.post('/accept', authenticate, rateLimiter(15, 10), acceptInvitation);

export default router;
