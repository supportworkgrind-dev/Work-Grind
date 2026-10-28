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
  updateAcademicRecord,
  deleteAcademicRecord,
} from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth';
import { requireAcademicAdmin, requireAcademicInstitutionAdmin } from '../middleware/academicOrganization';
import { requireAssignedAcademicDepartment } from '../middleware/academicDepartmentAccess';
import { academicImportUpload, validateUploadedContent } from '../middleware/upload';
import {
  createImportJob,
  downloadImportErrors,
  downloadImportTemplate,
  exportAcademicData,
  getImportJob,
  getImportProgress,
  getImportSettings,
  listImportHistory,
  listImportModules,
  previewImportFile,
  updateImportSettings,
} from '../controllers/academicImport.controller';
import { listInvitations, revokeInvitation, sendInvitations } from '../controllers/academicInvitation.controller';

const router = Router();

router.use(authenticate, requireAcademicAdmin, requireAssignedAcademicDepartment);

// Whole-institution data movement: deans and heads of department act only on
// their own departments, so imports, exports and invitations stay with
// institution administrators.
const requireInstitutionDataAdmin = requireAcademicInstitutionAdmin;

router.get('/imports/modules', requireInstitutionDataAdmin, listImportModules);
router.get('/imports/templates/:module', requireInstitutionDataAdmin, downloadImportTemplate);
router.get('/imports/settings', requireInstitutionDataAdmin, getImportSettings);
router.put('/imports/settings', requireInstitutionDataAdmin, updateImportSettings);
router.get('/imports/history', requireInstitutionDataAdmin, listImportHistory);
router.get('/imports/progress/:key', requireInstitutionDataAdmin, getImportProgress);
router.get('/imports/jobs/:id', requireInstitutionDataAdmin, getImportJob);
router.get('/imports/jobs/:id/errors.csv', requireInstitutionDataAdmin, downloadImportErrors);
router.post('/imports/preview', requireInstitutionDataAdmin, academicImportUpload.single('file'), validateUploadedContent, previewImportFile);
router.post('/imports/jobs', requireInstitutionDataAdmin, academicImportUpload.single('file'), validateUploadedContent, createImportJob);
router.get('/exports/:module', requireInstitutionDataAdmin, exportAcademicData);
router.get('/invitations', requireInstitutionDataAdmin, listInvitations);
router.post('/invitations/send', requireInstitutionDataAdmin, sendInvitations);
router.post('/invitations/:id/revoke', requireInstitutionDataAdmin, revokeInvitation);

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
router.patch('/:resource/:id', updateAcademicRecord);
router.delete('/:resource/:id', deleteAcademicRecord);

export default router;
