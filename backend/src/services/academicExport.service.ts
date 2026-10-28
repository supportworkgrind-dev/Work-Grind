import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import AcademicClass from '../models/AcademicClass';
import AcademicCourse from '../models/AcademicCourse';
import AcademicDepartment from '../models/AcademicDepartment';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import { AcademicImportModule } from '../models/AcademicImportJob';
import AcademicInvitation from '../models/AcademicInvitation';
import AcademicPerson from '../models/AcademicPerson';
import { displayStatus } from './academicInvitation.service';
import { moduleDefinition, spreadsheetSafe } from './academicImport.service';

export const MAX_EXPORT_ROWS = 50_000;
const ONBOARDING_COLUMN = 'onboardingStatus';

type ExportTable = { headers: string[]; rows: Array<Record<string, string>> };

function day(value?: Date | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function idOf(value: unknown): string {
  return value ? String(value) : '';
}

async function peopleTable(companyId: mongoose.Types.ObjectId, module: 'students' | 'teachers' | 'parents'): Promise<ExportTable> {
  const type = module === 'students' ? 'student' : module === 'teachers' ? 'teacher' : 'parent';
  const definition = moduleDefinition(module);
  const headers = [...definition.headers.filter((header) => header !== 'fullName'), ONBOARDING_COLUMN];
  const [people, departments, courses, invitations] = await Promise.all([
    AcademicPerson.find({ companyId, type }).sort({ lastName: 1, firstName: 1 }).limit(MAX_EXPORT_ROWS).lean(),
    AcademicDepartment.find({ companyId }).select('_id code').lean(),
    AcademicCourse.find({ companyId }).select('_id code').lean(),
    AcademicInvitation.find({ companyId }).select('personId status expiresAt').lean(),
  ]);
  const departmentCodes = new Map(departments.map((department) => [department._id.toString(), department.code]));
  const courseCodes = new Map(courses.map((course) => [course._id.toString(), course.code]));
  const invitationStatus = new Map(invitations.map((invitation) => [invitation.personId.toString(), displayStatus(invitation)]));
  const personIds = people.map((person) => person._id);

  const enrollmentByStudent = new Map<string, { classId: string; rollNumber?: string; status: string }>();
  const classes = new Map<string, { name: string; academicYear: string }>();
  const guardianByStudent = new Map<string, { guardianId: string; relationship: string }>();
  const studentByGuardian = new Map<string, { studentId: string; relationship: string }>();
  const linkedPeople = new Map<string, { externalId?: string; firstName: string; lastName: string; email?: string; phone?: string }>();

  if (module === 'students' && personIds.length) {
    const [enrollments, links] = await Promise.all([
      // The most recent active enrollment wins; older ones stay in the enrollments export.
      AcademicEnrollment.find({ companyId, studentId: { $in: personIds } }).sort({ status: 1, enrolledAt: -1 }).select('studentId classId rollNumber status').lean(),
      AcademicGuardianLink.find({ companyId, studentId: { $in: personIds } }).sort({ createdAt: 1 }).select('studentId guardianId relationship').lean(),
    ]);
    for (const enrollment of enrollments) {
      const key = enrollment.studentId.toString();
      const current = enrollmentByStudent.get(key);
      if (!current || (current.status !== 'active' && enrollment.status === 'active')) {
        enrollmentByStudent.set(key, { classId: enrollment.classId.toString(), rollNumber: enrollment.rollNumber, status: enrollment.status });
      }
    }
    for (const link of links) if (!guardianByStudent.has(link.studentId.toString())) guardianByStudent.set(link.studentId.toString(), { guardianId: link.guardianId.toString(), relationship: link.relationship });
    const classIds = [...new Set([...enrollmentByStudent.values()].map((enrollment) => enrollment.classId))];
    const guardianIds = [...new Set([...guardianByStudent.values()].map((link) => link.guardianId))];
    const [classRecords, guardians] = await Promise.all([
      classIds.length ? AcademicClass.find({ companyId, _id: { $in: classIds } }).select('_id name academicYear').lean() : [],
      guardianIds.length ? AcademicPerson.find({ companyId, _id: { $in: guardianIds } }).select('_id externalId firstName lastName email phone').lean() : [],
    ]);
    classRecords.forEach((record) => classes.set(record._id.toString(), { name: record.name, academicYear: record.academicYear }));
    guardians.forEach((guardian) => linkedPeople.set(guardian._id.toString(), guardian));
  }
  if (module === 'parents' && personIds.length) {
    const links = await AcademicGuardianLink.find({ companyId, guardianId: { $in: personIds } }).sort({ createdAt: 1 }).select('studentId guardianId relationship').lean();
    for (const link of links) if (!studentByGuardian.has(link.guardianId.toString())) studentByGuardian.set(link.guardianId.toString(), { studentId: link.studentId.toString(), relationship: link.relationship });
    const studentIds = [...new Set([...studentByGuardian.values()].map((link) => link.studentId))];
    const students = studentIds.length ? await AcademicPerson.find({ companyId, _id: { $in: studentIds } }).select('_id externalId firstName lastName').lean() : [];
    students.forEach((student) => linkedPeople.set(student._id.toString(), student));
  }

  const rows = people.map((person) => {
    const id = person._id.toString();
    const enrollment = enrollmentByStudent.get(id);
    const academicClass = enrollment ? classes.get(enrollment.classId) : undefined;
    const guardianLink = guardianByStudent.get(id);
    const guardian = guardianLink ? linkedPeople.get(guardianLink.guardianId) : undefined;
    const studentLink = studentByGuardian.get(id);
    const row: Record<string, string> = {
      externalId: person.externalId ?? '',
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email ?? '',
      phone: person.phone ?? '',
      dateOfBirth: day(person.dateOfBirth),
      admissionDate: day(person.startDate),
      joiningDate: day(person.startDate),
      className: academicClass?.name ?? '',
      section: '',
      academicYear: academicClass?.academicYear ?? '',
      classId: enrollment?.classId ?? '',
      rollNumber: enrollment?.rollNumber ?? '',
      departmentCode: departmentCodes.get(idOf(person.departmentId)) ?? '',
      courseCode: courseCodes.get(idOf(person.courseId)) ?? '',
      enrollmentStatus: enrollment?.status ?? '',
      status: person.status,
      address: person.address ?? '',
      guardianId: guardian?.externalId ?? '',
      guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : '',
      guardianEmail: guardian?.email ?? '',
      guardianPhone: guardian?.phone ?? '',
      guardianRelationship: guardianLink?.relationship ?? '',
      studentExternalId: studentLink ? linkedPeople.get(studentLink.studentId)?.externalId ?? '' : '',
      relationship: studentLink?.relationship ?? '',
      [ONBOARDING_COLUMN]: person.userId ? 'account_linked' : invitationStatus.get(id) ?? (person.email ? 'not_invited' : 'no_email'),
    };
    return Object.fromEntries(headers.map((header) => [header, row[header] ?? '']));
  });
  return { headers, rows };
}

async function simpleTable(companyId: mongoose.Types.ObjectId, module: 'departments' | 'courses' | 'classes'): Promise<ExportTable> {
  const departments = await AcademicDepartment.find({ companyId }).sort({ code: 1 }).limit(MAX_EXPORT_ROWS).lean();
  const departmentCodes = new Map(departments.map((department) => [department._id.toString(), department.code]));
  if (module === 'departments') {
    return { headers: ['code', 'name', 'description'], rows: departments.map((department) => ({ code: department.code, name: department.name, description: department.description ?? '' })) };
  }
  const courses = await AcademicCourse.find({ companyId }).sort({ code: 1 }).limit(MAX_EXPORT_ROWS).lean();
  if (module === 'courses') {
    return {
      headers: ['code', 'name', 'departmentCode', 'description', 'credits'],
      rows: courses.map((course) => ({ code: course.code, name: course.name, departmentCode: departmentCodes.get(course.departmentId.toString()) ?? '', description: course.description ?? '', credits: course.credits === undefined ? '' : String(course.credits) })),
    };
  }
  const courseCodes = new Map(courses.map((course) => [course._id.toString(), course.code]));
  const classes = await AcademicClass.find({ companyId }).sort({ academicYear: -1, name: 1 }).limit(MAX_EXPORT_ROWS).lean();
  return {
    headers: ['classId', 'name', 'academicYear', 'departmentCode', 'courseCodes'],
    rows: classes.map((academicClass) => ({
      classId: academicClass._id.toString(),
      name: academicClass.name,
      academicYear: academicClass.academicYear,
      departmentCode: departmentCodes.get(academicClass.departmentId.toString()) ?? '',
      courseCodes: academicClass.courseIds.map((id) => courseCodes.get(id.toString())).filter(Boolean).join(','),
    })),
  };
}

export async function exportAcademicRecords(
  companyId: mongoose.Types.ObjectId,
  module: AcademicImportModule,
  format: 'csv' | 'xlsx',
): Promise<{ buffer: Buffer; contentType: string; extension: string; rowCount: number }> {
  const definition = moduleDefinition(module);
  if (!definition.exportable) throw new Error('This module cannot be exported.');
  const table = module === 'students' || module === 'teachers' || module === 'parents'
    ? await peopleTable(companyId, module)
    : await simpleTable(companyId, module as 'departments' | 'courses' | 'classes');
  if (format === 'csv') {
    const cell = (value: string) => `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
    const lines = [table.headers.join(','), ...table.rows.map((row) => table.headers.map((header) => cell(row[header] ?? '')).join(','))];
    return { buffer: Buffer.from(`﻿${lines.join('\n')}\n`, 'utf8'), contentType: 'text/csv; charset=utf-8', extension: 'csv', rowCount: table.rows.length };
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(definition.label.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  worksheet.columns = table.headers.map((header) => ({ header, key: header, width: Math.max(14, header.length + 4) }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Values are stored as text cells, which spreadsheets never evaluate as formulas.
  for (const row of table.rows) worksheet.addRow(Object.fromEntries(table.headers.map((header) => [header, row[header] ?? ''])));
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', rowCount: table.rows.length };
}
