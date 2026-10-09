import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AuditLog from '../models/AuditLog';
import AcademicClass from '../models/AcademicClass';
import AcademicCourse from '../models/AcademicCourse';
import AcademicDepartment from '../models/AcademicDepartment';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicSchedule from '../models/AcademicSchedule';
import AcademicAssignment from '../models/AcademicAssignment';
import AcademicAttendance, { AttendanceStatus } from '../models/AcademicAttendance';
import AcademicAssessment, { AssessmentType } from '../models/AcademicAssessment';
import AcademicResult from '../models/AcademicResult';
import AcademicFeeCharge, { FeePaymentMethod } from '../models/AcademicFeeCharge';
import AcademicPerson, { AcademicPersonType } from '../models/AcademicPerson';
import { GuardianRelationshipType } from '../models/AcademicGuardianLink';
import User from '../models/User';

const PAGE_SIZE = 100;
const ACADEMIC_PERSON_TYPES: AcademicPersonType[] = ['student', 'teacher', 'parent'];
const GUARDIAN_RELATIONSHIPS: GuardianRelationshipType[] = ['parent', 'guardian', 'other'];
const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];
const ASSESSMENT_TYPES: AssessmentType[] = ['exam', 'quiz', 'test', 'project'];
const FEE_PAYMENT_METHODS: FeePaymentMethod[] = ['cash', 'bank_transfer', 'other'];

function getCompanyId(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function listOptions(req: AuthRequest): { skip: number; limit: number } {
  const pageValue = Number(req.query.page);
  const limitValue = Number(req.query.limit);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, PAGE_SIZE) : PAGE_SIZE;
  return { skip: (page - 1) * limit, limit };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function handleOperationError(res: Response, error: unknown, resource: string): void {
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ success: false, message: 'Invalid academic record.' });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    res.status(409).json({ success: false, message: `A ${resource} with that identifier already exists.` });
    return;
  }
  console.error(`[Academic] ${resource} operation failed.`, {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  res.status(500).json({ success: false, message: 'Unable to complete the academic record operation.' });
}

async function recordAcademicAudit(
  req: AuthRequest,
  resource: string,
  resourceId: mongoose.Types.ObjectId,
  details?: Record<string, string>
): Promise<void> {
  try {
    await AuditLog.create({
      companyId: getCompanyId(req),
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      action: 'create',
      resource: `academic.${resource}`,
      resourceId: resourceId.toString(),
      details,
    });
  } catch (error) {
    console.error('[Academic] Record created but audit log persistence failed.', {
      resource: `academic.${resource}`,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

export const listPeople = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const filter: { companyId: mongoose.Types.ObjectId; type?: AcademicPersonType } = { companyId: getCompanyId(req) };
  if (typeof req.query.type === 'string') {
    if (!ACADEMIC_PERSON_TYPES.includes(req.query.type as AcademicPersonType)) {
      res.status(400).json({ success: false, message: 'Invalid academic person type.' });
      return;
    }
    filter.type = req.query.type as AcademicPersonType;
  }
  try {
    const [people, total] = await Promise.all([
      AcademicPerson.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit).lean(),
      AcademicPerson.countDocuments(filter),
    ]);
    res.json({ success: true, people, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'people');
  }
};

export const createPerson = async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, firstName, lastName, email, externalId, userId } = req.body ?? {};
  if (
    !ACADEMIC_PERSON_TYPES.includes(type) ||
    !isNonEmptyString(firstName) ||
    !isNonEmptyString(lastName) ||
    (email !== undefined && typeof email !== 'string') ||
    (externalId !== undefined && typeof externalId !== 'string') ||
    (userId !== undefined && !isObjectId(userId))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid type, first name, and last name.' });
    return;
  }

  const companyId = getCompanyId(req);
  try {
    if (userId) {
      const linkedUser = await User.findOne({
        _id: userId,
        companyId,
        isActive: true,
        isVerified: true,
        isDeleted: { $ne: true },
      }).select('_id');
      if (!linkedUser) {
        res.status(400).json({ success: false, message: 'Linked account must be an active, verified member of this organization.' });
        return;
      }
    }

    const person = await AcademicPerson.create({
      companyId,
      type,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(email !== undefined ? { email: email.trim() } : {}),
      ...(externalId !== undefined ? { externalId: externalId.trim() } : {}),
      ...(userId ? { userId } : {}),
    });
    await recordAcademicAudit(req, 'person', person._id, { type: person.type });
    res.status(201).json({ success: true, person });
  } catch (error) {
    handleOperationError(res, error, 'person');
  }
};

export const listDepartments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [departments, total] = await Promise.all([
      AcademicDepartment.find({ companyId }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      AcademicDepartment.countDocuments({ companyId }),
    ]);
    res.json({ success: true, departments, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'departments');
  }
};

export const createDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, code, description } = req.body ?? {};
  if (!isNonEmptyString(name) || !isNonEmptyString(code) || (description !== undefined && typeof description !== 'string')) {
    res.status(400).json({ success: false, message: 'Department name and code are required.' });
    return;
  }
  try {
    const department = await AcademicDepartment.create({
      companyId: getCompanyId(req),
      name: name.trim(),
      code: code.trim(),
      ...(description !== undefined ? { description: description.trim() } : {}),
    });
    await recordAcademicAudit(req, 'department', department._id);
    res.status(201).json({ success: true, department });
  } catch (error) {
    handleOperationError(res, error, 'department');
  }
};

