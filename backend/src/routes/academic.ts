import { Router } from 'express';
import {
  createClass,
  createCourse,
  createDepartment,
  createGuardianLink,
  createPerson,
  listClasses,
  listCourses,
  listDepartments,
  listGuardianLinks,
  listPeople,
} from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth';
import { requireAcademicAdmin } from '../middleware/academicOrganization';

const router = Router();

router.use(authenticate, requireAcademicAdmin);

router.get('/people', listPeople);
router.post('/people', createPerson);
router.get('/departments', listDepartments);
router.post('/departments', createDepartment);
router.get('/courses', listCourses);
router.post('/courses', createCourse);
router.get('/classes', listClasses);
router.post('/classes', createClass);
router.get('/guardians', listGuardianLinks);
router.post('/guardians', createGuardianLink);

export default router;
