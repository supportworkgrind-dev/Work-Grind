import { Router } from 'express';
import { getIceServers } from '../controllers/rtc.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get('/ice-servers', authenticate, asyncHandler(getIceServers));

export default router;
