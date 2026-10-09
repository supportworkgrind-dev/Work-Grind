import { Router } from 'express';
import {
  createClass,
  createCourse,
  createDepartment,
  createGuardianLink,
  createEnrollment,
  createTeachingAssignment,
  createPerson,
  createSchedule,
  createAssignment,
  createAssessment,
  createFeeCharge,
  recordAttendance,
  recordResult,
  recordFeePayment,
  listClasses,
  listCourses,
  listDepartments,
  listGuardianLinks,
  listEnrollments,
  listTeachingAssignments,
  listPeople,
  listSchedules,
  listAssignments,
  listAssessments,
  listResults,
  listFeeCharges,
  listAttendance,
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
router.get('/teaching-assignments', listTeachingAssignments);
router.post('/teaching-assignments', createTeachingAssignment);
router.get('/schedules', listSchedules);
router.post('/schedules', createSchedule);
router.get('/assignments', listAssignments);
router.post('/assignments', createAssignment);
router.get('/attendance', listAttendance);
router.put('/attendance', recordAttendance);
router.get('/assessments', listAssessments);
router.post('/assessments', createAssessment);
router.get('/results', listResults);
router.put('/results', recordResult);
router.get('/fees', listFeeCharges);
router.post('/fees', createFeeCharge);
router.post('/fees/:chargeId/payments', recordFeePayment);

export default router;
