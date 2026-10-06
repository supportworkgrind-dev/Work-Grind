import { Router } from 'express';
import { authenticate, requireCompany, requireSubscription } from '../middleware/auth';
import { validateObjectId } from '../middleware/validateObjectId';
import {
  getWorkflows, getWorkflow, createWorkflow,
  updateWorkflow, deleteWorkflow,
  getWorkflowExecutions, testWorkflow,
} from '../controllers/workflow.controller';

const router = Router();
router.use(authenticate, requireCompany, requireSubscription);

router.get('/',                                       getWorkflows);
router.post('/',                                      createWorkflow);
router.get('/:id',    validateObjectId('id'),         getWorkflow);
router.patch('/:id',  validateObjectId('id'),         updateWorkflow);
router.delete('/:id', validateObjectId('id'),         deleteWorkflow);
router.get('/:id/executions', validateObjectId('id'), getWorkflowExecutions);
router.post('/:id/test',      validateObjectId('id'), testWorkflow);

export default router;
