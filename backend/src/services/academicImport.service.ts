import crypto from 'crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import AcademicAssessment from '../models/AcademicAssessment';
import AcademicAttendance from '../models/AcademicAttendance';
import AcademicClass from '../models/AcademicClass';
import AcademicCourse from '../models/AcademicCourse';
import AcademicDepartment from '../models/AcademicDepartment';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicFeeCharge from '../models/AcademicFeeCharge';
import AcademicGuardianLink, { GuardianRelationshipType } from '../models/AcademicGuardianLink';
import AcademicImportJob, {
  AcademicImportIssue,
  AcademicImportMode,
  AcademicImportModule,
} from '../models/AcademicImportJob';
import AcademicPerson, { AcademicPersonType } from '../models/AcademicPerson';
import AcademicResult from '../models/AcademicResult';
import AcademicSchedule from '../models/AcademicSchedule';
import AcademicTeachingAssignment from '../models/AcademicTeachingAssignment';
import AuditLog from '../models/AuditLog';
import { checkMemberLimit, withCompanyCapacityLock } from '../utils/planLimits';
import {
  AcademicIdentifierSettings,
  generatePersonExternalId,
  generateRollNumber,
  getIdentifierSettings,
  refreshImportLock,
} from './academicIdentifiers';

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_STORED_ISSUES = 5_000;
const PREVIEW_ROWS = 25;

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  help: string;
  example?: string;
  values?: string[];
};

export type ImportModuleDefinition = {
  id: AcademicImportModule;
  label: string;
  description: string;
  headers: string[];
  required: string[];
  requirementNote?: string;
  fields: ImportField[];
  exportable: boolean;
  invitable: boolean;
};

const NAME_FIELDS: ImportField[] = [
  { key: 'fullName', label: 'Full name', aliases: ['name'], help: 'Used when firstName and lastName are blank; the last word becomes the last name.', example: 'Ayesha Khan' },
  { key: 'firstName', label: 'First name', required: true, aliases: ['givenName', 'first'], help: 'Required unless fullName is provided.', example: 'Ayesha' },
  { key: 'lastName', label: 'Last name', required: true, aliases: ['surname', 'familyName', 'last'], help: 'Required unless fullName is provided.', example: 'Khan' },
];
const CONTACT_FIELDS: ImportField[] = [
  { key: 'email', label: 'Email', aliases: ['emailAddress', 'mail'], help: 'Optional. Must be unique for this record type; used for onboarding invitations.', example: 'ayesha.khan@example.edu' },
  { key: 'phone', label: 'Phone', aliases: ['mobile', 'phoneNumber', 'mobileNumber', 'contactNumber', 'contact'], help: 'Digits with an optional leading + plus spaces or dashes.', example: '+92 300 1234567' },
];
const STATUS_FIELD: ImportField = { key: 'status', label: 'Record status', help: 'active or inactive. Defaults to active for new records.', example: 'active', values: ['active', 'inactive'] };
const ADDRESS_FIELD: ImportField = { key: 'address', label: 'Address', aliases: ['homeAddress', 'residentialAddress'], help: 'Up to 500 characters.', example: '12 Garden Road, Lahore' };
const DATE_OF_BIRTH_FIELD: ImportField = { key: 'dateOfBirth', label: 'Date of birth', aliases: ['dob', 'birthDate', 'birthday'], help: 'YYYY-MM-DD.', example: '2012-04-23' };
const DEPARTMENT_FIELD: ImportField = { key: 'departmentCode', label: 'Department code', aliases: ['department', 'dept', 'faculty'], help: 'Existing department code.', example: 'SCI' };

const STUDENT_FIELDS: ImportField[] = [
  { key: 'externalId', label: 'Student ID', aliases: ['studentId', 'studentNumber', 'admissionNumber', 'admissionNo', 'registrationNumber', 'regNo'], help: 'Permanent institution student ID. Leave blank and WorkGrind generates one (for example STU-000123).', example: 'STU-000123' },
  { ...NAME_FIELDS[0], aliases: ['name', 'studentName'] },
  NAME_FIELDS[1],
  NAME_FIELDS[2],
  { ...CONTACT_FIELDS[0], aliases: ['emailAddress', 'mail', 'studentEmail'], help: 'Optional. Must be unique among students; invitations are sent here.' },
  CONTACT_FIELDS[1],
  DATE_OF_BIRTH_FIELD,
  { key: 'admissionDate', label: 'Admission / enrollment date', aliases: ['enrollmentDate', 'enrolmentDate', 'admittedOn', 'joiningDate', 'startDate'], help: 'YYYY-MM-DD. Also used as the class enrollment date.', example: '2026-04-01' },
  { key: 'className', label: 'Class', aliases: ['class', 'grade', 'gradeLevel'], help: 'Name of an existing class, e.g. "Grade 7". Combined with section to find the class.', example: 'Grade 7' },
  { key: 'section', label: 'Section', aliases: ['sec', 'division'], help: 'Optional. Grade 7 + A matches a class named "Grade 7 A", "Grade 7-A" or "Grade 7A".', example: 'A' },
  { key: 'academicYear', label: 'Academic year', aliases: ['session', 'year', 'academicSession'], help: 'Academic year of the class. Needed when the class name exists in several years.', example: '2026-2027' },
  { key: 'classId', label: 'WorkGrind class ID', help: 'Alternative to className, section and academicYear.' },
  { key: 'rollNumber', label: 'Roll number', aliases: ['roll', 'rollNo', 'rollNum'], help: 'Needs a class; unique within that class. Leave blank to generate one when the roll number format is "Sequential per class".', example: '07' },
  { ...DEPARTMENT_FIELD, help: 'Existing department code. Must match the class department when both are given.' },
  { key: 'courseCode', label: 'Course / programme code', aliases: ['course', 'program', 'programme', 'programCode'], help: 'Existing course code. Must belong to the department and the class when given.', example: 'BIO-101' },
  { key: 'enrollmentStatus', label: 'Enrollment status', aliases: ['enrolmentStatus'], help: 'active, completed or withdrawn. Needs a class; defaults to active.', example: 'active', values: ['active', 'completed', 'withdrawn'] },
  { ...STATUS_FIELD, aliases: ['studentStatus'] },
  ADDRESS_FIELD,
  { key: 'guardianId', label: 'Guardian ID', aliases: ['parentId', 'guardianExternalId'], help: 'Existing or new guardian ID. Leave blank to match by guardian email or phone, or to generate one.', example: 'GRD-000045' },
  { key: 'guardianName', label: 'Guardian name', aliases: ['parentName', 'guardianFullName'], help: 'First and last name. Required when the guardian is new.', example: 'Imran Khan' },
  { key: 'guardianEmail', label: 'Guardian email', aliases: ['parentEmail'], help: 'Matches an existing guardian; otherwise saved on the new guardian.', example: 'imran.khan@example.com' },
  { key: 'guardianPhone', label: 'Guardian phone', aliases: ['parentPhone', 'guardianMobile', 'parentMobile'], help: 'Matches an existing guardian when no ID or email matches.', example: '+92 300 7654321' },
  { key: 'guardianRelationship', label: 'Guardian relationship', aliases: ['relationship', 'relation'], help: 'parent, guardian or other (mother and father count as parent). Defaults to parent.', example: 'parent', values: ['parent', 'guardian', 'other'] },
];

const TEACHER_FIELDS: ImportField[] = [
  { key: 'externalId', label: 'Teacher / staff ID', aliases: ['teacherId', 'staffId', 'employeeId', 'employeeNumber'], help: 'Permanent staff ID. Leave blank and WorkGrind generates one (for example TCH-000012).', example: 'TCH-000012' },
  { ...NAME_FIELDS[0], aliases: ['name', 'teacherName'] },
  NAME_FIELDS[1],
  NAME_FIELDS[2],
  CONTACT_FIELDS[0],
  CONTACT_FIELDS[1],
  DATE_OF_BIRTH_FIELD,
  { key: 'joiningDate', label: 'Joining date', aliases: ['startDate', 'hireDate', 'dateOfJoining'], help: 'YYYY-MM-DD.', example: '2024-08-15' },
  DEPARTMENT_FIELD,
  { ...STATUS_FIELD, aliases: ['teacherStatus'] },
  ADDRESS_FIELD,
];

const PARENT_FIELDS: ImportField[] = [
  { key: 'externalId', label: 'Guardian ID', aliases: ['guardianId', 'parentId'], help: 'Permanent guardian ID. Leave blank and WorkGrind generates one (for example GRD-000045).', example: 'GRD-000045' },
  { ...NAME_FIELDS[0], aliases: ['name', 'guardianName', 'parentName'] },
  NAME_FIELDS[1],
  NAME_FIELDS[2],
  CONTACT_FIELDS[0],
  CONTACT_FIELDS[1],
  ADDRESS_FIELD,
  STATUS_FIELD,
  { key: 'studentExternalId', label: 'Student ID to link', aliases: ['studentId'], help: 'Optional. Links this guardian to an existing student.', example: 'STU-000123' },
  { key: 'relationship', label: 'Relationship', aliases: ['guardianRelationship', 'relation'], help: 'parent, guardian or other. Defaults to parent when a student is linked.', example: 'parent', values: ['parent', 'guardian', 'other'] },
];

function simpleModule(
  id: AcademicImportModule,
  label: string,
  description: string,
  headers: string[],
  required: string[],
  help: Record<string, string> = {},
  exportable = false,
): ImportModuleDefinition {
  return {
    id, label, description, headers, required, exportable, invitable: false,
    fields: headers.map((key) => ({ key, label: key, required: required.includes(key), help: help[key] ?? (required.includes(key) ? 'Required.' : 'Optional.') })),
  };
}

function peopleModule(id: AcademicImportModule, label: string, description: string, fields: ImportField[]): ImportModuleDefinition {
  return {
    id, label, description, fields,
    headers: fields.map((field) => field.key),
    required: ['firstName', 'lastName'],
    requirementNote: 'Provide firstName and lastName, or fullName. IDs left blank are generated automatically.',
    exportable: true,
    invitable: true,
  };
}

