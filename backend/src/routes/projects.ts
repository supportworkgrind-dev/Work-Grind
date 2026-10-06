import { Router } from 'express';
import {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectTasks,
  getProjectStats,
  getProjectConnectedData,
} from '../controllers/project.controller';
import { authenticate, requireEntitlement, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireEntitlement('tasksProjects'));

router.get('/', getProjects);
router.post('/', requireRole('owner', 'admin', 'manager'), createProject);
router.get('/:id/connected-data', getProjectConnectedData);
router.get('/:id', getProjectById);
router.patch('/:id', requireRole('owner', 'admin', 'manager'), updateProject);
router.delete('/:id', requireRole('owner', 'admin'), deleteProject);
router.get('/:id/tasks', getProjectTasks);
router.get('/:id/stats', getProjectStats);

export default router;