export const listCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [courses, total] = await Promise.all([
      AcademicCourse.find({ companyId }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      AcademicCourse.countDocuments({ companyId }),
    ]);
    res.json({ success: true, courses, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'courses');
  }
};

export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, code, departmentId, description, credits } = req.body ?? {};
  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(code) ||
    !isObjectId(departmentId) ||
    (description !== undefined && typeof description !== 'string') ||
    (credits !== undefined && (typeof credits !== 'number' || !Number.isFinite(credits) || credits < 0 || credits > 100))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid course name, code, and department.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const department = await AcademicDepartment.findOne({ _id: departmentId, companyId }).select('_id');
    if (!department) {
      res.status(400).json({ success: false, message: 'Department must belong to this organization.' });
      return;
    }
    const course = await AcademicCourse.create({
      companyId,
      departmentId,
      name: name.trim(),
      code: code.trim(),
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(credits !== undefined ? { credits } : {}),
    });
    await recordAcademicAudit(req, 'course', course._id);
    res.status(201).json({ success: true, course });
  } catch (error) {
    handleOperationError(res, error, 'course');
  }
};

export const listClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [classes, total] = await Promise.all([
      AcademicClass.find({ companyId }).sort({ academicYear: -1, name: 1 }).skip(skip).limit(limit).lean(),
      AcademicClass.countDocuments({ companyId }),
    ]);
    res.json({ success: true, classes, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'classes');
  }
};

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, academicYear, departmentId, courseIds = [] } = req.body ?? {};
  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(academicYear) ||
    !isObjectId(departmentId) ||
    !Array.isArray(courseIds) ||
    !courseIds.every(isObjectId) ||
    new Set(courseIds).size !== courseIds.length
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid class name, academic year, department, and course list.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const [department, courses] = await Promise.all([
      AcademicDepartment.findOne({ _id: departmentId, companyId }).select('_id'),
      courseIds.length
        ? AcademicCourse.find({ _id: { $in: courseIds }, companyId, departmentId }).select('_id')
        : Promise.resolve([]),
    ]);
    if (!department || courses.length !== courseIds.length) {
      res.status(400).json({ success: false, message: 'Class department and courses must belong to the same organization and department.' });
      return;
    }
    const academicClass = await AcademicClass.create({
      companyId,
      name: name.trim(),
      academicYear: academicYear.trim(),
      departmentId,
      courseIds,
    });
    await recordAcademicAudit(req, 'class', academicClass._id);
    res.status(201).json({ success: true, class: academicClass });
  } catch (error) {
    handleOperationError(res, error, 'class');
  }
};

