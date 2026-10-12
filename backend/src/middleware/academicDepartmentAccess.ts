import mongoose from 'mongoose';
import { NextFunction, Response } from 'express';
import AcademicAssignment from '../models/AcademicAssignment';
import AcademicAssessment from '../models/AcademicAssessment';
import AcademicAttendance from '../models/AcademicAttendance';
import AcademicClass from '../models/AcademicClass';
import AcademicCourse from '../models/AcademicCourse';
import AcademicDepartment from '../models/AcademicDepartment';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicFeeCharge from '../models/AcademicFeeCharge';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import AcademicPerson from '../models/AcademicPerson';
import AcademicResult from '../models/AcademicResult';
import AcademicSchedule from '../models/AcademicSchedule';
import AcademicTeachingAssignment from '../models/AcademicTeachingAssignment';
import { roleMatches } from '../config/organization';
import { AuthRequest } from './auth';

export interface AcademicDepartmentScope {
  departmentIds: string[];
  courseIds: string[];
  classIds: string[];
  studentIds: string[];
  teacherIds: string[];
  guardianIds: string[];
  personIds: string[];
  assessmentIds: string[];
}

const TRUSTED_ASSIGNMENT_ROLES = ['owner', 'founder', 'principal', 'director', 'admin', 'office_staff'];

function isDean(role: string): boolean {
  return roleMatches(role, ['dean'], 'university');
}

function isHod(role: string): boolean {
  return roleMatches(role, ['hod'], 'university');
}

function isTrustedAssignmentActor(role: string): boolean {
  return roleMatches(role, TRUSTED_ASSIGNMENT_ROLES, 'university');
}

function ids(values: unknown[]): string[] {
  return values.map((value) => value instanceof mongoose.Types.ObjectId ? value.toString() : String(value));
}

function isInScope(value: unknown, allowedIds: string[]): boolean {
  return typeof value === 'string' && mongoose.isValidObjectId(value) && allowedIds.includes(value);
}

async function studentDepartmentIds(companyId: mongoose.Types.ObjectId, studentId: unknown): Promise<string[]> {
  const classes = await AcademicEnrollment.find({ companyId, studentId }).select('classId').lean();
  const classIds = classes.map((enrollment) => enrollment.classId);
  if (!classIds.length) return [];
  return ids(await AcademicClass.distinct('departmentId', { companyId, _id: { $in: classIds } }));
}

async function recordDepartmentIds(
  resource: string,
  id: mongoose.Types.ObjectId,
  companyId: mongoose.Types.ObjectId
): Promise<string[]> {
  if (resource === 'departments') return [id.toString()];
  if (resource === 'courses') {
    const course = await AcademicCourse.findOne({ _id: id, companyId }).select('departmentId').lean();
    return course ? [course.departmentId.toString()] : [];
  }
  if (resource === 'classes') {
    const academicClass = await AcademicClass.findOne({ _id: id, companyId }).select('departmentId').lean();
    return academicClass ? [academicClass.departmentId.toString()] : [];
  }
  if (resource === 'people') {
    const person = await AcademicPerson.findOne({ _id: id, companyId }).select('type').lean();
    if (!person) return [];
    if (person.type === 'student') return studentDepartmentIds(companyId, id);
    if (person.type === 'teacher') {
      const classIds = await AcademicTeachingAssignment.distinct('classId', { companyId, teacherId: id });
      return classIds.length ? ids(await AcademicClass.distinct('departmentId', { companyId, _id: { $in: classIds } })) : [];
    }
    const studentIds = await AcademicGuardianLink.distinct('studentId', { companyId, guardianId: id });
    const results = await Promise.all(studentIds.map((studentId) => studentDepartmentIds(companyId, studentId)));
    return [...new Set(results.flat())];
  }
  if (resource === 'guardians') {
    const link = await AcademicGuardianLink.findOne({ _id: id, companyId }).select('studentId').lean();
    return link ? studentDepartmentIds(companyId, link.studentId) : [];
  }
  if (resource === 'enrollments') {
    const record = await AcademicEnrollment.findOne({ _id: id, companyId }).select('classId').lean();
    const departmentId = record && await AcademicClass.findOne({ _id: record.classId, companyId }).select('departmentId').lean();
    return departmentId ? [departmentId.departmentId.toString()] : [];
  }
  if (resource === 'teaching-assignments') {
    const record = await AcademicTeachingAssignment.findOne({ _id: id, companyId }).select('classId').lean();
    const academicClass = record && await AcademicClass.findOne({ _id: record.classId, companyId }).select('departmentId').lean();
    return academicClass ? [academicClass.departmentId.toString()] : [];
  }
  if (resource === 'schedules' || resource === 'assignments' || resource === 'attendance' || resource === 'assessments') {
    const record: { classId: mongoose.Types.ObjectId; courseId?: mongoose.Types.ObjectId } | null = resource === 'schedules'
      ? await AcademicSchedule.findOne({ _id: id, companyId }).select('classId courseId').lean()
      : resource === 'assignments'
        ? await AcademicAssignment.findOne({ _id: id, companyId }).select('classId courseId').lean()
        : resource === 'attendance'
          ? await AcademicAttendance.findOne({ _id: id, companyId }).select('classId').lean()
          : await AcademicAssessment.findOne({ _id: id, companyId }).select('classId courseId').lean();
    const academicClass = record && await AcademicClass.findOne({ _id: record.classId, companyId }).select('departmentId').lean();
    const course = record?.courseId && await AcademicCourse.findOne({ _id: record.courseId, companyId }).select('departmentId').lean();
    return academicClass ? [...new Set([academicClass.departmentId.toString(), ...(course ? [course.departmentId.toString()] : [])])] : [];
  }
  if (resource === 'results') {
    const result = await AcademicResult.findOne({ _id: id, companyId }).select('assessmentId').lean();
    const assessment = result && await AcademicAssessment.findOne({ _id: result.assessmentId, companyId }).select('classId courseId').lean();
    if (!assessment) return [];
    return recordDepartmentIds('assessments', assessment._id, companyId);
  }
  if (resource === 'fees') {
    const charge = await AcademicFeeCharge.findOne({ _id: id, companyId }).select('studentId').lean();
    return charge ? studentDepartmentIds(companyId, charge.studentId) : [];
  }
  return [];
}

