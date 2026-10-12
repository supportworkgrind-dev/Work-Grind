import { Router } from 'express';
import { authenticate, requireCompany, requireRole } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { validateObjectId } from '../middleware/validateObjectId';
import { createApproval, getApprovals, respondToApproval } from '../controllers/approval.controller';

const router = Router();

router.use(authenticate, requireCompany, requireOrganizationFeature('companyWorkspace'));
router.get('/', getApprovals);
router.post('/', requireRole('owner', 'admin', 'manager'), createApproval);
router.patch('/:id', validateObjectId('id'), respondToApproval);

export default router;