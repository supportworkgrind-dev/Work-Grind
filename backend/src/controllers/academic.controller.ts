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
import AcademicTeachingAssignment from '../models/AcademicTeachingAssignment';
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
  details?: Record<string, string>,
  action = 'create'
): Promise<void> {
  try {
    await AuditLog.create({
      companyId: getCompanyId(req),
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      action,
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

type AcademicUpdateFieldType = 'string' | 'number' | 'date' | 'id' | 'idArray' | 'status' | 'attendance' | 'assessment' | 'relationship';
type AcademicCrudResource =
  | 'people'
  | 'departments'
  | 'courses'
  | 'classes'
  | 'guardians'
  | 'enrollments'
  | 'teaching-assignments'
  | 'schedules'
  | 'assignments'
  | 'attendance'
  | 'assessments'
  | 'results'
  | 'fees';

type AcademicCrudDefinition = {
  auditName: string;
  fields: Record<string, AcademicUpdateFieldType>;
  update: (id: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId, values: Record<string, unknown>) => Promise<boolean>;
  remove: (id: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) => Promise<boolean>;
  canRemove?: (id: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) => Promise<boolean>;
};

function defineAcademicCrud<T extends mongoose.Document>(
  model: mongoose.Model<T>,
  auditName: string,
  fields: Record<string, AcademicUpdateFieldType>,
  canRemove?: AcademicCrudDefinition['canRemove']
): AcademicCrudDefinition {
  return {
    auditName,
    fields,
    update: async (id, companyId, values) => {
      const setValues: Record<string, unknown> = {};
      const unsetValues: Record<string, 1> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) unsetValues[key] = 1;
        else setValues[key] = value;
      }
      const updated = await model.findOneAndUpdate(
        { _id: id, companyId },
        {
          ...(Object.keys(setValues).length ? { $set: setValues } : {}),
          ...(Object.keys(unsetValues).length ? { $unset: unsetValues } : {}),
        },
        { new: true, runValidators: true }
      ).select('_id');
      return !!updated;
    },
    remove: async (id, companyId) => {
      const result = await model.deleteOne({ _id: id, companyId });
      return result.deletedCount === 1;
    },
    canRemove,
  };
}

const academicCrud: Record<AcademicCrudResource, AcademicCrudDefinition> = {
  people: defineAcademicCrud(AcademicPerson, 'person', {
    firstName: 'string', lastName: 'string', email: 'string', externalId: 'string', status: 'status',
  }, async (id, companyId) => {
    const person = await AcademicPerson.findOne({ _id: id, companyId }).select('type');
    if (!person) return false;
    const dependencyChecks: Promise<number>[] = [];
    if (person.type === 'student') {
      dependencyChecks.push(
        AcademicGuardianLink.countDocuments({ companyId, studentId: id }),
        AcademicEnrollment.countDocuments({ companyId, studentId: id }),
        AcademicAttendance.countDocuments({ companyId, studentId: id }),
        AcademicResult.countDocuments({ companyId, studentId: id }),
        AcademicFeeCharge.countDocuments({ companyId, studentId: id }),
      );
    } else if (person.type === 'teacher') {
      dependencyChecks.push(AcademicTeachingAssignment.countDocuments({ companyId, teacherId: id }));
    } else {
      dependencyChecks.push(AcademicGuardianLink.countDocuments({ companyId, guardianId: id }));
    }
    return (await Promise.all(dependencyChecks)).every((count) => count === 0);
  }),
  departments: defineAcademicCrud(AcademicDepartment, 'department', {
    name: 'string', code: 'string', description: 'string',
  }, async (id, companyId) => (
    await Promise.all([
      AcademicCourse.countDocuments({ companyId, departmentId: id }),
      AcademicClass.countDocuments({ companyId, departmentId: id }),
    ])
  ).every((count) => count === 0)),
  courses: defineAcademicCrud(AcademicCourse, 'course', {
    name: 'string', code: 'string', description: 'string', credits: 'number', departmentId: 'id',
  }, async (id, companyId) => (
    await Promise.all([
      AcademicClass.countDocuments({ companyId, courseIds: id }),
      AcademicSchedule.countDocuments({ companyId, courseId: id }),
      AcademicAssignment.countDocuments({ companyId, courseId: id }),
      AcademicAssessment.countDocuments({ companyId, courseId: id }),
    ])
  ).every((count) => count === 0)),
  classes: defineAcademicCrud(AcademicClass, 'class', {
    name: 'string', academicYear: 'string', departmentId: 'id', courseIds: 'idArray',
  }, async (id, companyId) => (
    await Promise.all([
      AcademicEnrollment.countDocuments({ companyId, classId: id }),
      AcademicTeachingAssignment.countDocuments({ companyId, classId: id }),
      AcademicSchedule.countDocuments({ companyId, classId: id }),
      AcademicAssignment.countDocuments({ companyId, classId: id }),
      AcademicAttendance.countDocuments({ companyId, classId: id }),
      AcademicAssessment.countDocuments({ companyId, classId: id }),
    ])
  ).every((count) => count === 0)),
  guardians: defineAcademicCrud(AcademicGuardianLink, 'guardian_link', {
    studentId: 'id', guardianId: 'id', relationship: 'relationship',
  }),
  enrollments: defineAcademicCrud(AcademicEnrollment, 'enrollment', {
    studentId: 'id', classId: 'id', status: 'status', enrolledAt: 'date', completedAt: 'date',
  }, async (id, companyId) => {
    const enrollment = await AcademicEnrollment.findOne({ _id: id, companyId }).select('studentId classId');
    if (!enrollment) return false;
    const [attendanceCount, resultCount] = await Promise.all([
      AcademicAttendance.countDocuments({ companyId, studentId: enrollment.studentId, classId: enrollment.classId }),
      AcademicResult.countDocuments({
        companyId,
        studentId: enrollment.studentId,
        assessmentId: { $in: await AcademicAssessment.find({ companyId, classId: enrollment.classId }).distinct('_id') },
      }),
    ]);
    return attendanceCount === 0 && resultCount === 0;
  }),
  'teaching-assignments': defineAcademicCrud(AcademicTeachingAssignment, 'teaching_assignment', {
    teacherId: 'id', classId: 'id',
  }),
  schedules: defineAcademicCrud(AcademicSchedule, 'schedule', {
    classId: 'id', courseId: 'id', dayOfWeek: 'number', startTime: 'string', endTime: 'string',
    location: 'string', validFrom: 'date', validUntil: 'date',
  }),
  assignments: defineAcademicCrud(AcademicAssignment, 'assignment', {
    classId: 'id', courseId: 'id', title: 'string', instructions: 'string', dueAt: 'date', pointsPossible: 'number',
  }),
  attendance: defineAcademicCrud(AcademicAttendance, 'attendance', {
    classId: 'id', studentId: 'id', date: 'date', status: 'attendance', note: 'string',
  }),
  assessments: defineAcademicCrud(AcademicAssessment, 'assessment', {
    classId: 'id', courseId: 'id', title: 'string', type: 'assessment', scheduledAt: 'date', pointsPossible: 'number',
  }, async (id, companyId) => (await AcademicResult.countDocuments({ companyId, assessmentId: id })) === 0),
  results: defineAcademicCrud(AcademicResult, 'result', {
    pointsEarned: 'number', feedback: 'string',
  }),
  fees: defineAcademicCrud(AcademicFeeCharge, 'fee_charge', {
    invoiceNumber: 'string', description: 'string', amountMinor: 'number', currency: 'string', dueAt: 'date',
  }),
};

function normalizeAcademicUpdate(
  fields: Record<string, AcademicUpdateFieldType>,
  input: unknown
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const entries = Object.entries(body);
  if (!entries.length || entries.some(([key]) => !Object.prototype.hasOwnProperty.call(fields, key))) return null;

  const values: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    switch (fields[key]) {
      case 'string':
        if (value === null && ['email', 'externalId', 'description', 'instructions', 'location', 'note', 'feedback'].includes(key)) {
          values[key] = undefined;
          break;
        }
        if (typeof value !== 'string') return null;
        values[key] = value.trim();
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        if (key === 'dayOfWeek' && !Number.isInteger(value)) return null;
        values[key] = value;
        break;
      case 'date':
        if (value === null && ['dueAt', 'validFrom', 'validUntil', 'completedAt', 'scheduledAt'].includes(key)) {
          values[key] = undefined;
          break;
        }
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
        values[key] = new Date(value);
        break;
      case 'id':
        if (!isObjectId(value)) return null;
        values[key] = new mongoose.Types.ObjectId(value);
        break;
      case 'idArray':
        if (!Array.isArray(value) || !value.every(isObjectId) || new Set(value).size !== value.length) return null;
        values[key] = value.map((id) => new mongoose.Types.ObjectId(id));
        break;
      case 'status':
        if (key === 'status' && !['active', 'inactive', 'completed', 'withdrawn'].includes(String(value))) return null;
        values[key] = value;
        break;
      case 'attendance':
        if (!ATTENDANCE_STATUSES.includes(value as AttendanceStatus)) return null;
        values[key] = value;
        break;
      case 'assessment':
        if (!ASSESSMENT_TYPES.includes(value as AssessmentType)) return null;
        values[key] = value;
        break;
      case 'relationship':
        if (!GUARDIAN_RELATIONSHIPS.includes(value as GuardianRelationshipType)) return null;
        values[key] = value;
        break;
    }
  }
  return values;
}

async function academicRelationsBelongToTenant(
  resource: AcademicCrudResource,
  values: Record<string, unknown>,
  companyId: mongoose.Types.ObjectId
): Promise<boolean> {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(values, key);
  if (resource === 'courses' && has('departmentId')) {
    const department = await AcademicDepartment.findOne({ _id: values.departmentId, companyId }).select('_id');
    if (!department) return false;
    return !await AcademicClass.findOne({
      companyId,
      courseIds: values._id,
      departmentId: { $ne: values.departmentId },
    }).select('_id');
  }
  if (resource === 'classes' && (has('departmentId') || has('courseIds'))) {
    const existingClass = await AcademicClass.findOne({ _id: values._id, companyId }).select('departmentId courseIds');
    const existingDepartmentId = has('departmentId') ? values.departmentId : existingClass?.departmentId;
    if (!existingDepartmentId || !await AcademicDepartment.findOne({ _id: existingDepartmentId, companyId }).select('_id')) return false;
    if (has('courseIds') || has('departmentId')) {
      const ids = has('courseIds') ? values.courseIds as mongoose.Types.ObjectId[] : existingClass?.courseIds ?? [];
      const courses = ids.length
        ? await AcademicCourse.find({ _id: { $in: ids }, companyId, departmentId: existingDepartmentId }).select('_id')
        : [];
      return courses.length === ids.length;
    }
    return true;
  }
  if (resource === 'schedules' || resource === 'assignments' || resource === 'assessments') {
    if (!has('classId') && !has('courseId')) return true;
    const currentRecord = await (
      resource === 'schedules' ? AcademicSchedule.findOne({ _id: values._id, companyId }).select('classId courseId')
        : resource === 'assignments' ? AcademicAssignment.findOne({ _id: values._id, companyId }).select('classId courseId')
          : AcademicAssessment.findOne({ _id: values._id, companyId }).select('classId courseId')
    );
    const classId = has('classId') ? values.classId : currentRecord?.classId;
    const courseId = has('courseId') ? values.courseId : currentRecord?.courseId;
    const academicClass = await AcademicClass.findOne({ _id: classId, companyId }).select('courseIds');
    if (!academicClass) return false;
    return !courseId || academicClass.courseIds.some((id) => id.toString() === String(courseId));
  }
  if (resource === 'guardians') {
    if (!has('studentId') && !has('guardianId')) return true;
    const currentLink = await AcademicGuardianLink.findOne({ _id: values._id, companyId }).select('studentId guardianId');
    const [student, guardian] = await Promise.all([
      AcademicPerson.findOne({ _id: has('studentId') ? values.studentId : currentLink?.studentId, companyId, type: 'student', status: 'active' }).select('_id'),
      AcademicPerson.findOne({ _id: has('guardianId') ? values.guardianId : currentLink?.guardianId, companyId, type: 'parent', status: 'active' }).select('_id'),
    ]);
    return !!student && !!guardian;
  }
  if (resource === 'enrollments') {
    if (!has('studentId') && !has('classId')) return true;
    const enrollment = await AcademicEnrollment.findOne({ _id: values._id, companyId }).select('studentId classId');
    const [student, academicClass] = await Promise.all([
      AcademicPerson.findOne({ _id: has('studentId') ? values.studentId : enrollment?.studentId, companyId, type: 'student', status: 'active' }).select('_id'),
      AcademicClass.findOne({ _id: has('classId') ? values.classId : enrollment?.classId, companyId }).select('_id'),
    ]);
    return !!student && !!academicClass;
  }
  if (resource === 'teaching-assignments') {
    const assignment = await AcademicTeachingAssignment.findOne({ _id: values._id, companyId }).select('teacherId classId');
    const [teacher, academicClass] = await Promise.all([
      AcademicPerson.findOne({ _id: has('teacherId') ? values.teacherId : assignment?.teacherId, companyId, type: 'teacher', status: 'active' }).select('_id'),
      AcademicClass.findOne({ _id: has('classId') ? values.classId : assignment?.classId, companyId }).select('_id'),
    ]);
    return !!teacher && !!academicClass;
  }
  if (resource === 'attendance') {
    if (!has('studentId') && !has('classId')) return true;
    const attendance = await AcademicAttendance.findOne({ _id: values._id, companyId }).select('studentId classId');
    const studentId = has('studentId') ? values.studentId : attendance?.studentId;
    const classId = has('classId') ? values.classId : attendance?.classId;
    const [student, academicClass] = await Promise.all([
      AcademicPerson.findOne({ _id: studentId, companyId, type: 'student', status: 'active' }).select('_id'),
      AcademicClass.findOne({ _id: classId, companyId }).select('_id'),
    ]);
    if (!student || !academicClass) return false;
    return !!await AcademicEnrollment.findOne({ companyId, studentId, classId, status: 'active' }).select('_id');
  }
  return true;
}

export const updateAcademicRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  const resource = req.params.resource as AcademicCrudResource;
  const definition = Object.prototype.hasOwnProperty.call(academicCrud, resource) ? academicCrud[resource] : undefined;
  const { id } = req.params;
  if (!definition || !isObjectId(id)) {
    res.status(400).json({ success: false, message: 'Invalid academic resource or record identifier.' });
    return;
  }
  const values = normalizeAcademicUpdate(definition.fields, req.body);
  if (!values) {
    res.status(400).json({ success: false, message: 'Provide valid editable fields for this academic record.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    values._id = new mongoose.Types.ObjectId(id);
    if (!await academicRelationsBelongToTenant(resource, values, companyId)) {
      res.status(400).json({ success: false, message: 'Related academic records must belong to this organization.' });
      return;
    }
    if (resource === 'schedules') {
      const schedule = await AcademicSchedule.findOne({ _id: id, companyId }).select('startTime endTime validFrom validUntil');
      if (!schedule) {
        res.status(404).json({ success: false, message: 'Academic record not found.' });
        return;
      }
      const startTime = String(values.startTime ?? schedule.startTime);
      const endTime = String(values.endTime ?? schedule.endTime);
      const validFrom = Object.prototype.hasOwnProperty.call(values, 'validFrom') ? values.validFrom : schedule.validFrom;
      const validUntil = Object.prototype.hasOwnProperty.call(values, 'validUntil') ? values.validUntil : schedule.validUntil;
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
        startTime >= endTime ||
        (validFrom instanceof Date && validUntil instanceof Date && validFrom > validUntil)
      ) {
        res.status(400).json({ success: false, message: 'Timetable sessions require a valid time range and date range.' });
        return;
      }
    }
    if (resource === 'fees' && typeof values.amountMinor === 'number') {
      const charge = await AcademicFeeCharge.findOne({ _id: id, companyId }).select('paidAmountMinor');
      if (!charge) {
        res.status(404).json({ success: false, message: 'Academic record not found.' });
        return;
      }
      if (!Number.isSafeInteger(values.amountMinor) || values.amountMinor < charge.paidAmountMinor) {
        res.status(400).json({ success: false, message: 'Fee amount must be an integer and cannot be less than its recorded payments.' });
        return;
      }
    }
    if (resource === 'results' && typeof values.pointsEarned === 'number') {
      const result = await AcademicResult.findOne({ _id: id, companyId }).select('assessmentId');
      const assessment = result
        ? await AcademicAssessment.findOne({ _id: result.assessmentId, companyId }).select('pointsPossible')
        : null;
      if (!assessment) {
        res.status(404).json({ success: false, message: 'Academic record not found.' });
        return;
      }
      if (values.pointsEarned > assessment.pointsPossible) {
        res.status(400).json({ success: false, message: 'Points earned cannot exceed the assessment maximum.' });
        return;
      }
    }
    if (resource === 'assessments' && typeof values.pointsPossible === 'number') {
      const hasOverMaximumResult = await AcademicResult.exists({
        companyId,
        assessmentId: id,
        pointsEarned: { $gt: values.pointsPossible },
      });
      if (hasOverMaximumResult) {
        res.status(409).json({ success: false, message: 'The maximum cannot be lower than a score already recorded for this assessment.' });
        return;
      }
    }
    if (resource === 'assessments' && values.classId) {
      const hasExistingResults = await AcademicResult.exists({ companyId, assessmentId: id });
      if (hasExistingResults) {
        const currentAssessment = await AcademicAssessment.findOne({ _id: id, companyId }).select('classId');
        if (currentAssessment && currentAssessment.classId.toString() !== String(values.classId)) {
          res.status(409).json({ success: false, message: 'An assessment with recorded results cannot be moved to another class.' });
          return;
        }
      }
    }
    delete values._id;
    if (!await definition.update(new mongoose.Types.ObjectId(id), companyId, values)) {
      res.status(404).json({ success: false, message: 'Academic record not found.' });
      return;
    }
    await recordAcademicAudit(req, definition.auditName, new mongoose.Types.ObjectId(id), undefined, 'update');
    res.json({ success: true, message: 'Academic record updated.' });
  } catch (error) {
    handleOperationError(res, error, definition.auditName);
  }
};

export const deleteAcademicRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  const resource = req.params.resource as AcademicCrudResource;
  const definition = Object.prototype.hasOwnProperty.call(academicCrud, resource) ? academicCrud[resource] : undefined;
  const { id } = req.params;
  if (!definition || !isObjectId(id)) {
    res.status(400).json({ success: false, message: 'Invalid academic resource or record identifier.' });
    return;
  }
  const companyId = getCompanyId(req);
  const recordId = new mongoose.Types.ObjectId(id);
  try {
    if (resource === 'people') {
      const person = await AcademicPerson.findOneAndUpdate(
        { _id: recordId, companyId },
        { $set: { status: 'inactive' } },
        { new: true, runValidators: true }
      ).select('_id');
      if (!person) {
        res.status(404).json({ success: false, message: 'Academic record not found.' });
        return;
      }
    } else if (resource === 'fees') {
      const charge = await AcademicFeeCharge.findOneAndUpdate(
        { _id: recordId, companyId, paidAmountMinor: 0, isVoided: false },
        { $set: { isVoided: true } },
        { new: true, runValidators: true }
      ).select('_id');
      if (!charge) {
        const existingCharge = await AcademicFeeCharge.findOne({ _id: recordId, companyId }).select('isVoided');
        res.status(existingCharge ? 409 : 404).json({
          success: false,
          message: existingCharge ? 'Only unpaid fee charges can be voided or deleted.' : 'Academic record not found.',
        });
        return;
      }
    } else {
      if (definition.canRemove && !await definition.canRemove(recordId, companyId)) {
        res.status(409).json({ success: false, message: 'This record is still referenced by other academic records.' });
        return;
      }
      if (!await definition.remove(recordId, companyId)) {
        res.status(404).json({ success: false, message: 'Academic record not found.' });
        return;
      }
    }
    await recordAcademicAudit(req, definition.auditName, recordId, undefined, 'delete');
    res.json({ success: true, message: 'Academic record deleted.' });
  } catch (error) {
    handleOperationError(res, error, definition.auditName);
  }
};

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
      AcademicCourse.find({ companyId }).sort({ name: 1 }).skip(skip).limit(limit)
        .populate({ path: 'departmentId', match: { companyId }, select: 'name code' })
        .lean(),
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
      AcademicClass.find({ companyId }).sort({ academicYear: -1, name: 1 }).skip(skip).limit(limit)
        .populate({ path: 'departmentId', match: { companyId }, select: 'name code' })
        .populate({ path: 'courseIds', match: { companyId }, select: 'name code' })
        .lean(),
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

