import { Router } from 'express';
import {
  getEvents,
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
} from '../controllers/calendar.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireEntitlement('meetingsCalendar'));

router.get('/', getEvents);
router.post('/', createEvent);
router.get('/:id', getEventById);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export default router;
