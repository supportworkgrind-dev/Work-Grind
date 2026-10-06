import { Router } from 'express';
import {
  getTasks, getMyTasks, createTask, getTaskById,
  updateTask, deleteTask, addSubtask, toggleSubtask, addComment,
  startTaskTimer, stopTaskTimer,
} from '../controllers/task.controller';
import { authenticate, requireEntitlement, requireRole } from '../middleware/auth';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();

router.use(authenticate, requireEntitlement('tasksProjects'));

router.get('/',      getTasks);
router.get('/my',    getMyTasks);
router.post('/',     requireRole('owner', 'admin', 'manager'), createTask);
router.post('/:id/time/start', validateObjectId('id'), startTaskTimer);
router.post('/:id/time/stop',  validateObjectId('id'), stopTaskTimer);
router.get('/:id',   validateObjectId('id'), getTaskById);
router.patch('/:id', validateObjectId('id'), updateTask);
router.delete('/:id',validateObjectId('id'), requireRole('owner', 'admin'), deleteTask);
router.post('/:id/subtasks',              validateObjectId('id'), addSubtask);
router.patch('/:id/subtasks/:subtaskId',  validateObjectId('id', 'subtaskId'), toggleSubtask);
router.post('/:id/comments',              validateObjectId('id'), addComment);

export default router;