export const listGuardianLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [links, total] = await Promise.all([
      AcademicGuardianLink.find({ companyId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AcademicGuardianLink.countDocuments({ companyId }),
    ]);
    res.json({ success: true, links, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'guardian relationships');
  }
};

export const createGuardianLink = async (req: AuthRequest, res: Response): Promise<void> => {
  const { studentId, guardianId, relationship } = req.body ?? {};
  if (!isObjectId(studentId) || !isObjectId(guardianId) || !GUARDIAN_RELATIONSHIPS.includes(relationship)) {
    res.status(400).json({ success: false, message: 'Provide valid student, guardian, and relationship details.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const [student, guardian] = await Promise.all([
      AcademicPerson.findOne({ _id: studentId, companyId, type: 'student', status: 'active' }).select('_id'),
      AcademicPerson.findOne({ _id: guardianId, companyId, type: 'parent', status: 'active' }).select('_id'),
    ]);
    if (!student || !guardian) {
      res.status(400).json({ success: false, message: 'Student and guardian records must be active members of this organization.' });
      return;
    }
    const link = await AcademicGuardianLink.create({ companyId, studentId, guardianId, relationship });
    await recordAcademicAudit(req, 'guardian_link', link._id, { relationship });
    res.status(201).json({ success: true, link });
  } catch (error) {
    handleOperationError(res, error, 'guardian relationship');
  }
};

export const listEnrollments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [enrollments, total] = await Promise.all([
      AcademicEnrollment.find({ companyId })
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'studentId', match: { companyId }, select: 'firstName lastName externalId type' })
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear departmentId' })
        .lean(),
      AcademicEnrollment.countDocuments({ companyId }),
    ]);
    res.json({ success: true, enrollments, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'enrollments');
  }
};

export const createEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { studentId, classId } = req.body ?? {};
  if (!isObjectId(studentId) || !isObjectId(classId)) {
    res.status(400).json({ success: false, message: 'Valid student and class records are required.' });
    return;
  }

  const companyId = getCompanyId(req);
  try {
    const [student, academicClass] = await Promise.all([
      AcademicPerson.findOne({ _id: studentId, companyId, type: 'student', status: 'active' }).select('_id'),
      AcademicClass.findOne({ _id: classId, companyId }).select('_id'),
    ]);
    if (!student || !academicClass) {
      res.status(400).json({ success: false, message: 'Student and class must both belong to this organization and be active.' });
      return;
    }

    const enrollment = await AcademicEnrollment.create({ companyId, studentId, classId });
    await recordAcademicAudit(req, 'enrollment', enrollment._id);
    res.status(201).json({ success: true, enrollment });
  } catch (error) {
    handleOperationError(res, error, 'enrollment');
  }
};

export const listSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [schedules, total] = await Promise.all([
      AcademicSchedule.find({ companyId }).sort({ dayOfWeek: 1, startTime: 1 }).skip(skip).limit(limit)
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
        .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
        .lean(),
      AcademicSchedule.countDocuments({ companyId }),
    ]);
    res.json({ success: true, schedules: schedules.filter((schedule) => schedule.classId), total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'schedules');
  }
};

export const createSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  const { classId, courseId, dayOfWeek, startTime, endTime, location, validFrom, validUntil } = req.body ?? {};
  if (
    !isObjectId(classId) ||
    (courseId !== undefined && !isObjectId(courseId)) ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 1 ||
    dayOfWeek > 7 ||
    typeof startTime !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
    typeof endTime !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
    startTime >= endTime ||
    (location !== undefined && typeof location !== 'string') ||
    (validFrom !== undefined && !Number.isFinite(Date.parse(validFrom))) ||
    (validUntil !== undefined && !Number.isFinite(Date.parse(validUntil))) ||
    (validFrom !== undefined && validUntil !== undefined && Date.parse(validFrom) > Date.parse(validUntil))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid class, weekday, time range, and optional date range.' });
    return;
  }

  const companyId = getCompanyId(req);
  try {
    const academicClass = await AcademicClass.findOne({ _id: classId, companyId }).select('courseIds');
    if (!academicClass || (courseId && !academicClass.courseIds.some((id) => id.toString() === courseId))) {
      res.status(400).json({ success: false, message: 'The class and optional course must belong to this organization.' });
      return;
    }
    const schedule = await AcademicSchedule.create({
      companyId,
      classId,
      ...(courseId ? { courseId } : {}),
      dayOfWeek,
      startTime,
      endTime,
      ...(location !== undefined ? { location: location.trim() } : {}),
      ...(validFrom ? { validFrom: new Date(validFrom) } : {}),
      ...(validUntil ? { validUntil: new Date(validUntil) } : {}),
    });
    await recordAcademicAudit(req, 'schedule', schedule._id);
    res.status(201).json({ success: true, schedule });
  } catch (error) {
    handleOperationError(res, error, 'schedule');
  }
};