export const IMPORT_MODULES: ImportModuleDefinition[] = [
  peopleModule('students', 'Students and admissions', 'Complete student profiles with class placement, roll numbers and guardians.', STUDENT_FIELDS),
  peopleModule('teachers', 'Teachers and staff', 'Teacher and staff profiles keyed by their staff ID.', TEACHER_FIELDS),
  peopleModule('parents', 'Parents and guardians', 'Guardian profiles, optionally linked to existing students.', PARENT_FIELDS),
  simpleModule('departments', 'Departments / faculties', 'Departments keyed by code.', ['code', 'name', 'description'], ['code', 'name'], {}, true),
  simpleModule('courses', 'Courses and subjects', 'Courses keyed by code and linked to departmentCode.', ['code', 'name', 'departmentCode', 'description', 'credits'], ['code', 'name', 'departmentCode'], { credits: 'Optional number from 0 to 100.' }, true),
  simpleModule('classes', 'Classes and sections', 'Classes keyed by name and academicYear.', ['name', 'academicYear', 'departmentCode', 'courseCodes'], ['name', 'academicYear', 'departmentCode'], { courseCodes: 'Optional comma-separated course codes.' }, true),
  simpleModule('enrollments', 'Student enrollments', 'Enroll active students into tenant-owned classes.', ['studentExternalId', 'classId', 'status', 'enrolledAt', 'rollNumber'], ['studentExternalId', 'classId'], { status: 'active, completed or withdrawn.', rollNumber: 'Optional; unique within the class.' }),
  simpleModule('guardians', 'Parent / guardian links', 'Explicit links using studentExternalId and guardianExternalId.', ['studentExternalId', 'guardianExternalId', 'relationship'], ['studentExternalId', 'guardianExternalId', 'relationship']),
  simpleModule('teaching_assignments', 'Teaching assignments', 'Assign teachers to tenant-owned classes.', ['teacherExternalId', 'classId'], ['teacherExternalId', 'classId']),
  simpleModule('timetables', 'Timetables', 'Recurring class sessions using classId and optional courseCode.', ['classId', 'courseCode', 'dayOfWeek', 'startTime', 'endTime', 'location', 'validFrom', 'validUntil'], ['classId', 'dayOfWeek', 'startTime', 'endTime']),
  simpleModule('attendance', 'Attendance', 'Attendance for active class enrollments.', ['classId', 'studentExternalId', 'date', 'status', 'note'], ['classId', 'studentExternalId', 'date', 'status']),
  simpleModule('assessments', 'Examinations and assessments', 'Assessments keyed by classId, title, and type.', ['classId', 'courseCode', 'title', 'type', 'scheduledAt', 'pointsPossible'], ['classId', 'title', 'type', 'pointsPossible']),
  simpleModule('results', 'Examination results', 'Results keyed by assessmentId and studentExternalId.', ['assessmentId', 'studentExternalId', 'pointsEarned', 'feedback'], ['assessmentId', 'studentExternalId', 'pointsEarned']),
  simpleModule('fees', 'Fee charges / challans', 'Offline fee charges keyed by invoiceNumber.', ['invoiceNumber', 'studentExternalId', 'description', 'amountMinor', 'currency', 'dueAt'], ['invoiceNumber', 'studentExternalId', 'description', 'amountMinor', 'currency']),
];

type RawRow = { rowNumber: number; values: Record<string, string> };
type ParsedFile = { sheets: string[]; headers: string[]; headerLabels: string[]; rows: RawRow[] };
export type ImportMapping = Record<string, string | null>;
export type ImportRowAction = 'create' | 'update' | 'skip' | 'error';

export type ImportPreview = {
  sheets: string[];
  worksheet?: string;
  headers: string[];
  headerLabels: string[];
  fields: ImportField[];
  mapping: ImportMapping;
  unmappedHeaders: string[];
  totalRows: number;
  previewRows: Array<{ rowNumber: number; action: ImportRowAction; values: Record<string, string>; generated: string[] }>;
  issues: AcademicImportIssue[];
  validRows: number;
  invalidRows: number;
  warningCount: number;
  actions: { create: number; update: number; skip: number };
  generatedIds: number;
  previousImport?: { id: string; createdAt: Date; status: string; originalFilename: string };
};

type PersonRef = {
  _id: mongoose.Types.ObjectId;
  type: AcademicPersonType;
  status: string;
  externalId?: string;
  email?: string;
  phone?: string;
  userId?: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
};
type ClassRef = { _id: mongoose.Types.ObjectId; name: string; academicYear: string; departmentId: mongoose.Types.ObjectId; courseIds: mongoose.Types.ObjectId[] };

type ImportContext = {
  companyId: mongoose.Types.ObjectId;
  settings: AcademicIdentifierSettings;
  people: Map<string, PersonRef>;
  peopleByEmail: Map<string, PersonRef>;
  parentsByPhone: Map<string, PersonRef>;
  peopleByName: Map<string, PersonRef>;
  peopleByNameAndBirth: Map<string, PersonRef>;
  departments: Map<string, { _id: mongoose.Types.ObjectId }>;
  courses: Map<string, { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId }>;
  coursesById: Map<string, { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId }>;
  classes: Map<string, ClassRef>;
  classesById: Map<string, ClassRef>;
  classesByCompactName: Map<string, ClassRef[]>;
  assessments: Map<string, { _id: mongoose.Types.ObjectId; classId: mongoose.Types.ObjectId; pointsPossible: number }>;
  /** classId → roll number (upper case) → student id; loaded on first use. */
  rolls: Map<string, Map<string, string>>;
};

/** Duplicate tracking within one uploaded file. */
type FileState = {
  emails: Set<string>;
  rolls: Set<string>;
  nameAndBirth: Set<string>;
  plannedGuardians: Set<string>;
};

type GuardianPlan = {
  existing?: PersonRef;
  create?: { externalId?: string; firstName: string; lastName: string; email?: string; phone?: string };
  relationship: GuardianRelationshipType;
};

type PersonPlan = {
  type: AcademicPersonType;
  action: 'create' | 'update' | 'skip';
  externalId?: string;
  existing?: PersonRef;
  payload: Record<string, unknown>;
  academicClass?: ClassRef;
  enrollmentStatus?: string;
  rollNumber?: string;
  enrolledAt?: Date;
  guardian?: GuardianPlan;
  studentLink?: { student: PersonRef; relationship: GuardianRelationshipType };
};

type RowValidation = { issues: AcademicImportIssue[]; key?: string; plan?: PersonPlan; generated?: string[] };

export type CapacityGuard = <T>(type: AcademicPersonType, create: () => Promise<T>) => Promise<T>;

class ImportRowError extends Error {
  constructor(readonly code: string, message: string, readonly field?: string) {
    super(message);
    this.name = 'ImportRowError';
  }
}

const PEOPLE_MODULES: AcademicImportModule[] = ['students', 'teachers', 'parents'];

export function isPeopleModule(module: AcademicImportModule): boolean {
  return PEOPLE_MODULES.includes(module);
}

function personTypeFor(module: AcademicImportModule): AcademicPersonType {
  return module === 'students' ? 'student' : module === 'teachers' ? 'teacher' : 'parent';
}

export function moduleDefinition(module: AcademicImportModule) {
  const definition = IMPORT_MODULES.find((item) => item.id === module);
  if (!definition) throw new Error('Unsupported import module.');
  return definition;
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^﻿/, '').replace(/[\s-]+/g, '_').toLowerCase();
}