async function relationIsAllowed(
  resource: string,
  body: Record<string, unknown>,
  companyId: mongoose.Types.ObjectId,
  scope: AcademicDepartmentScope,
): Promise<boolean> {
  const supplied = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  if (resource === 'departments') {
    return !supplied('authorizedDeanUserIds') && !supplied('authorizedHodUserIds');
  }
  if (resource === 'courses' && supplied('departmentId')) return isInScope(body.departmentId, scope.departmentIds);
  if (resource === 'classes') {
    if (supplied('departmentId') && !isInScope(body.departmentId, scope.departmentIds)) return false;
    const departmentId = supplied('departmentId') ? body.departmentId : undefined;
    if (supplied('courseIds')) {
      if (!Array.isArray(body.courseIds) || body.courseIds.some((courseId) => !isInScope(courseId, scope.courseIds))) return false;
      if (departmentId) {
        const courses = await AcademicCourse.find({ _id: { $in: body.courseIds }, companyId }).select('departmentId').lean();
        if (courses.some((course) => course.departmentId.toString() !== String(departmentId))) return false;
      }
    }
    return true;
  }
  if (resource === 'enrollments') {
    if (supplied('classId') && !isInScope(body.classId, scope.classIds)) return false;
    if (supplied('studentId')) {
      const student = await AcademicPerson.findOne({ _id: body.studentId, companyId, type: 'student', status: 'active' }).select('_id').lean();
      if (!student) return false;
    }
    return true;
  }
  if (resource === 'people') return false;
  if (resource === 'guardians') {
    if (supplied('studentId') && !isInScope(body.studentId, scope.studentIds)) return false;
    if (supplied('guardianId')) {
      const guardian = await AcademicPerson.findOne({
        _id: body.guardianId, companyId, type: 'parent', status: 'active',
      }).select('_id').lean();
      if (!guardian) return false;
    }
    return true;
  }
  if (resource === 'fees') return !supplied('studentId') || isInScope(body.studentId, scope.studentIds);
  if (resource === 'results') {
    if (supplied('assessmentId') && !isInScope(body.assessmentId, scope.assessmentIds)) return false;
    if (supplied('studentId')) {
      const resultAssessmentId = body.assessmentId;
      if (resultAssessmentId) {
        const assessment = await AcademicAssessment.findOne({ _id: resultAssessmentId, companyId }).select('classId').lean();
        const enrollment = assessment && await AcademicEnrollment.findOne({
          companyId, classId: assessment.classId, studentId: body.studentId,
        }).select('_id').lean();
        if (!enrollment) return false;
      }
    }
    return true;
  }
  if (supplied('classId') && !isInScope(body.classId, scope.classIds)) return false;
  if (supplied('courseId') && !isInScope(body.courseId, scope.courseIds)) return false;
  if (supplied('studentId') && !isInScope(body.studentId, scope.studentIds)) return false;
  if (supplied('assessmentId') && !isInScope(body.assessmentId, scope.assessmentIds)) return false;
  if (supplied('classId') && supplied('courseId')) {
    const academicClass = await AcademicClass.findOne({ _id: body.classId, companyId }).select('courseIds').lean();
    if (!academicClass || !academicClass.courseIds.some((courseId) => courseId.toString() === String(body.courseId))) return false;
  }
  return true;
}