export const listAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [assignments, total] = await Promise.all([
      AcademicAssignment.find({ companyId }).sort({ dueAt: 1, createdAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
        .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
        .lean(),
      AcademicAssignment.countDocuments({ companyId }),
    ]);
    res.json({ success: true, assignments: assignments.filter((assignment) => assignment.classId), total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'assignments');
  }
};

export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { classId, courseId, title, instructions, dueAt, pointsPossible } = req.body ?? {};
  if (
    !isObjectId(classId) ||
    (courseId !== undefined && !isObjectId(courseId)) ||
    !isNonEmptyString(title) ||
    title.trim().length > 180 ||
    (instructions !== undefined && (typeof instructions !== 'string' || instructions.length > 10000)) ||
    (dueAt !== undefined && !Number.isFinite(Date.parse(dueAt))) ||
    typeof pointsPossible !== 'number' ||
    !Number.isFinite(pointsPossible) ||
    pointsPossible < 0 ||
    pointsPossible > 100000
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid class, title, due date, and maximum points.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const academicClass = await AcademicClass.findOne({ _id: classId, companyId }).select('courseIds');
    if (!academicClass || (courseId && !academicClass.courseIds.some((id) => id.toString() === courseId))) {
      res.status(400).json({ success: false, message: 'The class and optional course must belong to this organization.' });
      return;
    }
    const assignment = await AcademicAssignment.create({
      companyId,
      classId,
      ...(courseId ? { courseId } : {}),
      createdBy: new mongoose.Types.ObjectId(req.user!.userId),
      title: title.trim(),
      ...(instructions !== undefined ? { instructions: instructions.trim() } : {}),
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      pointsPossible,
    });
    await recordAcademicAudit(req, 'assignment', assignment._id);
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    handleOperationError(res, error, 'assignment');
  }
};

export const listAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  const filter: { companyId: mongoose.Types.ObjectId; classId?: mongoose.Types.ObjectId } = { companyId };
  if (typeof req.query.classId === 'string') {
    if (!isObjectId(req.query.classId)) {
      res.status(400).json({ success: false, message: 'Invalid class identifier.' });
      return;
    }
    filter.classId = new mongoose.Types.ObjectId(req.query.classId);
  }
  try {
    const [attendance, total] = await Promise.all([
      AcademicAttendance.find(filter).sort({ date: -1 }).skip(skip).limit(limit)
        .populate({ path: 'studentId', match: { companyId, type: 'student' }, select: 'firstName lastName externalId' })
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
        .lean(),
      AcademicAttendance.countDocuments(filter),
    ]);
    res.json({ success: true, attendance: attendance.filter((entry) => entry.studentId && entry.classId), total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'attendance');
  }
};

