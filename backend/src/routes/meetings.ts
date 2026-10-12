import { Router } from 'express';
import {
  getMeetings,
  getActiveMeetings,
  createMeeting,
  resolveMeetingInvitee,
  getMeetingByLink,
  joinMeeting,
  startMeeting,
  endMeeting,
  generateAISummary,
  createTaskFromAction,
} from '../controllers/meeting.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { rateLimiter } from '../middleware/rateLimiter';
import { invalidateAnalyticsOverviewCache } from '../middleware/invalidateAnalyticsCache';

const router = Router();

router.use(authenticate, requireOrganizationFeature('educationMeetings'));
router.use(invalidateAnalyticsOverviewCache);

router.get('/', requireEntitlement('meetingsCalendar'), getMeetings);
router.get('/active', requireEntitlement('meetingsCalendar'), getActiveMeetings);
router.post('/invitees/lookup', requireEntitlement('meetingsCalendar'), rateLimiter(1, 30), resolveMeetingInvitee);
router.post('/', requireEntitlement('meetingsCalendar'), createMeeting);
router.get('/:link', getMeetingByLink);
router.post('/:link/join', joinMeeting);
router.post('/:link/start', requireEntitlement('meetingsCalendar'), startMeeting);
router.post('/:link/end', requireEntitlement('meetingsCalendar'), endMeeting);
router.post('/:link/ai-summary', requireEntitlement('meetingsCalendar'), generateAISummary);
router.post('/:link/tasks', requireEntitlement('meetingsCalendar'), createTaskFromAction);

export default router;
