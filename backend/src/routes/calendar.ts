import { Router } from 'express';
import {
  getEvents,
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
} from '../controllers/calendar.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';

const router = Router();

router.use(authenticate, requireOrganizationFeature('calendar'), requireEntitlement('meetingsCalendar'));

router.get('/', getEvents);
router.post('/', createEvent);
router.get('/:id', getEventById);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export default router;