/** Header comparison key: "Student ID", "student_id" and "studentId" all match. */
function compactHeader(value: string): string {
  return value.replace(/^﻿/, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Removes the apostrophe WorkGrind exports add before formula-like values. */
function unescapeSpreadsheetText(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const candidate = value as { formula?: unknown; result?: unknown; richText?: Array<{ text?: string }>; text?: unknown; hyperlink?: unknown };
    if (candidate.formula !== undefined) throw new Error('Formula cells are not accepted. Export values before importing.');
    if (candidate.result !== undefined) return normalizeCell(candidate.result);
    if (Array.isArray(candidate.richText)) return candidate.richText.map((part) => part.text ?? '').join('').trim();
    if (candidate.hyperlink !== undefined && typeof candidate.text === 'string') return candidate.text.trim();
  }
  return unescapeSpreadsheetText(String(value).trim());
}

function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some((value) => value.trim())) rows.push(row); }
  const contentRows = rows.filter((values) => !values[0]?.trim().startsWith('#'));
  if (!contentRows.length) return { sheets: ['CSV'], headers: [], headerLabels: [], rows: [] };
  const headerLabels = contentRows.shift()!.map((value) => value.trim().replace(/^﻿/, ''));
  const headers = headerLabels.map(normalizeHeader);
  if (contentRows.length > MAX_IMPORT_ROWS) throw new Error(`Import files may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  const parsedRows = contentRows
    .map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, unescapeSpreadsheetText((values[column] ?? '').trim())])),
    }));
  return { sheets: ['CSV'], headers, headerLabels, rows: parsedRows };
}

async function parseWorkbook(buffer: Buffer, filename: string, requestedSheet?: string): Promise<ParsedFile> {
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error(`Import files may not exceed ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} MB.`);
  const extension = filename.toLowerCase().split('.').pop();
  if (extension === 'csv') return parseCsv(buffer);
  if (extension !== 'xlsx') throw new Error('Only UTF-8 CSV and .xlsx workbooks are supported. Legacy .xls files must be saved as .xlsx first.');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheets = workbook.worksheets.map((worksheet) => worksheet.name);
  const worksheet = requestedSheet ? workbook.getWorksheet(requestedSheet) : workbook.worksheets[0];
  if (!worksheet) throw new Error('The selected worksheet was not found.');
  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (currentRow) => {
    const values: string[] = [];
    currentRow.eachCell({ includeEmpty: true }, (cell, column) => { values[column - 1] = normalizeCell(cell.value); });
    if (values.some((value) => value?.trim())) matrix.push(Array.from(values, (value) => value ?? ''));
    if (matrix.length > MAX_IMPORT_ROWS + 1) throw new Error(`Import files may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  });
  if (!matrix.length) return { sheets, headers: [], headerLabels: [], rows: [] };
  const headerLabels = matrix.shift()!.map((value) => value.trim());
  const headers = headerLabels.map(normalizeHeader);
  const dataRows = matrix.filter((values) => !values[0]?.trim().startsWith('#'));
  if (dataRows.length > MAX_IMPORT_ROWS) throw new Error(`Import files may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  const rows = dataRows
    .map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, (values[column] ?? '').trim()])),
    }));
  return { sheets, headers, headerLabels, rows };
}

/** Suggests a source column for each field by its key, label, or a known alias. */
export function suggestMapping(definition: ImportModuleDefinition, headers: string[], headerLabels: string[] = headers): ImportMapping {
  const used = new Set<string>();
  const mapping: ImportMapping = {};
  for (const field of definition.fields) {
    const candidates = new Set([field.key, field.label, ...(field.aliases ?? [])].map(compactHeader));
    const index = headers.findIndex((header, column) =>
      !used.has(header) && header && (candidates.has(compactHeader(headerLabels[column] ?? header)) || candidates.has(compactHeader(header))));
    mapping[field.key] = index >= 0 ? headers[index] : null;
    if (index >= 0) used.add(headers[index]);
  }
  return mapping;
}

function resolveMapping(definition: ImportModuleDefinition, parsed: ParsedFile, requested?: Record<string, unknown>): { mapping: ImportMapping; issues: AcademicImportIssue[] } {
  const mapping = suggestMapping(definition, parsed.headers, parsed.headerLabels);
  const issues: AcademicImportIssue[] = [];
  if (!requested) return { mapping, issues };
  for (const [fieldKey, source] of Object.entries(requested)) {
    if (!definition.fields.some((field) => field.key === fieldKey)) continue;
    if (source === null || source === '') { mapping[fieldKey] = null; continue; }
    if (typeof source !== 'string' || !parsed.headers.includes(source)) {
      issues.push(issue(1, fieldKey, 'unknown_column', `The column chosen for ${fieldKey} is not in this file.`));
      continue;
    }
    mapping[fieldKey] = source;
  }
  return { mapping, issues };
}

function applyMapping(rows: RawRow[], mapping: ImportMapping): RawRow[] {
  const entries = Object.entries(mapping).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    values: Object.fromEntries(entries.map(([fieldKey, source]) => [normalizeHeader(fieldKey), row.values[source] ?? ''])),
  }));
}

function mappingIssues(definition: ImportModuleDefinition, mapping: ImportMapping): AcademicImportIssue[] {
  const mapped = (key: string) => typeof mapping[key] === 'string';
  if (isPeopleModule(definition.id)) {
    return mapped('fullName') || (mapped('firstName') && mapped('lastName'))
      ? []
      : [issue(1, 'firstName', 'missing_header', 'Map firstName and lastName, or fullName, to a column.')];
  }
  return definition.required
    .filter((key) => !mapped(key))
    .map((key) => issue(1, key, 'missing_header', `Required column ${key} is missing.`));
}

function personKey(type: string, value: string): string {
  return `${type}:${value}`;
}

function nameKey(type: string, firstName: string, lastName: string): string {
  return `${type}:${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function dayKey(value?: Date): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

function compactClassName(value: string): string {
  return value.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function registerPerson(context: ImportContext, person: PersonRef): () => void {
  const keys: Array<[Map<string, PersonRef>, string]> = [];
  if (person.externalId) keys.push([context.people, person.externalId.toUpperCase()]);
  if (person.email) keys.push([context.peopleByEmail, personKey(person.type, person.email.toLowerCase())]);
  if (person.type === 'parent' && person.phone && phoneDigits(person.phone)) keys.push([context.parentsByPhone, phoneDigits(person.phone)]);
  keys.push([context.peopleByName, nameKey(person.type, person.firstName, person.lastName)]);
  if (person.dateOfBirth) keys.push([context.peopleByNameAndBirth, `${nameKey(person.type, person.firstName, person.lastName)}|${dayKey(person.dateOfBirth)}`]);
  const previous = keys.map(([map, key]) => map.get(key));
  for (const [map, key] of keys) map.set(key, person);
  return () => keys.forEach(([map, key], index) => {
    if (previous[index]) map.set(key, previous[index]!);
    else map.delete(key);
  });
}

async function buildContext(companyId: mongoose.Types.ObjectId): Promise<ImportContext> {
  const [people, departments, courses, classes, assessments, settings] = await Promise.all([
    AcademicPerson.find({ companyId }).select('_id type status externalId email phone userId firstName lastName dateOfBirth').lean(),
    AcademicDepartment.find({ companyId }).select('_id code').lean(),
    AcademicCourse.find({ companyId }).select('_id code departmentId').lean(),
    AcademicClass.find({ companyId }).select('_id name academicYear departmentId courseIds').lean(),
    AcademicAssessment.find({ companyId }).select('_id classId pointsPossible').lean(),
    getIdentifierSettings(companyId),
  ]);
  const classesByCompactName = new Map<string, ClassRef[]>();
  for (const academicClass of classes as ClassRef[]) {
    const key = compactClassName(academicClass.name);
    classesByCompactName.set(key, [...(classesByCompactName.get(key) ?? []), academicClass]);
  }
  const context: ImportContext = {
    companyId,
    settings,
    people: new Map(),
    peopleByEmail: new Map(),
    parentsByPhone: new Map(),
    peopleByName: new Map(),
    peopleByNameAndBirth: new Map(),
    departments: new Map(departments.map((department) => [department.code.toUpperCase(), department])),
    courses: new Map(courses.map((course) => [course.code.toUpperCase(), course])),
    coursesById: new Map(courses.map((course) => [course._id.toString(), course])),
    classes: new Map((classes as ClassRef[]).map((academicClass) => [`${academicClass.name.toUpperCase()}::${academicClass.academicYear.toUpperCase()}`, academicClass])),
    classesById: new Map((classes as ClassRef[]).map((academicClass) => [academicClass._id.toString(), academicClass])),
    classesByCompactName,
    assessments: new Map(assessments.map((assessment) => [assessment._id.toString(), assessment])),
    rolls: new Map(),
  };
  for (const person of people as PersonRef[]) registerPerson(context, person);
  return context;
}

async function classRolls(context: ImportContext, classId: mongoose.Types.ObjectId): Promise<Map<string, string>> {
  const key = classId.toString();
  let rolls = context.rolls.get(key);
  if (!rolls) {
    const enrollments = await AcademicEnrollment.find({ companyId: context.companyId, classId, rollNumber: { $type: 'string' } }).select('studentId rollNumber').lean();
    rolls = new Map(enrollments.map((enrollment) => [String(enrollment.rollNumber).toUpperCase(), enrollment.studentId.toString()]));
    context.rolls.set(key, rolls);
  }
  return rolls;
}

function issue(rowNumber: number, field: string | undefined, code: string, message: string, severity?: 'warning'): AcademicImportIssue {
  return { rowNumber, ...(field ? { field } : {}), code, message, ...(severity ? { severity } : {}) };
}

function isError(item: AcademicImportIssue): boolean {
  return item.severity !== 'warning';
}

function requiredIssues(definition: ReturnType<typeof moduleDefinition>, row: RawRow): AcademicImportIssue[] {
  return definition.required
    .filter((field) => !row.values[normalizeHeader(field)])
    .map((field) => issue(row.rowNumber, field, 'required', `${field} is required.`));
}

function validDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Calendar dates must be YYYY-MM-DD (or a spreadsheet date) so 03/04 is never guessed. */
function calendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.toISOString().slice(0, 10) === `${match[1]}-${match[2]}-${match[3]}` ? parsed : null;
}

function validEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return /^\+?[0-9][0-9 ().-]{4,30}$/.test(value) && digits.length >= 6 && digits.length <= 15;
}

function objectId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

function getPerson(context: ImportContext, externalId: string, type: string) {
  const person = context.people.get(externalId.toUpperCase());
  return person && person.type === type && person.status === 'active' ? person : null;
}

function splitFullName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function normalizeRelationship(value: string): GuardianRelationshipType | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || ['parent', 'mother', 'father', 'mom', 'dad'].includes(normalized)) return 'parent';
  if (['guardian', 'legal guardian'].includes(normalized)) return 'guardian';
  if (normalized === 'other') return 'other';
  return null;
}

function personLabel(type: AcademicPersonType): string {
  return type === 'student' ? 'student' : type === 'teacher' ? 'teacher' : 'guardian';
}

function describePerson(person: PersonRef): string {
  return person.externalId ? `${personLabel(person.type)} ${person.externalId}` : `an existing ${personLabel(person.type)}`;
}

function sameId(left: mongoose.Types.ObjectId | undefined, right: mongoose.Types.ObjectId | undefined): boolean {
  return Boolean(left && right && left.toString() === right.toString());
}