export const recordAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { classId, studentId, date, status, note } = req.body ?? {};
  const parsedDate = typeof date === 'string' ? new Date(date) : new Date(NaN);
  if (
    !isObjectId(classId) ||
    !isObjectId(studentId) ||
    !Number.isFinite(parsedDate.getTime()) ||
    !ATTENDANCE_STATUSES.includes(status) ||
    (note !== undefined && (typeof note !== 'string' || note.length > 500))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid class, student, attendance date, and status.' });
    return;
  }
  const companyId = getCompanyId(req);
  parsedDate.setUTCHours(0, 0, 0, 0);
  try {
    const [academicClass, student, enrollment] = await Promise.all([
      AcademicClass.findOne({ _id: classId, companyId }).select('_id'),
      AcademicPerson.findOne({ _id: studentId, companyId, type: 'student', status: 'active' }).select('_id'),
      AcademicEnrollment.findOne({ companyId, classId, studentId, status: 'active' }).select('_id'),
    ]);
    if (!academicClass || !student || !enrollment) {
      res.status(400).json({ success: false, message: 'Attendance requires an active student enrollment in this organization and class.' });
      return;
    }
    const attendance = await AcademicAttendance.findOneAndUpdate(
      { companyId, classId, studentId, date: parsedDate },
      {
        $set: {
          status,
          recordedBy: new mongoose.Types.ObjectId(req.user!.userId),
          ...(note !== undefined ? { note: note.trim() } : { note: undefined }),
        },
        $setOnInsert: { companyId, classId, studentId, date: parsedDate },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await recordAcademicAudit(req, 'attendance', attendance._id, { status });
    res.status(200).json({ success: true, attendance });
  } catch (error) {
    handleOperationError(res, error, 'attendance');
  }
};

export const listAssessments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [assessments, total] = await Promise.all([
      AcademicAssessment.find({ companyId }).sort({ scheduledAt: 1, createdAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
        .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
        .lean(),
      AcademicAssessment.countDocuments({ companyId }),
    ]);
    res.json({ success: true, assessments: assessments.filter((assessment) => assessment.classId), total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'assessments');
  }
};

export const createAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { classId, courseId, title, type, scheduledAt, pointsPossible } = req.body ?? {};
  if (
    !isObjectId(classId) ||
    (courseId !== undefined && !isObjectId(courseId)) ||
    !isNonEmptyString(title) ||
    title.trim().length > 180 ||
    !ASSESSMENT_TYPES.includes(type) ||
    (scheduledAt !== undefined && !Number.isFinite(Date.parse(scheduledAt))) ||
    typeof pointsPossible !== 'number' ||
    !Number.isFinite(pointsPossible) ||
    pointsPossible < 0 ||
    pointsPossible > 100000
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid class, title, assessment type, and maximum points.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const academicClass = await AcademicClass.findOne({ _id: classId, companyId }).select('courseIds');
    if (!academicClass || (courseId && !academicClass.courseIds.some((id) => id.toString() === courseId))) {
      res.status(400).json({ success: false, message: 'The class and optional course must belong to this organization.' });
      return;
    }
    const assessment = await AcademicAssessment.create({
      companyId,
      classId,
      ...(courseId ? { courseId } : {}),
      createdBy: new mongoose.Types.ObjectId(req.user!.userId),
      title: title.trim(),
      type,
      ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      pointsPossible,
    });
    await recordAcademicAudit(req, 'assessment', assessment._id, { type });
    res.status(201).json({ success: true, assessment });
  } catch (error) {
    handleOperationError(res, error, 'assessment');
  }
};

export const listResults = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [results, total] = await Promise.all([
      AcademicResult.find({ companyId }).sort({ gradedAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'studentId', match: { companyId, type: 'student' }, select: 'firstName lastName externalId' })
        .populate({ path: 'assessmentId', match: { companyId }, select: 'title type pointsPossible classId' })
        .lean(),
      AcademicResult.countDocuments({ companyId }),
    ]);
    res.json({ success: true, results: results.filter((result) => result.studentId && result.assessmentId), total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'results');
  }
};

export const recordResult = async (req: AuthRequest, res: Response): Promise<void> => {
  const { assessmentId, studentId, pointsEarned, feedback } = req.body ?? {};
  if (
    !isObjectId(assessmentId) ||
    !isObjectId(studentId) ||
    typeof pointsEarned !== 'number' ||
    !Number.isFinite(pointsEarned) ||
    pointsEarned < 0 ||
    (feedback !== undefined && (typeof feedback !== 'string' || feedback.length > 2000))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid assessment, student, score, and optional feedback.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const [assessment, student] = await Promise.all([
      AcademicAssessment.findOne({ _id: assessmentId, companyId }).select('classId pointsPossible'),
      AcademicPerson.findOne({ _id: studentId, companyId, type: 'student', status: 'active' }).select('_id'),
    ]);
    if (!assessment || !student || pointsEarned > assessment.pointsPossible) {
      res.status(400).json({ success: false, message: 'The assessment, active student, and score must be valid for this organization.' });
      return;
    }
    const enrollment = await AcademicEnrollment.findOne({
      companyId,
      classId: assessment.classId,
      studentId,
      status: 'active',
    }).select('_id');
    if (!enrollment) {
      res.status(400).json({ success: false, message: 'The student must be actively enrolled in the assessment class.' });
      return;
    }
    const result = await AcademicResult.findOneAndUpdate(
      { companyId, assessmentId, studentId },
      {
        $set: {
          pointsEarned,
          gradedBy: new mongoose.Types.ObjectId(req.user!.userId),
          gradedAt: new Date(),
          ...(feedback !== undefined ? { feedback: feedback.trim() } : { feedback: undefined }),
        },
        $setOnInsert: { companyId, assessmentId, studentId },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await recordAcademicAudit(req, 'result', result._id);
    res.json({ success: true, result });
  } catch (error) {
    handleOperationError(res, error, 'result');
  }
};

export const listFeeCharges = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [charges, total] = await Promise.all([
      AcademicFeeCharge.find({ companyId }).sort({ dueAt: 1, createdAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'studentId', match: { companyId, type: 'student' }, select: 'firstName lastName externalId' })
        .lean(),
      AcademicFeeCharge.countDocuments({ companyId }),
    ]);
    res.json({ success: true, charges: charges.filter((charge) => charge.studentId), total, page: Math.floor(skip / limit) + 1, pageSize: limit });
  } catch (error) {
    handleOperationError(res, error, 'fee charges');
  }
};

