import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AcademicClass from '../models/AcademicClass';
import AcademicCourse from '../models/AcademicCourse';
import AcademicDepartment from '../models/AcademicDepartment';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import AcademicPerson, { AcademicPersonType, GuardianRelationshipType } from '../models/AcademicPerson';
import User from '../models/User';

const PAGE_SIZE = 100;
const ACADEMIC_PERSON_TYPES: AcademicPersonType[] = ['student', 'teacher', 'parent'];
const GUARDIAN_RELATIONSHIPS: GuardianRelationshipType[] = ['parent', 'guardian', 'other'];

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

function handleCreateError(res: Response, error: unknown, resource: string): void {
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
  const [people, total] = await Promise.all([
    AcademicPerson.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit).lean(),
    AcademicPerson.countDocuments(filter),
  ]);
  res.json({ success: true, people, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
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
    res.status(201).json({ success: true, person });
  } catch (error) {
    handleCreateError(res, error, 'person');
  }
};

export const listDepartments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  const [departments, total] = await Promise.all([
    AcademicDepartment.find({ companyId }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    AcademicDepartment.countDocuments({ companyId }),
  ]);
  res.json({ success: true, departments, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
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
    res.status(201).json({ success: true, department });
  } catch (error) {
    handleCreateError(res, error, 'department');
  }
};

export const listCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  const [courses, total] = await Promise.all([
    AcademicCourse.find({ companyId }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    AcademicCourse.countDocuments({ companyId }),
  ]);
  res.json({ success: true, courses, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
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
    res.status(201).json({ success: true, course });
  } catch (error) {
    handleCreateError(res, error, 'course');
  }
};

export const listClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  const [classes, total] = await Promise.all([
    AcademicClass.find({ companyId }).sort({ academicYear: -1, name: 1 }).skip(skip).limit(limit).lean(),
    AcademicClass.countDocuments({ companyId }),
  ]);
  res.json({ success: true, classes, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
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
    res.status(201).json({ success: true, class: academicClass });
  } catch (error) {
    handleCreateError(res, error, 'class');
  }
};

export const listGuardianLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  const { skip, limit } = listOptions(req);
  const companyId = getCompanyId(req);
  const [links, total] = await Promise.all([
    AcademicGuardianLink.find({ companyId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AcademicGuardianLink.countDocuments({ companyId }),
  ]);
  res.json({ success: true, links, total, page: Math.floor(skip / limit) + 1, pageSize: limit });
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
    res.status(201).json({ success: true, link });
  } catch (error) {
    handleCreateError(res, error, 'guardian relationship');
  }
};
