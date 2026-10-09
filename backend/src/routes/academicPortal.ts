import { Router } from 'express';
import { getAcademicPortal } from '../controllers/academicPortal.controller';
import { authenticate } from '../middleware/auth';
import { requireAcademicOrganization } from '../middleware/academicOrganization';

const router = Router();
router.use(authenticate, requireAcademicOrganization);
router.get('/me', getAcademicPortal);

export default router;