export const listTeachingAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  try {
    const [teachingAssignments, total] = await Promise.all([
      AcademicTeachingAssignment.find({ companyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'teacherId', match: { companyId, type: 'teacher' }, select: 'firstName lastName' })
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
        .lean(),
      AcademicTeachingAssignment.countDocuments({ companyId }),
    ]);
    res.json({
      success: true,
      teachingAssignments: teachingAssignments.filter((assignment) => assignment.teacherId && assignment.classId),
      total,
      page: Math.floor(skip / limit) + 1,
      pageSize: limit,
    });
  } catch (error) {
    handleOperationError(res, error, 'teaching assignments');
  }
};

export const createTeachingAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { teacherId, classId } = req.body ?? {};
  if (!isObjectId(teacherId) || !isObjectId(classId)) {
    res.status(400).json({ success: false, message: 'Valid teacher and class records are required.' });
    return;
  }
  const companyId = getCompanyId(req);
  try {
    const [teacher, academicClass] = await Promise.all([
      AcademicPerson.findOne({ _id: teacherId, companyId, type: 'teacher', status: 'active' }).select('_id'),
      AcademicClass.findOne({ _id: classId, companyId }).select('_id'),
    ]);
    if (!teacher || !academicClass) {
      res.status(400).json({ success: false, message: 'Teacher and class must both belong to this organization and be active.' });
      return;
    }

    const teachingAssignment = await AcademicTeachingAssignment.create({
      companyId,
      teacherId,
      classId,
      createdBy: new mongoose.Types.ObjectId(req.user!.userId),
    });
    await recordAcademicAudit(req, 'teaching_assignment', teachingAssignment._id);
    res.status(201).json({ success: true, teachingAssignment });
  } catch (error) {
    handleOperationError(res, error, 'teaching assignment');
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
