import { Router } from 'express';
import {
  createClass,
  createCourse,
  createDepartment,
  createGuardianLink,
  createEnrollment,
  createPerson,
  listClasses,
  listCourses,
  listDepartments,
  listGuardianLinks,
  listEnrollments,
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
router.get('/enrollments', listEnrollments);
router.post('/enrollments', createEnrollment);

export default router;