async function buildScope(userId: string, role: string, companyId: mongoose.Types.ObjectId): Promise<AcademicDepartmentScope> {
  const assignmentField = isDean(role) ? 'authorizedDeanUserIds' : 'authorizedHodUserIds';
  const departments = await AcademicDepartment.find({
    companyId,
    [assignmentField]: new mongoose.Types.ObjectId(userId),
  }).select('_id').lean();
  const departmentIds = departments.map((department) => department._id.toString());
  if (!departmentIds.length) return {
    departmentIds, courseIds: [], classIds: [], studentIds: [], teacherIds: [],
    guardianIds: [], personIds: [], assessmentIds: [],
  };
  const departmentFilter = { companyId, departmentId: { $in: departments.map((department) => department._id) } };
  const [courseIds, classIds] = await Promise.all([
    AcademicCourse.distinct('_id', departmentFilter),
    AcademicClass.distinct('_id', departmentFilter),
  ]);
  const [studentIds, teacherIds, assessmentIds] = await Promise.all([
    AcademicEnrollment.distinct('studentId', { companyId, classId: { $in: classIds } }),
    AcademicTeachingAssignment.distinct('teacherId', { companyId, classId: { $in: classIds } }),
    AcademicAssessment.distinct('_id', { companyId, classId: { $in: classIds } }),
  ]);
  const guardianIds = studentIds.length
    ? await AcademicGuardianLink.distinct('guardianId', { companyId, studentId: { $in: studentIds } })
    : [];
  return {
    departmentIds,
    courseIds: ids(courseIds),
    classIds: ids(classIds),
    studentIds: ids(studentIds),
    teacherIds: ids(teacherIds),
    guardianIds: ids(guardianIds),
    personIds: ids([...studentIds, ...teacherIds, ...guardianIds]),
    assessmentIds: ids(assessmentIds),
  };
}

export const requireAssignedAcademicDepartment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const role = req.user?.role ?? '';
  if (!isDean(role) && !isHod(role)) {
    next();
    return;
  }
  try {
    const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
    const scope = await buildScope(req.user!.userId, role, companyId);
    if (!scope.departmentIds.length) {
      res.status(403).json({ success: false, message: 'An assigned academic department is required.' });
      return;
    }
    req.academicDepartmentScope = scope;

    const resource = req.params.resource ?? req.path.split('/').filter(Boolean)[0];
    const isGenericMutation = req.path === `/${req.params.resource}/${req.params.id}` &&
      ['PATCH', 'DELETE'].includes(req.method);
    if (isGenericMutation) {
      if (req.method === 'PATCH' && (
        Object.prototype.hasOwnProperty.call(req.body ?? {}, 'authorizedDeanUserIds') ||
        Object.prototype.hasOwnProperty.call(req.body ?? {}, 'authorizedHodUserIds')
      )) {
        res.status(403).json({ success: false, message: 'Only trusted organization administrators may change department assignments.' });
        return;
      }
      if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({ success: false, message: 'Invalid academic record identifier.' });
        return;
      }
      const recordDepartments = await recordDepartmentIds(resource, new mongoose.Types.ObjectId(req.params.id), companyId);
      if (!recordDepartments.length || recordDepartments.some((id) => !scope.departmentIds.includes(id))) {
        res.status(404).json({ success: false, message: 'Academic record not found.' });
        return;
      }
      if (req.method === 'PATCH' && !await relationIsAllowed(resource, req.body ?? {}, companyId, scope)) {
        res.status(403).json({ success: false, message: 'The requested academic relationship is outside your department.' });
        return;
      }
    } else if (req.method !== 'GET') {
      if (resource === 'departments') {
        res.status(403).json({ success: false, message: 'Department creation is limited to trusted organization administrators.' });
        return;
      }
      if (resource === 'fees' && req.path.endsWith('/payments')) {
        const recordDepartments = await recordDepartmentIds('fees', new mongoose.Types.ObjectId(req.params.chargeId), companyId);
        if (!recordDepartments.length || recordDepartments.some((id) => !scope.departmentIds.includes(id))) {
          res.status(404).json({ success: false, message: 'Academic record not found.' });
          return;
        }
      } else if (!await relationIsAllowed(resource, req.body ?? {}, companyId, scope)) {
        res.status(403).json({ success: false, message: 'The requested academic relationship is outside your department.' });
        return;
      }
    }
    next();
  } catch (error) {
    console.error('[Academic] Department authorization check failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(503).json({ success: false, message: 'Unable to verify academic department access.' });
  }
};

export function isTrustedAcademicAssignmentActor(role: string): boolean {
  return isTrustedAssignmentActor(role);
}