export const createFeeCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  const { studentId, invoiceNumber, description, amountMinor, currency, dueAt } = req.body ?? {};
  if (
    !isObjectId(studentId) ||
    !isNonEmptyString(invoiceNumber) ||
    !/^[A-Za-z0-9-]{1,40}$/.test(invoiceNumber.trim()) ||
    !isNonEmptyString(description) ||
    description.trim().length > 180 ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > 100000000000 ||
    typeof currency !== 'string' ||
    !/^[A-Za-z]{3}$/.test(currency) ||
    (dueAt !== undefined && (typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt))))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid student, invoice number, description, amount in minor units, ISO 4217 currency, and optional due date.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const student = await AcademicPerson.findOne({ _id: studentId, companyId, type: 'student', status: 'active' }).select('_id');
    if (!student) {
      res.status(400).json({ success: false, message: 'Fee charges require an active student in this organization.' });
      return;
    }
    const charge = await AcademicFeeCharge.create({
      companyId,
      studentId,
      invoiceNumber: invoiceNumber.trim(),
      description: description.trim(),
      amountMinor,
      currency: currency.toUpperCase(),
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      createdBy: new mongoose.Types.ObjectId(req.user!.userId),
    });
    await recordAcademicAudit(req, 'fee_charge', charge._id, { currency: charge.currency });
    res.status(201).json({ success: true, charge });
  } catch (error) {
    handleOperationError(res, error, 'fee charge');
  }
};

export const recordFeePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { chargeId } = req.params;
  const { amountMinor, method, reference } = req.body ?? {};
  if (
    !isObjectId(chargeId) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    !FEE_PAYMENT_METHODS.includes(method) ||
    (reference !== undefined && (typeof reference !== 'string' || reference.length > 120))
  ) {
    res.status(400).json({ success: false, message: 'Provide a valid charge, positive payment amount in minor units, and payment method.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const updatedCharge = await AcademicFeeCharge.findOneAndUpdate(
      {
        _id: chargeId,
        companyId,
        isVoided: false,
        $expr: { $lte: [{ $add: ['$paidAmountMinor', amountMinor] }, '$amountMinor'] },
      },
      {
        $inc: { paidAmountMinor: amountMinor },
        $push: {
          payments: {
            amountMinor,
            method,
            ...(reference !== undefined ? { reference: reference.trim() } : {}),
            receivedAt: new Date(),
            recordedBy: new mongoose.Types.ObjectId(req.user!.userId),
          },
        },
      },
      { new: true, runValidators: true }
    );
    if (!updatedCharge) {
      const existingCharge = await AcademicFeeCharge.findOne({ _id: chargeId, companyId, isVoided: false }).select('_id');
      res.status(existingCharge ? 409 : 404).json({
        success: false,
        message: existingCharge ? 'Payment exceeds the outstanding fee balance.' : 'Fee charge not found.',
      });
      return;
    }
    await recordAcademicAudit(req, 'fee_payment', updatedCharge._id, { method, currency: updatedCharge.currency });
    res.json({ success: true, charge: updatedCharge });
  } catch (error) {
    handleOperationError(res, error, 'fee payment');
  }
};