async function validatePersonRow(
  module: AcademicImportModule,
  row: RawRow,
  context: ImportContext,
  fileState: FileState,
  mode: AcademicImportMode,
): Promise<RowValidation> {
  const type = personTypeFor(module);
  const value = (field: string) => row.values[normalizeHeader(field)] ?? '';
  const issues: AcademicImportIssue[] = [];
  const add = (field: string | undefined, code: string, message: string, severity?: 'warning') => issues.push(issue(row.rowNumber, field, code, message, severity));
  const generated: string[] = [];

  let firstName = value('firstName');
  let lastName = value('lastName');
  if ((!firstName || !lastName) && value('fullName')) {
    const split = splitFullName(value('fullName'));
    firstName ||= split.firstName;
    lastName ||= split.lastName;
  }
  if (!firstName) add('firstName', 'required', 'firstName (or fullName) is required.');
  if (!lastName) add('lastName', 'required', 'lastName is required. A fullName must include a last name.');
  if (firstName.length > 100) add('firstName', 'too_long', 'firstName may not exceed 100 characters.');
  if (lastName.length > 100) add('lastName', 'too_long', 'lastName may not exceed 100 characters.');

  const externalId = value('externalId');
  if (externalId && !/^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,99}$/u.test(externalId)) add('externalId', 'invalid_identifier', 'IDs may contain letters, numbers, dots, slashes, underscores and hyphens (100 characters maximum).');
  const existing = externalId ? context.people.get(externalId.toUpperCase()) : undefined;
  if (existing && existing.type !== type) {
    add('externalId', 'type_conflict', `ID ${externalId} already belongs to a ${personLabel(existing.type)} record.`);
    return { issues, key: externalId.toUpperCase() };
  }

  let action: PersonPlan['action'];
  if (existing) action = mode === 'create_only' || mode === 'skip_duplicates' ? 'skip' : 'update';
  else if (mode === 'update_only') {
    add('externalId', 'not_found', externalId ? `No ${personLabel(type)} with ID ${externalId} exists to update.` : 'An existing ID is required to update records.');
    return { issues, key: externalId ? externalId.toUpperCase() : undefined };
  } else action = 'create';
  if (action === 'skip') {
    return { issues, key: externalId.toUpperCase(), plan: { type, action, externalId, existing, payload: {} } };
  }
  if (action === 'create' && !externalId) generated.push('externalId');

  const payload: Record<string, unknown> = {};
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;

  const email = value('email').toLowerCase();
  if (email) {
    if (!validEmail(email) || email.length > 254) add('email', 'invalid_email', 'Email format is invalid.');
    else {
      const owner = context.peopleByEmail.get(personKey(type, email));
      if (owner && !sameId(owner._id, existing?._id)) add('email', 'duplicate_email', `This email is already used by ${describePerson(owner)}.`);
      if (fileState.emails.has(personKey(type, email))) add('email', 'duplicate_upload', 'This email appears more than once in the upload.');
      fileState.emails.add(personKey(type, email));
      if (existing?.userId && existing.email && existing.email !== email) add('email', 'linked_account_email', 'This record is linked to a WorkGrind account, so its email cannot be changed by import.');
      payload.email = email;
    }
  }
  const phone = value('phone');
  if (phone) {
    if (!validPhone(phone)) add('phone', 'invalid_phone', 'Phone must contain 6–15 digits with an optional leading +.');
    else payload.phone = phone;
  }
  const dateOfBirthValue = value('dateOfBirth');
  let dateOfBirth: Date | undefined;
  if (dateOfBirthValue) {
    const parsed = calendarDate(dateOfBirthValue);
    if (!parsed || parsed.getTime() >= Date.now() || parsed.getUTCFullYear() < 1900) add('dateOfBirth', 'invalid_date', 'dateOfBirth must be a past date in YYYY-MM-DD format.');
    else { dateOfBirth = parsed; payload.dateOfBirth = parsed; }
  }
  const startField = module === 'students' ? 'admissionDate' : module === 'teachers' ? 'joiningDate' : '';
  let startDate: Date | undefined;
  if (startField && value(startField)) {
    const parsed = calendarDate(value(startField));
    if (!parsed) add(startField, 'invalid_date', `${startField} must use YYYY-MM-DD format.`);
    else if (dateOfBirth && parsed < dateOfBirth) add(startField, 'invalid_date', `${startField} cannot be earlier than dateOfBirth.`);
    else { startDate = parsed; payload.startDate = parsed; }
  }
  const address = value('address');
  if (address) {
    if (address.length > 500) add('address', 'too_long', 'address may not exceed 500 characters.');
    else payload.address = address;
  }
  const status = value('status').toLowerCase();
  if (status) {
    if (!['active', 'inactive'].includes(status)) add('status', 'invalid_value', 'status must be active or inactive.');
    else payload.status = status;
  }

  // Possible duplicates are only checked for rows without an ID: a supplied ID is the administrator's explicit match.
  if (action === 'create' && !externalId && firstName && lastName && type !== 'parent') {
    const names = nameKey(type, firstName, lastName);
    if (dateOfBirth) {
      const match = context.peopleByNameAndBirth.get(`${names}|${dayKey(dateOfBirth)}`);
      if (match) add('externalId', 'possible_duplicate', `${describePerson(match)} has the same name and date of birth. Add that ID to update it, or a new ID to create a separate record.`);
      if (fileState.nameAndBirth.has(`${names}|${dayKey(dateOfBirth)}`)) add('firstName', 'duplicate_upload', 'Another row without an ID has the same name and date of birth.');
      fileState.nameAndBirth.add(`${names}|${dayKey(dateOfBirth)}`);
    } else if (type === 'student' && context.peopleByName.get(names)) {
      add('firstName', 'possible_duplicate', `${describePerson(context.peopleByName.get(names)!)} has the same name. A new record will be created; add the existing ID instead to update it.`, 'warning');
    }
  }

  let department: { _id: mongoose.Types.ObjectId } | undefined;
  if (module !== 'parents' && value('departmentCode')) {
    department = context.departments.get(value('departmentCode').toUpperCase());
    if (!department) add('departmentCode', 'unknown_reference', 'Department code does not belong to this workspace.');
    else payload.departmentId = department._id;
  }

  const plan: PersonPlan = { type, action, externalId: externalId || undefined, existing, payload };

  if (module === 'students') {
    let course: { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId } | undefined;
    if (value('courseCode')) {
      course = context.courses.get(value('courseCode').toUpperCase());
      if (!course) add('courseCode', 'unknown_reference', 'Course code does not belong to this workspace.');
      else {
        if (department && !sameId(course.departmentId, department._id)) add('courseCode', 'invalid_relationship', 'The course does not belong to the given department.');
        payload.courseId = course._id;
      }
    }

    let academicClass: ClassRef | undefined;
    const className = value('className');
    const section = value('section');
    const academicYear = value('academicYear');
    if (value('classId')) {
      academicClass = context.classesById.get(value('classId'));
      if (!academicClass) add('classId', 'unknown_reference', 'classId does not belong to this workspace.');
    } else if (className) {
      const candidates = context.classesByCompactName.get(compactClassName(`${className}${section}`)) ?? [];
      const matches = academicYear ? candidates.filter((item) => item.academicYear.toUpperCase() === academicYear.toUpperCase()) : candidates;
      const label = [className, section && `section ${section}`, academicYear].filter(Boolean).join(', ');
      if (matches.length === 1) academicClass = matches[0];
      else if (!matches.length) add('className', 'unknown_reference', `No class matches ${label}. Create the class first or correct the class, section or academic year.`);
      else add('academicYear', 'ambiguous_reference', `${label} matches classes in several academic years. Add academicYear.`);
    } else if (section) {
      add('section', 'invalid_relationship', 'section needs className.');
    } else if (academicYear) {
      add('academicYear', 'ignored_value', 'academicYear is only used to find the class and was ignored.', 'warning');
    }
    if (academicClass) {
      if (department && !sameId(academicClass.departmentId, department._id)) add('departmentCode', 'invalid_relationship', 'The class belongs to a different department.');
      if (course && !academicClass.courseIds.some((id) => sameId(id, course!._id))) add('courseCode', 'invalid_relationship', 'The course is not taught in the selected class.');
      plan.academicClass = academicClass;
      plan.enrolledAt = startDate;
    }
    const enrollmentStatus = value('enrollmentStatus').toLowerCase();
    if (enrollmentStatus) {
      if (!['active', 'completed', 'withdrawn'].includes(enrollmentStatus)) add('enrollmentStatus', 'invalid_value', 'enrollmentStatus must be active, completed or withdrawn.');
      else if (!academicClass && !value('className') && !value('classId')) add('enrollmentStatus', 'invalid_relationship', 'enrollmentStatus needs a class.');
      else plan.enrollmentStatus = enrollmentStatus;
    }
    const rollNumber = value('rollNumber');
    if (rollNumber) {
      if (!/^[\p{L}\p{N}][\p{L}\p{N}/-]{0,39}$/u.test(rollNumber)) add('rollNumber', 'invalid_identifier', 'Roll numbers may contain letters, numbers, slashes and hyphens (40 characters maximum).');
      else if (!academicClass) {
        if (!value('className') && !value('classId')) add('rollNumber', 'invalid_relationship', 'rollNumber needs a class.');
      } else {
        const holder = (await classRolls(context, academicClass._id)).get(rollNumber.toUpperCase());
        if (holder && holder !== existing?._id.toString()) add('rollNumber', 'duplicate_roll_number', `Roll number ${rollNumber} is already assigned in this class.`);
        const fileKey = `${academicClass._id.toString()}:${rollNumber.toUpperCase()}`;
        if (fileState.rolls.has(fileKey)) add('rollNumber', 'duplicate_upload', 'This roll number appears more than once for the class in the upload.');
        fileState.rolls.add(fileKey);
        plan.rollNumber = rollNumber;
      }
    } else if (academicClass && context.settings.rollNumberMode === 'sequential_per_class') {
      generated.push('rollNumber');
    }

    const guardian = {
      id: value('guardianId'),
      name: value('guardianName'),
      email: value('guardianEmail').toLowerCase(),
      phone: value('guardianPhone'),
      relationship: value('guardianRelationship'),
    };
    if (guardian.id || guardian.name || guardian.email || guardian.phone || guardian.relationship) {
      const relationship = normalizeRelationship(guardian.relationship);
      if (!relationship) add('guardianRelationship', 'invalid_value', 'guardianRelationship must be parent, guardian or other.');
      if (guardian.email && !validEmail(guardian.email)) add('guardianEmail', 'invalid_email', 'Guardian email format is invalid.');
      if (guardian.phone && !validPhone(guardian.phone)) add('guardianPhone', 'invalid_phone', 'Guardian phone must contain 6–15 digits with an optional leading +.');
      let match: PersonRef | undefined;
      if (guardian.id) {
        const byId = context.people.get(guardian.id.toUpperCase());
        if (byId && byId.type !== 'parent') add('guardianId', 'type_conflict', `ID ${guardian.id} belongs to a ${personLabel(byId.type)} record.`);
        else match = byId;
      }
      const byEmail = guardian.email ? context.peopleByEmail.get(personKey('parent', guardian.email)) : undefined;
      const byPhone = guardian.phone && validPhone(guardian.phone) ? context.parentsByPhone.get(phoneDigits(guardian.phone)) : undefined;
      if (match && byEmail && !sameId(match._id, byEmail._id)) add('guardianEmail', 'guardian_conflict', `guardianEmail belongs to ${describePerson(byEmail)}, not guardian ${guardian.id}.`);
      if (!match && guardian.id && (byEmail || byPhone)) add('guardianId', 'guardian_conflict', `The guardian email or phone belongs to ${describePerson((byEmail ?? byPhone)!)}, not guardian ${guardian.id}.`);
      if (!match && !guardian.id) match = byEmail ?? byPhone;
      if (match && match.status !== 'active') add('guardianId', 'inactive_reference', `${describePerson(match)} is inactive.`);
      if (match) {
        plan.guardian = { existing: match, relationship: relationship ?? 'parent' };
      } else {
        const split = splitFullName(guardian.name);
        const matchKeys = [guardian.id && `id:${guardian.id.toUpperCase()}`, guardian.email && `email:${guardian.email}`, guardian.phone && `phone:${phoneDigits(guardian.phone)}`].filter(Boolean) as string[];
        if (!guardian.id && !guardian.email && !guardian.phone) add('guardianName', 'guardian_unmatchable', 'Add guardianEmail, guardianPhone or guardianId so the guardian can be matched safely on later imports.');
        else if (!split.firstName || !split.lastName) {
          if (!matchKeys.some((key) => fileState.plannedGuardians.has(key))) add('guardianName', 'required', 'guardianName with a first and last name is required for a new guardian.');
        }
        matchKeys.forEach((key) => fileState.plannedGuardians.add(key));
        plan.guardian = {
          create: {
            ...(guardian.id ? { externalId: guardian.id } : {}),
            firstName: split.firstName,
            lastName: split.lastName,
            ...(guardian.email ? { email: guardian.email } : {}),
            ...(guardian.phone && validPhone(guardian.phone) ? { phone: guardian.phone } : {}),
          },
          relationship: relationship ?? 'parent',
        };
        if (!guardian.id) generated.push('guardianId');
      }
    }
  }

  if (module === 'parents' && (value('studentExternalId') || value('relationship'))) {
    const relationship = normalizeRelationship(value('relationship'));
    if (!relationship) add('relationship', 'invalid_value', 'relationship must be parent, guardian or other.');
    const student = value('studentExternalId') ? getPerson(context, value('studentExternalId'), 'student') : null;
    if (!value('studentExternalId')) add('studentExternalId', 'required', 'studentExternalId is required when relationship is given.');
    else if (!student) add('studentExternalId', 'unknown_reference', 'Active student ID was not found in this workspace.');
    if (student && relationship) plan.studentLink = { student, relationship };
  }

  return { issues, key: externalId ? externalId.toUpperCase() : undefined, plan, generated };
}

async function validateRow(
  module: AcademicImportModule,
  row: RawRow,
  context: ImportContext,
  fileState: FileState,
  mode: AcademicImportMode,
): Promise<RowValidation> {
  if (isPeopleModule(module)) return validatePersonRow(module, row, context, fileState, mode);
  const definition = moduleDefinition(module);
  const issues = requiredIssues(definition, row);
  const value = (field: string) => row.values[normalizeHeader(field)] ?? '';
  if (issues.length) return { issues };
  if (module === 'departments') return { issues, key: value('code').toUpperCase() };
  if (module === 'courses') {
    if (!context.departments.has(value('departmentCode').toUpperCase())) issues.push(issue(row.rowNumber, 'departmentCode', 'unknown_reference', 'Department code does not belong to this workspace.'));
    const credits = value('credits');
    if (credits && (!Number.isFinite(Number(credits)) || Number(credits) < 0 || Number(credits) > 100)) issues.push(issue(row.rowNumber, 'credits', 'invalid_number', 'Credits must be between 0 and 100.'));
    return { issues, key: value('code').toUpperCase() };
  }
  if (module === 'classes') {
    if (!context.departments.has(value('departmentCode').toUpperCase())) issues.push(issue(row.rowNumber, 'departmentCode', 'unknown_reference', 'Department code does not belong to this workspace.'));
    const classKey = `${value('name').toUpperCase()}::${value('academicYear').toUpperCase()}`;
    for (const courseCode of value('courseCodes').split(',').map((item) => item.trim()).filter(Boolean)) {
      if (!context.courses.has(courseCode.toUpperCase())) issues.push(issue(row.rowNumber, 'courseCodes', 'unknown_reference', `Course code ${courseCode} does not belong to this workspace.`));
    }
    return { issues, key: classKey };
  }
  if (module === 'enrollments') {
    const student = getPerson(context, value('studentExternalId'), 'student');
    if (!student) issues.push(issue(row.rowNumber, 'studentExternalId', 'unknown_reference', 'Active student externalId was not found in this workspace.'));
    const academicClass = context.classesById.get(value('classId'));
    if (!academicClass) issues.push(issue(row.rowNumber, 'classId', 'unknown_reference', 'classId does not belong to this workspace.'));
    if (value('status') && !['active', 'completed', 'withdrawn'].includes(value('status'))) issues.push(issue(row.rowNumber, 'status', 'invalid_value', 'Status must be active, completed, or withdrawn.'));
    if (value('enrolledAt') && !validDate(value('enrolledAt'))) issues.push(issue(row.rowNumber, 'enrolledAt', 'invalid_date', 'enrolledAt must be a valid date.'));
    const rollNumber = value('rollNumber');
    if (rollNumber && academicClass) {
      if (!/^[\p{L}\p{N}][\p{L}\p{N}/-]{0,39}$/u.test(rollNumber)) issues.push(issue(row.rowNumber, 'rollNumber', 'invalid_identifier', 'Roll numbers may contain letters, numbers, slashes and hyphens (40 characters maximum).'));
      const holder = (await classRolls(context, academicClass._id)).get(rollNumber.toUpperCase());
      if (holder && holder !== student?._id.toString()) issues.push(issue(row.rowNumber, 'rollNumber', 'duplicate_roll_number', `Roll number ${rollNumber} is already assigned in this class.`));
      const fileKey = `${academicClass._id.toString()}:${rollNumber.toUpperCase()}`;
      if (fileState.rolls.has(fileKey)) issues.push(issue(row.rowNumber, 'rollNumber', 'duplicate_upload', 'This roll number appears more than once for the class in the upload.'));
      fileState.rolls.add(fileKey);
    }
    return { issues, key: `${value('studentExternalId').toUpperCase()}::${value('classId')}` };
  }
  if (module === 'guardians') {
    if (!getPerson(context, value('studentExternalId'), 'student')) issues.push(issue(row.rowNumber, 'studentExternalId', 'unknown_reference', 'Active student externalId was not found in this workspace.'));
    if (!getPerson(context, value('guardianExternalId'), 'parent')) issues.push(issue(row.rowNumber, 'guardianExternalId', 'unknown_reference', 'Active parent externalId was not found in this workspace.'));
    if (!['parent', 'guardian', 'other'].includes(value('relationship'))) issues.push(issue(row.rowNumber, 'relationship', 'invalid_value', 'Relationship must be parent, guardian, or other.'));
    return { issues, key: `${value('studentExternalId').toUpperCase()}::${value('guardianExternalId').toUpperCase()}` };
  }
  if (module === 'teaching_assignments') {
    if (!getPerson(context, value('teacherExternalId'), 'teacher')) issues.push(issue(row.rowNumber, 'teacherExternalId', 'unknown_reference', 'Active teacher externalId was not found in this workspace.'));
    if (!context.classesById.has(value('classId'))) issues.push(issue(row.rowNumber, 'classId', 'unknown_reference', 'classId does not belong to this workspace.'));
    return { issues, key: `${value('teacherExternalId').toUpperCase()}::${value('classId')}` };
  }
  if (module === 'timetables') {
    const academicClass = context.classesById.get(value('classId'));
    if (!academicClass) issues.push(issue(row.rowNumber, 'classId', 'unknown_reference', 'classId does not belong to this workspace.'));
    if (value('courseCode')) {
      const course = context.courses.get(value('courseCode').toUpperCase());
      if (!course) issues.push(issue(row.rowNumber, 'courseCode', 'unknown_reference', 'Course code does not belong to this workspace.'));
      else if (!academicClass?.courseIds.some((id) => id.toString() === course._id.toString())) issues.push(issue(row.rowNumber, 'courseCode', 'invalid_relationship', 'The course must belong to the selected class.'));
    }
    const day = Number(value('dayOfWeek'));
    if (!Number.isInteger(day) || day < 1 || day > 7) issues.push(issue(row.rowNumber, 'dayOfWeek', 'invalid_number', 'dayOfWeek must be an integer from 1 to 7.'));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value('startTime'))) issues.push(issue(row.rowNumber, 'startTime', 'invalid_time', 'startTime must use HH:mm.'));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value('endTime')) || value('startTime') >= value('endTime')) issues.push(issue(row.rowNumber, 'endTime', 'invalid_time', 'endTime must be later than startTime and use HH:mm.'));
    for (const field of ['validFrom', 'validUntil']) if (value(field) && !validDate(value(field))) issues.push(issue(row.rowNumber, field, 'invalid_date', `${field} must be a valid date.`));
    if (academicClass && /^([01]\d|2[0-3]):[0-5]\d$/.test(value('startTime')) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value('endTime')) && value('startTime') < value('endTime')) {
      const validFrom = validDate(value('validFrom')) ?? new Date(0);
      const validUntil = validDate(value('validUntil')) ?? new Date('9999-12-31T23:59:59.999Z');
      const dateRange = {
        $and: [
          { $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: validFrom } }] },
          { $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: validUntil } }] },
        ],
      };
      if (validFrom > validUntil) {
        issues.push(issue(row.rowNumber, 'validUntil', 'invalid_date_range', 'validUntil must not be earlier than validFrom.'));
      } else {
        const sameSession = await AcademicSchedule.findOne({
          companyId: context.companyId,
          classId: academicClass._id,
          dayOfWeek: Number(value('dayOfWeek')),
          startTime: value('startTime'),
          ...dateRange,
        }).select('_id');
        if (!sameSession) {
          const conflict = await AcademicSchedule.findOne({
            companyId: context.companyId,
            classId: academicClass._id,
            dayOfWeek: Number(value('dayOfWeek')),
            startTime: { $lt: value('endTime') },
            endTime: { $gt: value('startTime') },
            ...dateRange,
          }).select('_id');
          const location = value('location');
          const locationConflict = location
            ? await AcademicSchedule.findOne({
              companyId: context.companyId,
              dayOfWeek: Number(value('dayOfWeek')),
              startTime: { $lt: value('endTime') },
              endTime: { $gt: value('startTime') },
              location: { $regex: `^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
              ...dateRange,
            }).select('_id')
            : null;
          if (conflict || locationConflict) issues.push(issue(row.rowNumber, 'startTime', 'schedule_conflict', conflict ? 'This class already has an overlapping timetable session.' : 'This location already has an overlapping timetable session.'));
        }
      }
    }
    return { issues, key: `${value('classId')}::${value('dayOfWeek')}::${value('startTime')}` };
  }
  if (module === 'attendance') {
    const academicClass = context.classesById.get(value('classId'));
    if (!academicClass) issues.push(issue(row.rowNumber, 'classId', 'unknown_reference', 'classId does not belong to this workspace.'));
    if (!getPerson(context, value('studentExternalId'), 'student')) issues.push(issue(row.rowNumber, 'studentExternalId', 'unknown_reference', 'Active student externalId was not found in this workspace.'));
    if (academicClass && getPerson(context, value('studentExternalId'), 'student')) {
      // The exact enrollment is checked again during the write; this prevents
      // cross-tenant IDs from passing preview while retaining the existing
      // attendance relationship rule.
      const enrollmentExists = await AcademicEnrollment.exists({ companyId: context.companyId, classId: academicClass._id, studentId: getPerson(context, value('studentExternalId'), 'student')!._id, status: 'active' });
      if (!enrollmentExists) issues.push(issue(row.rowNumber, 'studentExternalId', 'invalid_relationship', 'The student is not actively enrolled in this class.'));
    }
    if (!validDate(value('date'))) issues.push(issue(row.rowNumber, 'date', 'invalid_date', 'Date must be a valid date.'));
    if (!['present', 'absent', 'late', 'excused'].includes(value('status'))) issues.push(issue(row.rowNumber, 'status', 'invalid_value', 'Status must be present, absent, late, or excused.'));
    return { issues, key: `${value('classId')}::${value('studentExternalId').toUpperCase()}::${value('date').slice(0, 10)}` };
  }
  if (module === 'assessments') {
    const academicClass = context.classesById.get(value('classId'));
    if (!academicClass) issues.push(issue(row.rowNumber, 'classId', 'unknown_reference', 'classId does not belong to this workspace.'));
    if (value('courseCode')) {
      const course = context.courses.get(value('courseCode').toUpperCase());
      if (!course || !academicClass?.courseIds.some((id) => id.toString() === course._id.toString())) issues.push(issue(row.rowNumber, 'courseCode', 'invalid_relationship', 'The course must belong to the selected class.'));
    }
    if (!['exam', 'quiz', 'test', 'project'].includes(value('type'))) issues.push(issue(row.rowNumber, 'type', 'invalid_value', 'Type must be exam, quiz, test, or project.'));
    const points = Number(value('pointsPossible'));
    if (!Number.isFinite(points) || points < 0 || points > 100000) issues.push(issue(row.rowNumber, 'pointsPossible', 'invalid_number', 'pointsPossible must be between 0 and 100000.'));
    if (value('scheduledAt') && !validDate(value('scheduledAt'))) issues.push(issue(row.rowNumber, 'scheduledAt', 'invalid_date', 'scheduledAt must be a valid date.'));
    return { issues, key: `${value('classId')}::${value('title').toUpperCase()}::${value('type')}` };
  }
  if (module === 'results') {
    const assessment = context.assessments.get(value('assessmentId'));
    if (!assessment) issues.push(issue(row.rowNumber, 'assessmentId', 'unknown_reference', 'Assessment ID does not belong to this workspace.'));
    const student = getPerson(context, value('studentExternalId'), 'student');
    if (!student) issues.push(issue(row.rowNumber, 'studentExternalId', 'unknown_reference', 'Active student externalId was not found in this workspace.'));
    if (assessment && student && !await AcademicEnrollment.exists({ companyId: context.companyId, classId: assessment.classId, studentId: student._id, status: 'active' })) issues.push(issue(row.rowNumber, 'studentExternalId', 'invalid_relationship', 'The student is not actively enrolled in the assessment class.'));
    if (!Number.isFinite(Number(value('pointsEarned'))) || Number(value('pointsEarned')) < 0 || (assessment && Number(value('pointsEarned')) > assessment.pointsPossible)) issues.push(issue(row.rowNumber, 'pointsEarned', 'invalid_number', 'pointsEarned must be between zero and the assessment maximum.'));
    return { issues, key: `${value('assessmentId')}::${value('studentExternalId').toUpperCase()}` };
  }
  if (module === 'fees') {
    if (!getPerson(context, value('studentExternalId'), 'student')) issues.push(issue(row.rowNumber, 'studentExternalId', 'unknown_reference', 'Active student externalId was not found in this workspace.'));
    if (!Number.isSafeInteger(Number(value('amountMinor'))) || Number(value('amountMinor')) <= 0) issues.push(issue(row.rowNumber, 'amountMinor', 'invalid_amount', 'amountMinor must be a positive integer.'));
    if (!/^[A-Za-z]{3}$/.test(value('currency'))) issues.push(issue(row.rowNumber, 'currency', 'invalid_currency', 'Currency must be a three-letter ISO code.'));
    if (!/^[A-Za-z0-9-]{1,40}$/.test(value('invoiceNumber'))) issues.push(issue(row.rowNumber, 'invoiceNumber', 'invalid_identifier', 'invoiceNumber may contain only letters, numbers, and hyphens.'));
    if (value('dueAt') && !validDate(value('dueAt'))) issues.push(issue(row.rowNumber, 'dueAt', 'invalid_date', 'dueAt must be a valid date.'));
    return { issues, key: value('invoiceNumber').toUpperCase() };
  }
  return { issues };
}

function existingAction(module: AcademicImportModule, validation: RowValidation): ImportRowAction | undefined {
  if (!isPeopleModule(module)) return undefined;
  return validation.plan?.action;
}

export function fileFingerprint(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function prepare(
  buffer: Buffer,
  filename: string,
  module: AcademicImportModule,
  worksheet?: string,
  requestedMapping?: Record<string, unknown>,
) {
  const definition = moduleDefinition(module);
  const parsed = await parseWorkbook(buffer, filename, worksheet);
  const resolved = resolveMapping(definition, parsed, requestedMapping);
  const duplicateHeaders = [...new Set(parsed.headers.filter((header, index) => header && parsed.headers.indexOf(header) !== index))];
  const headerIssues = [
    ...resolved.issues,
    ...mappingIssues(definition, resolved.mapping),
    ...duplicateHeaders
      .filter((header) => Object.values(resolved.mapping).includes(header))
      .map((header) => issue(1, header, 'duplicate_header', `Column ${header} appears more than once.`)),
  ];
  if (!parsed.headers.length) headerIssues.push(issue(1, undefined, 'empty_file', 'The file contains no header row or data.'));
  return { definition, parsed, mapping: resolved.mapping, headerIssues, rows: applyMapping(parsed.rows, resolved.mapping) };
}

export async function previewImport(
  buffer: Buffer,
  filename: string,
  module: AcademicImportModule,
  companyId: mongoose.Types.ObjectId,
  worksheet?: string,
  options: { mapping?: Record<string, unknown>; mode?: AcademicImportMode } = {},
): Promise<ImportPreview> {
  const { definition, parsed, mapping, headerIssues, rows } = await prepare(buffer, filename, module, worksheet, options.mapping);
  const mode = options.mode ?? 'create_only';
  const base = {
    sheets: parsed.sheets,
    worksheet: worksheet || parsed.sheets[0],
    headers: parsed.headers,
    headerLabels: parsed.headerLabels,
    fields: definition.fields,
    mapping,
    unmappedHeaders: parsed.headers.filter((header) => header && !Object.values(mapping).includes(header)),
    totalRows: parsed.rows.length,
  };
  if (headerIssues.length) {
    return { ...base, previewRows: [], issues: headerIssues, validRows: 0, invalidRows: parsed.rows.length, warningCount: 0, actions: { create: 0, update: 0, skip: 0 }, generatedIds: 0 };
  }
  const context = await buildContext(companyId);
  const issues: AcademicImportIssue[] = [];
  const seen = new Set<string>();
  const fileState: FileState = { emails: new Set(), rolls: new Set(), nameAndBirth: new Set(), plannedGuardians: new Set() };
  const previewRows: ImportPreview['previewRows'] = [];
  const actions = { create: 0, update: 0, skip: 0 };
  let validRows = 0;
  let warningCount = 0;
  let generatedIds = 0;
  for (const row of rows) {
    const result = await validateRow(module, row, context, fileState, mode);
    if (result.key) {
      if (seen.has(result.key)) result.issues.push(issue(row.rowNumber, undefined, 'duplicate_upload', 'The stable matching key is duplicated in this upload.'));
      seen.add(result.key);
    }
    const errors = result.issues.filter(isError);
    warningCount += result.issues.length - errors.length;
    if (issues.length < MAX_STORED_ISSUES) issues.push(...result.issues.slice(0, MAX_STORED_ISSUES - issues.length));
    const action: ImportRowAction = errors.length ? 'error' : existingAction(module, result) ?? 'create';
    if (!errors.length) {
      validRows += 1;
      if (action !== 'error') actions[action] += 1;
      if (result.generated?.includes('externalId')) generatedIds += 1;
    }
    if (previewRows.length < PREVIEW_ROWS) {
      previewRows.push({
        rowNumber: row.rowNumber,
        action,
        values: Object.fromEntries(definition.fields.filter((field) => typeof mapping[field.key] === 'string').map((field) => [field.key, row.values[normalizeHeader(field.key)] ?? ''])),
        generated: errors.length ? [] : result.generated ?? [],
      });
    }
  }
  const previous = await AcademicImportJob.findOne({
    companyId,
    module,
    fileSha256: fileFingerprint(buffer),
    status: { $in: ['completed', 'completed_with_errors'] },
  }).sort({ createdAt: -1 }).select('_id createdAt status originalFilename').lean();
  return {
    ...base,
    previewRows,
    issues,
    validRows,
    invalidRows: rows.length - validRows,
    warningCount,
    actions,
    generatedIds,
    ...(previous ? { previousImport: { id: previous._id.toString(), createdAt: previous.createdAt, status: previous.status, originalFilename: previous.originalFilename } } : {}),
  };
}

function rowValue(row: RawRow, field: string): string { return row.values[normalizeHeader(field)] ?? ''; }

async function ensureScheduleNoConflict(
  companyId: mongoose.Types.ObjectId,
  classId: mongoose.Types.ObjectId,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  location: string,
  validFrom: Date | null,
  validUntil: Date | null,
  excludeId?: mongoose.Types.ObjectId,
): Promise<void> {
  const dateStart = validFrom ?? new Date(0);
  const dateEnd = validUntil ?? new Date('9999-12-31T23:59:59.999Z');
  const dateRange = {
    $and: [
      { $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: dateStart } }] },
      { $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: dateEnd } }] },
    ],
  };
  const exclude = excludeId ? { _id: { $ne: excludeId } } : {};
  const timeRange = { startTime: { $lt: endTime }, endTime: { $gt: startTime } };
  const classConflict = await AcademicSchedule.findOne({ companyId, classId, dayOfWeek, ...timeRange, ...dateRange, ...exclude }).select('_id');
  if (classConflict) throw new Error('This class already has an overlapping timetable session.');
  if (location) {
    const escapedLocation = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const locationConflict = await AcademicSchedule.findOne({ companyId, dayOfWeek, ...timeRange, ...dateRange, ...exclude, location: { $regex: `^${escapedLocation}$`, $options: 'i' } }).select('_id');
    if (locationConflict) throw new Error('This location already has an overlapping timetable session.');
  }
}

function toPersonRef(record: { _id: mongoose.Types.ObjectId; type: AcademicPersonType; status?: string; externalId?: string; email?: string; phone?: string; userId?: mongoose.Types.ObjectId; firstName: string; lastName: string; dateOfBirth?: Date }): PersonRef {
  return {
    _id: record._id,
    type: record.type,
    status: record.status ?? 'active',
    externalId: record.externalId,
    email: record.email,
    phone: record.phone,
    userId: record.userId,
    firstName: record.firstName,
    lastName: record.lastName,
    dateOfBirth: record.dateOfBirth,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000;
}

/** Writes one people row; every record it created or changed is restored if a later step fails. */
async function writePersonRow(
  plan: PersonPlan,
  context: ImportContext,
  capacity: CapacityGuard,
): Promise<{ result: 'created' | 'updated' | 'skipped'; personId?: mongoose.Types.ObjectId; generatedId: boolean }> {
  if (plan.action === 'skip') return { result: 'skipped', personId: plan.existing?._id, generatedId: false };
  const companyId = context.companyId;
  const undo: Array<() => Promise<unknown>> = [];
  const unregister: Array<() => void> = [];
  let generatedId = false;
  try {
    let person: PersonRef;
    if (plan.action === 'create') {
      let created: InstanceType<typeof AcademicPerson> | undefined;
      for (let attempt = 0; !created; attempt += 1) {
        const externalId = plan.externalId ?? await generatePersonExternalId(companyId, plan.type, context.settings, (candidate) => context.people.has(candidate));
        try {
          created = await capacity(plan.type, () => AcademicPerson.create({ companyId, type: plan.type, externalId, ...plan.payload }));
          generatedId = !plan.externalId;
        } catch (error) {
          // A generated ID can collide with one typed by hand in the meantime; reserve another.
          if (!isDuplicateKey(error) || plan.externalId || attempt >= 2) throw error;
        }
      }
      undo.push(() => AcademicPerson.deleteOne({ _id: created!._id, companyId }));
      person = toPersonRef(created);
      unregister.push(registerPerson(context, person));
    } else {
      const existing = plan.existing!;
      const fields = Object.keys(plan.payload);
      if (fields.length) {
        const before = await AcademicPerson.findOne({ _id: existing._id, companyId }).select(fields.join(' ')).lean() as Record<string, unknown> | null;
        if (!before) throw new ImportRowError('not_found', 'The matching record no longer exists.');
        await AcademicPerson.updateOne({ _id: existing._id, companyId }, { $set: plan.payload }, { runValidators: true });
        const restore = Object.fromEntries(fields.filter((field) => before[field] !== undefined).map((field) => [field, before[field]]));
        const clear = Object.fromEntries(fields.filter((field) => before[field] === undefined).map((field) => [field, 1]));
        undo.push(() => AcademicPerson.updateOne({ _id: existing._id, companyId }, { ...(Object.keys(restore).length ? { $set: restore } : {}), ...(Object.keys(clear).length ? { $unset: clear } : {}) }));
      }
      person = { ...existing, ...(plan.payload as Partial<PersonRef>) };
      unregister.push(registerPerson(context, person));
    }

    if (plan.guardian) {
      let guardian = plan.guardian.existing;
      if (!guardian) {
        // A guardian created by an earlier row of this file is matched instead of duplicated.
        const create = plan.guardian.create!;
        guardian = (create.externalId && context.people.get(create.externalId.toUpperCase()))
          || (create.email && context.peopleByEmail.get(personKey('parent', create.email)))
          || (create.phone && context.parentsByPhone.get(phoneDigits(create.phone)))
          || undefined;
        if (guardian && guardian.type !== 'parent') throw new ImportRowError('type_conflict', 'The guardian ID belongs to another kind of record.', 'guardianId');
      }
      if (!guardian) {
        const create = plan.guardian.create!;
        if (!create.firstName || !create.lastName) throw new ImportRowError('required', 'guardianName with a first and last name is required for a new guardian.', 'guardianName');
        const externalId = create.externalId ?? await generatePersonExternalId(companyId, 'parent', context.settings, (candidate) => context.people.has(candidate));
        const createdGuardian = await AcademicPerson.create({ companyId, type: 'parent', ...create, externalId });
        undo.push(() => AcademicPerson.deleteOne({ _id: createdGuardian._id, companyId }));
        guardian = toPersonRef(createdGuardian);
        unregister.push(registerPerson(context, guardian));
      }
      const link = await AcademicGuardianLink.findOne({ companyId, studentId: person._id, guardianId: guardian._id }).select('_id relationship');
      if (!link) {
        const createdLink = await AcademicGuardianLink.create({ companyId, studentId: person._id, guardianId: guardian._id, relationship: plan.guardian.relationship });
        undo.push(() => AcademicGuardianLink.deleteOne({ _id: createdLink._id, companyId }));
      } else if (link.relationship !== plan.guardian.relationship) {
        const previous = link.relationship;
        await AcademicGuardianLink.updateOne({ _id: link._id, companyId }, { $set: { relationship: plan.guardian.relationship } });
        undo.push(() => AcademicGuardianLink.updateOne({ _id: link._id, companyId }, { $set: { relationship: previous } }));
      }
    }

    if (plan.studentLink) {
      const link = await AcademicGuardianLink.findOne({ companyId, studentId: plan.studentLink.student._id, guardianId: person._id }).select('_id');
      if (!link) {
        const createdLink = await AcademicGuardianLink.create({ companyId, studentId: plan.studentLink.student._id, guardianId: person._id, relationship: plan.studentLink.relationship });
        undo.push(() => AcademicGuardianLink.deleteOne({ _id: createdLink._id, companyId }));
      }
    }

    if (plan.academicClass) {
      const classId = plan.academicClass._id;
      const rolls = await classRolls(context, classId);
      const autoRoll = context.settings.rollNumberMode === 'sequential_per_class';
      const enrollment = await AcademicEnrollment.findOne({ companyId, studentId: person._id, classId }).select('_id status rollNumber');
      let rollNumber = plan.rollNumber;
      if (!rollNumber && autoRoll && !enrollment?.rollNumber) {
        rollNumber = await generateRollNumber(companyId, classId, context.settings, (candidate) => rolls.has(candidate));
      }
      if (rollNumber) {
        const holder = rolls.get(rollNumber.toUpperCase());
        if (holder && holder !== person._id.toString()) throw new ImportRowError('duplicate_roll_number', `Roll number ${rollNumber} is already assigned in this class.`, 'rollNumber');
      }
      if (!enrollment) {
        const createdEnrollment = await AcademicEnrollment.create({
          companyId,
          studentId: person._id,
          classId,
          status: plan.enrollmentStatus ?? 'active',
          ...(plan.enrolledAt ? { enrolledAt: plan.enrolledAt } : {}),
          ...(rollNumber ? { rollNumber } : {}),
        });
        undo.push(() => AcademicEnrollment.deleteOne({ _id: createdEnrollment._id, companyId }));
      } else {
        const changes: Record<string, unknown> = {};
        if (plan.enrollmentStatus && plan.enrollmentStatus !== enrollment.status) changes.status = plan.enrollmentStatus;
        if (rollNumber && rollNumber !== enrollment.rollNumber) changes.rollNumber = rollNumber;
        if (Object.keys(changes).length) {
          const previous = { status: enrollment.status, rollNumber: enrollment.rollNumber };
          await AcademicEnrollment.updateOne({ _id: enrollment._id, companyId }, { $set: changes });
          undo.push(() => AcademicEnrollment.updateOne({ _id: enrollment._id, companyId }, previous.rollNumber ? { $set: previous } : { $set: { status: previous.status }, $unset: { rollNumber: 1 } }));
          if (previous.rollNumber) rolls.delete(previous.rollNumber.toUpperCase());
        }
      }
      if (rollNumber) rolls.set(rollNumber.toUpperCase(), person._id.toString());
    }
    return { result: plan.action === 'create' ? 'created' : 'updated', personId: person._id, generatedId };
  } catch (error) {
    for (const step of undo.reverse()) await step().catch(() => undefined);
    unregister.reverse().forEach((step) => step());
    if (plan.academicClass) context.rolls.delete(plan.academicClass._id.toString());
    if (error instanceof ImportRowError) throw error;
    if (isDuplicateKey(error)) throw new ImportRowError('duplicate_value', 'Another record already uses one of this row’s unique values (ID, email or roll number).');
    throw error;
  }
}

async function writeRow(module: AcademicImportModule, row: RawRow, context: ImportContext, userId: mongoose.Types.ObjectId, mode: AcademicImportMode): Promise<'created' | 'updated' | 'skipped'> {
  const value = (field: string) => rowValue(row, field);
  if (module === 'departments') {
    const existing = await AcademicDepartment.findOne({ companyId: context.companyId, code: value('code').toUpperCase() }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching department code does not exist.');
    const payload = { name: value('name'), ...(value('description') ? { description: value('description') } : {}) };
    if (existing) { await AcademicDepartment.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    const created = await AcademicDepartment.create({ companyId: context.companyId, code: value('code'), ...payload });
    context.departments.set(value('code').toUpperCase(), { _id: created._id });
    return 'created';
  }
  if (module === 'courses') {
    const department = context.departments.get(value('departmentCode').toUpperCase())!;
    const existing = await AcademicCourse.findOne({ companyId: context.companyId, code: value('code').toUpperCase() }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching course code does not exist.');
    const payload = { name: value('name'), departmentId: department._id, ...(value('description') ? { description: value('description') } : {}), ...(value('credits') ? { credits: Number(value('credits')) } : {}) };
    if (existing) { await AcademicCourse.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicCourse.create({ companyId: context.companyId, code: value('code'), ...payload }); return 'created';
  }
  if (module === 'classes') {
    const department = context.departments.get(value('departmentCode').toUpperCase())!;
    const courseIds = value('courseCodes').split(',').map((code) => context.courses.get(code.trim().toUpperCase())?._id).filter((id): id is mongoose.Types.ObjectId => !!id);
    const existing = await AcademicClass.findOne({ companyId: context.companyId, name: value('name'), academicYear: value('academicYear') }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching class name and academicYear do not exist.');
    const payload = { departmentId: department._id, courseIds };
    if (existing) { await AcademicClass.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicClass.create({ companyId: context.companyId, name: value('name'), academicYear: value('academicYear'), ...payload }); return 'created';
  }
  const student = value('studentExternalId') ? context.people.get(value('studentExternalId').toUpperCase()) : undefined;
  const teacher = value('teacherExternalId') ? context.people.get(value('teacherExternalId').toUpperCase()) : undefined;
  const classId = objectId(value('classId'));
  if (module === 'enrollments') {
    const existing = await AcademicEnrollment.findOne({ companyId: context.companyId, studentId: student!._id, classId }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching enrollment does not exist.');
    const payload = { status: value('status') || 'active', ...(value('enrolledAt') ? { enrolledAt: validDate(value('enrolledAt'))! } : {}), ...(value('rollNumber') ? { rollNumber: value('rollNumber') } : {}) };
    if (existing) { await AcademicEnrollment.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); }
    else await AcademicEnrollment.create({ companyId: context.companyId, studentId: student!._id, classId, ...payload });
    if (value('rollNumber') && classId) (await classRolls(context, classId)).set(value('rollNumber').toUpperCase(), student!._id.toString());
    return existing ? 'updated' : 'created';
  }
  if (module === 'guardians') {
    const guardian = context.people.get(value('guardianExternalId').toUpperCase())!;
    const existing = await AcademicGuardianLink.findOne({ companyId: context.companyId, studentId: student!._id, guardianId: guardian._id }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching guardian link does not exist.');
    const payload = { relationship: value('relationship') };
    if (existing) { await AcademicGuardianLink.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicGuardianLink.create({ companyId: context.companyId, studentId: student!._id, guardianId: guardian._id, ...payload }); return 'created';
  }
  if (module === 'teaching_assignments') {
    const existing = await AcademicTeachingAssignment.findOne({ companyId: context.companyId, teacherId: teacher!._id, classId }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching teaching assignment does not exist.');
    if (existing) return 'updated';
    await AcademicTeachingAssignment.create({ companyId: context.companyId, teacherId: teacher!._id, classId, createdBy: userId }); return 'created';
  }
  if (module === 'timetables') {
    const dayOfWeek = Number(value('dayOfWeek'));
    const existing = await AcademicSchedule.findOne({ companyId: context.companyId, classId, dayOfWeek, startTime: value('startTime') }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching timetable session does not exist.');
    await ensureScheduleNoConflict(context.companyId, classId!, dayOfWeek, value('startTime'), value('endTime'), value('location'), validDate(value('validFrom')), validDate(value('validUntil')), existing?._id);
    const payload = { courseId: value('courseCode') ? context.courses.get(value('courseCode').toUpperCase())?._id : undefined, endTime: value('endTime'), ...(value('location') ? { location: value('location') } : {}), ...(value('validFrom') ? { validFrom: validDate(value('validFrom'))! } : {}), ...(value('validUntil') ? { validUntil: validDate(value('validUntil'))! } : {}) };
    if (existing) { await AcademicSchedule.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicSchedule.create({ companyId: context.companyId, classId, dayOfWeek, startTime: value('startTime'), ...payload }); return 'created';
  }
  if (module === 'attendance') {
    const date = validDate(value('date'))!; date.setUTCHours(0, 0, 0, 0);
    const existing = await AcademicAttendance.findOne({ companyId: context.companyId, classId, studentId: student!._id, date }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching attendance record does not exist.');
    const payload = { status: value('status'), ...(value('note') ? { note: value('note') } : {}) };
    if (existing) { await AcademicAttendance.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: { ...payload, recordedBy: userId } }); return 'updated'; }
    await AcademicAttendance.create({ companyId: context.companyId, classId, studentId: student!._id, date, recordedBy: userId, ...payload }); return 'created';
  }
  if (module === 'assessments') {
    const existing = await AcademicAssessment.findOne({ companyId: context.companyId, classId, title: value('title'), type: value('type') }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching assessment does not exist.');
    const payload = { courseId: value('courseCode') ? context.courses.get(value('courseCode').toUpperCase())?._id : undefined, title: value('title'), type: value('type'), pointsPossible: Number(value('pointsPossible')), ...(value('scheduledAt') ? { scheduledAt: validDate(value('scheduledAt'))! } : {}) };
    if (existing) { await AcademicAssessment.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicAssessment.create({ companyId: context.companyId, classId, createdBy: userId, ...payload }); return 'created';
  }
  if (module === 'results') {
    const assessment = context.assessments.get(value('assessmentId'))!;
    if (Number(value('pointsEarned')) > assessment.pointsPossible) throw new Error('pointsEarned cannot exceed the assessment maximum.');
    const existing = await AcademicResult.findOne({ companyId: context.companyId, assessmentId: assessment._id, studentId: student!._id }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching result does not exist.');
    const payload = { pointsEarned: Number(value('pointsEarned')), gradedBy: userId, gradedAt: new Date(), ...(value('feedback') ? { feedback: value('feedback') } : {}) };
    if (existing) { await AcademicResult.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicResult.create({ companyId: context.companyId, assessmentId: assessment._id, studentId: student!._id, ...payload }); return 'created';
  }
  if (module === 'fees') {
    const existing = await AcademicFeeCharge.findOne({ companyId: context.companyId, invoiceNumber: value('invoiceNumber').toUpperCase() }).select('_id paidAmountMinor isVoided');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching invoiceNumber does not exist.');
    if (existing?.isVoided) throw new Error('Voided fee charges cannot be updated.');
    if (existing && existing.paidAmountMinor > Number(value('amountMinor'))) throw new Error('The fee amount cannot be reduced below the amount already paid.');
    const payload = { studentId: student!._id, description: value('description'), amountMinor: Number(value('amountMinor')), currency: value('currency').toUpperCase(), ...(value('dueAt') ? { dueAt: validDate(value('dueAt'))! } : {}) };
    if (existing) { await AcademicFeeCharge.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicFeeCharge.create({ companyId: context.companyId, invoiceNumber: value('invoiceNumber'), createdBy: userId, ...payload }); return 'created';
  }
  return 'skipped';
}

/**
 * Applies the workspace plan's student and staff limits to imported people,
 * exactly as single-record creation does.
 */
export function planCapacityGuard(companyId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): CapacityGuard {
  let unlimited = false;
  return async (type, create) => {
    if (type === 'parent' || unlimited) return create();
    return withCompanyCapacityLock(companyId.toString(), async () => {
      const capacity = await checkMemberLimit(userId.toString(), companyId.toString(), { role: type });
      if (capacity.limit === -1) unlimited = true;
      if (!capacity.allowed) throw new ImportRowError('plan_limit', capacity.reason ?? 'The workspace plan limit has been reached.');
      return create();
    });
  };
}

export async function executeImport(options: {
  buffer: Buffer;
  filename: string;
  worksheet?: string;
  module: AcademicImportModule;
  mode: AcademicImportMode;
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  job: InstanceType<typeof AcademicImportJob>;
  mapping?: Record<string, unknown>;
  capacity?: CapacityGuard;
}): Promise<void> {
  const job = options.job;
  try {
    const { mapping, headerIssues, rows } = await prepare(options.buffer, options.filename, options.module, options.worksheet, options.mapping);
    job.mapping = Object.fromEntries(Object.entries(mapping).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    job.status = 'processing'; job.startedAt = new Date(); job.totalRows = rows.length;
    if (headerIssues.length) {
      job.issues.push(...headerIssues);
      job.failedRows = rows.length;
      job.processedRows = rows.length;
      job.status = 'failed';
      job.completedAt = new Date();
      await job.save();
      return;
    }
    await job.save();
    const context = await buildContext(options.companyId);
    const capacity = options.capacity ?? planCapacityGuard(options.companyId, options.userId);
    const seen = new Set<string>();
    const fileState: FileState = { emails: new Set(), rolls: new Set(), nameAndBirth: new Set(), plannedGuardians: new Set() };
    const personIds = new Set<string>(job.personIds.map((id) => id.toString()));
    let lastSave = Date.now();
    const storeIssues = (items: AcademicImportIssue[]) => { job.issues.push(...items.slice(0, Math.max(0, MAX_STORED_ISSUES - job.issues.length))); };
    for (const row of rows) {
      try {
        const validation = await validateRow(options.module, row, context, fileState, options.mode);
        if (validation.key && seen.has(validation.key)) validation.issues.push(issue(row.rowNumber, undefined, 'duplicate_upload', 'The stable matching key is duplicated in this upload.'));
        if (validation.key) seen.add(validation.key);
        storeIssues(validation.issues);
        if (validation.issues.some(isError)) {
          job.failedRows += 1;
        } else if (validation.plan) {
          const written = await writePersonRow(validation.plan, context, capacity);
          if (written.result === 'skipped') job.skippedRows += 1; else job.successfulRows += 1;
          if (written.generatedId) job.generatedIdCount += 1;
          if (written.personId && written.result !== 'skipped' && !personIds.has(written.personId.toString())) {
            personIds.add(written.personId.toString());
            job.personIds.push(written.personId);
          }
        } else {
          const result = await writeRow(options.module, row, context, options.userId, options.mode);
          if (result === 'skipped') job.skippedRows += 1; else job.successfulRows += 1;
        }
      } catch (error) {
        job.failedRows += 1;
        const known = error instanceof ImportRowError;
        storeIssues([issue(row.rowNumber, known ? error.field : undefined, known ? error.code : 'write_failed', known || error instanceof Error ? (error as Error).message.slice(0, 500) : 'The row could not be imported.')]);
      }
      job.processedRows += 1;
      if (job.processedRows % 25 === 0 || Date.now() - lastSave > 1000) {
        await job.save();
        await refreshImportLock(options.companyId, job._id as mongoose.Types.ObjectId).catch(() => undefined);
        lastSave = Date.now();
      }
    }
    job.status = job.failedRows ? 'completed_with_errors' : 'completed';
    job.completedAt = new Date();
    await job.save();
  } catch (error) {
    job.status = 'failed';
    job.completedAt = new Date();
    if (job.issues.length < MAX_STORED_ISSUES) job.issues.push(issue(1, undefined, 'import_failed', error instanceof Error ? error.message.slice(0, 500) : 'The import could not be completed.'));
    await job.save().catch(() => undefined);
    throw error;
  } finally {
    await AuditLog.create({ companyId: options.companyId, userId: options.userId, action: 'academic.import.completed', resource: 'academic_import', resourceId: job._id.toString(), details: { module: options.module, mode: options.mode, status: job.status, totalRows: job.totalRows, successfulRows: job.successfulRows, failedRows: job.failedRows, skippedRows: job.skippedRows, generatedIds: job.generatedIdCount } }).catch(() => undefined);
  }
}

/** Prefixes text a spreadsheet would run as a formula (CSV injection). */
export function spreadsheetSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  return `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
}

export async function generateTemplate(module: AcademicImportModule, format: 'csv' | 'xlsx'): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const definition = moduleDefinition(module);
  const requiredText = definition.requirementNote ?? `Required columns: ${definition.required.join(', ')}.`;
  const instruction = `# WorkGrind ${definition.label} template. ${requiredText} Dates use YYYY-MM-DD. Do not include formulas or credentials. Lines starting with # are ignored.`;
  if (format === 'csv') {
    const lines = [instruction];
    if (definition.fields.some((field) => field.example)) lines.push(`# Example: ${definition.fields.map((field) => field.example ?? '').join(' | ')}`);
    lines.push(definition.headers.join(','));
    return { buffer: Buffer.from(`${lines.join('\n')}\n`, 'utf8'), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(definition.label.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  worksheet.columns = definition.fields.map((field) => ({ header: field.key, key: field.key, width: Math.max(16, field.key.length + 4) }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  definition.fields.forEach((field, index) => {
    const header = worksheet.getRow(1).getCell(index + 1);
    header.note = `${field.label}${field.required ? ' (required)' : ''}. ${field.help}`;
    if (field.required) header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    if (field.values) {
      const column = worksheet.getColumn(index + 1).letter;
      (worksheet as unknown as { dataValidations: { add: (range: string, rule: unknown) => void } }).dataValidations.add(`${column}2:${column}${MAX_IMPORT_ROWS + 1}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`"${field.values.join(',')}"`],
      });
    }
  });
  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [
    { header: 'Column', key: 'key', width: 22 },
    { header: 'Meaning', key: 'label', width: 28 },
    { header: 'Required', key: 'required', width: 12 },
    { header: 'Guidance', key: 'help', width: 80 },
    { header: 'Example', key: 'example', width: 26 },
  ];
  instructions.getRow(1).font = { bold: true };
  for (const field of definition.fields) {
    instructions.addRow({ key: field.key, label: field.label, required: field.required ? 'Yes' : 'No', help: field.help, example: field.example ?? '' });
  }
  instructions.addRow({});
  instructions.addRow({ key: 'Module', label: definition.label, help: definition.description });
  instructions.addRow({ key: 'Rules', help: requiredText });
  instructions.addRow({ key: 'Dates', help: 'Use YYYY-MM-DD or Excel date cells.' });
  instructions.addRow({ key: 'Security', help: 'Do not include formulas, macros, passwords, or credentials.' });
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
}

export function issuesCsv(issues: AcademicImportIssue[]): Buffer {
  return Buffer.from(['rowNumber,field,code,severity,message', ...issues.map((item) => [String(item.rowNumber), item.field ?? '', item.code, item.severity ?? 'error', item.message].map(csvCell).join(','))].join('\n'), 'utf8');
}
