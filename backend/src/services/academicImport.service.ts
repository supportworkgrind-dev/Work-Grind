import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import AcademicAssessment from '../models/AcademicAssessment';
import AcademicAttendance from '../models/AcademicAttendance';
import AcademicClass from '../models/AcademicClass';
import AcademicCourse from '../models/AcademicCourse';
import AcademicDepartment from '../models/AcademicDepartment';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicFeeCharge from '../models/AcademicFeeCharge';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import AcademicImportJob, {
  AcademicImportIssue,
  AcademicImportMode,
  AcademicImportModule,
} from '../models/AcademicImportJob';
import AcademicPerson from '../models/AcademicPerson';
import AcademicResult from '../models/AcademicResult';
import AcademicSchedule from '../models/AcademicSchedule';
import AcademicTeachingAssignment from '../models/AcademicTeachingAssignment';
import AuditLog from '../models/AuditLog';

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_STORED_ISSUES = 5_000;

export const IMPORT_MODULES: Array<{
  id: AcademicImportModule;
  label: string;
  description: string;
  headers: string[];
  required: string[];
}> = [
  { id: 'students', label: 'Students and admissions', description: 'Student profiles keyed by externalId.', headers: ['externalId', 'firstName', 'lastName', 'email'], required: ['externalId', 'firstName', 'lastName'] },
  { id: 'teachers', label: 'Teachers and staff', description: 'Teacher profiles keyed by externalId.', headers: ['externalId', 'firstName', 'lastName', 'email'], required: ['externalId', 'firstName', 'lastName'] },
  { id: 'parents', label: 'Parents and guardians', description: 'Guardian profiles keyed by externalId.', headers: ['externalId', 'firstName', 'lastName', 'email'], required: ['externalId', 'firstName', 'lastName'] },
  { id: 'departments', label: 'Departments / faculties', description: 'Departments keyed by code.', headers: ['code', 'name', 'description'], required: ['code', 'name'] },
  { id: 'courses', label: 'Courses and subjects', description: 'Courses keyed by code and linked to departmentCode.', headers: ['code', 'name', 'departmentCode', 'description', 'credits'], required: ['code', 'name', 'departmentCode'] },
  { id: 'classes', label: 'Classes and sections', description: 'Classes keyed by name and academicYear.', headers: ['name', 'academicYear', 'departmentCode', 'courseCodes'], required: ['name', 'academicYear', 'departmentCode'] },
  { id: 'enrollments', label: 'Student enrollments', description: 'Enroll active students into tenant-owned classes.', headers: ['studentExternalId', 'classId', 'status', 'enrolledAt'], required: ['studentExternalId', 'classId'] },
  { id: 'guardians', label: 'Parent / guardian links', description: 'Explicit links using studentExternalId and guardianExternalId.', headers: ['studentExternalId', 'guardianExternalId', 'relationship'], required: ['studentExternalId', 'guardianExternalId', 'relationship'] },
  { id: 'teaching_assignments', label: 'Teaching assignments', description: 'Assign teachers to tenant-owned classes.', headers: ['teacherExternalId', 'classId'], required: ['teacherExternalId', 'classId'] },
  { id: 'timetables', label: 'Timetables', description: 'Recurring class sessions using classId and optional courseCode.', headers: ['classId', 'courseCode', 'dayOfWeek', 'startTime', 'endTime', 'location', 'validFrom', 'validUntil'], required: ['classId', 'dayOfWeek', 'startTime', 'endTime'] },
  { id: 'attendance', label: 'Attendance', description: 'Attendance for active class enrollments.', headers: ['classId', 'studentExternalId', 'date', 'status', 'note'], required: ['classId', 'studentExternalId', 'date', 'status'] },
  { id: 'assessments', label: 'Examinations and assessments', description: 'Assessments keyed by classId, title, and type.', headers: ['classId', 'courseCode', 'title', 'type', 'scheduledAt', 'pointsPossible'], required: ['classId', 'title', 'type', 'pointsPossible'] },
  { id: 'results', label: 'Examination results', description: 'Results keyed by assessmentId and studentExternalId.', headers: ['assessmentId', 'studentExternalId', 'pointsEarned', 'feedback'], required: ['assessmentId', 'studentExternalId', 'pointsEarned'] },
  { id: 'fees', label: 'Fee charges / challans', description: 'Offline fee charges keyed by invoiceNumber.', headers: ['invoiceNumber', 'studentExternalId', 'description', 'amountMinor', 'currency', 'dueAt'], required: ['invoiceNumber', 'studentExternalId', 'description', 'amountMinor', 'currency'] },
];

type RawRow = { rowNumber: number; values: Record<string, string> };
export type ImportPreview = {
  sheets: string[];
  worksheet?: string;
  headers: string[];
  totalRows: number;
  preview: Array<Record<string, string>>;
  issues: AcademicImportIssue[];
  validRows: number;
  invalidRows: number;
};

type ImportContext = {
  companyId: mongoose.Types.ObjectId;
  people: Map<string, { _id: mongoose.Types.ObjectId; type: string; status: string }>;
  departments: Map<string, { _id: mongoose.Types.ObjectId }>;
  courses: Map<string, { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId }>;
  coursesById: Map<string, { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId }>;
  classes: Map<string, { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId; courseIds: mongoose.Types.ObjectId[] }>;
  classesById: Map<string, { _id: mongoose.Types.ObjectId; departmentId: mongoose.Types.ObjectId; courseIds: mongoose.Types.ObjectId[] }>;
  assessments: Map<string, { _id: mongoose.Types.ObjectId; classId: mongoose.Types.ObjectId; pointsPossible: number }>;
};

function moduleDefinition(module: AcademicImportModule) {
  const definition = IMPORT_MODULES.find((item) => item.id === module);
  if (!definition) throw new Error('Unsupported import module.');
  return definition;
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '').replace(/[\s-]+/g, '_').toLowerCase();
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const candidate = value as { formula?: unknown; result?: unknown };
    if (candidate.formula !== undefined) throw new Error('Formula cells are not accepted. Export values before importing.');
    if (candidate.result !== undefined) return normalizeCell(candidate.result);
  }
  return String(value).trim();
}

function parseCsv(buffer: Buffer): { sheets: string[]; headers: string[]; rows: RawRow[] } {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
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
  if (!contentRows.length) return { sheets: ['CSV'], headers: [], rows: [] };
  const headerRow = contentRows.shift()!.map((value) => value.trim());
  const headers = headerRow.map(normalizeHeader);
  if (contentRows.length > MAX_IMPORT_ROWS) throw new Error(`Import files may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  const parsedRows = contentRows
    .map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, (values[column] ?? '').trim()])),
    }));
  return { sheets: ['CSV'], headers, rows: parsedRows };
}

async function parseWorkbook(buffer: Buffer, filename: string, requestedSheet?: string): Promise<{ sheets: string[]; headers: string[]; rows: RawRow[] }> {
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
    currentRow.eachCell({ includeEmpty: true }, (cell) => values.push(normalizeCell(cell.value)));
    if (values.some((value) => value.trim())) matrix.push(values);
  });
  if (!matrix.length) return { sheets, headers: [], rows: [] };
  const headers = matrix.shift()!.map(normalizeHeader);
  const dataRows = matrix.filter((values) => !values[0]?.trim().startsWith('#'));
  if (dataRows.length > MAX_IMPORT_ROWS) throw new Error(`Import files may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  const rows = dataRows
    .map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, (values[column] ?? '').trim()])),
    }));
  return { sheets, headers, rows };
}

async function buildContext(companyId: mongoose.Types.ObjectId): Promise<ImportContext> {
  const [people, departments, courses, classes, assessments] = await Promise.all([
    AcademicPerson.find({ companyId }).select('_id type status externalId').lean(),
    AcademicDepartment.find({ companyId }).select('_id code').lean(),
    AcademicCourse.find({ companyId }).select('_id code departmentId').lean(),
    AcademicClass.find({ companyId }).select('_id name academicYear departmentId courseIds').lean(),
    AcademicAssessment.find({ companyId }).select('_id classId pointsPossible').lean(),
  ]);
  return {
    companyId,
    people: new Map(people.filter((person) => person.externalId).map((person) => [String(person.externalId).toUpperCase(), person])),
    departments: new Map(departments.map((department) => [department.code.toUpperCase(), department])),
    courses: new Map(courses.map((course) => [course.code.toUpperCase(), course])),
    coursesById: new Map(courses.map((course) => [course._id.toString(), course])),
    classes: new Map(classes.map((academicClass) => [`${academicClass.name.toUpperCase()}::${academicClass.academicYear.toUpperCase()}`, academicClass])),
    classesById: new Map(classes.map((academicClass) => [academicClass._id.toString(), academicClass])),
    assessments: new Map(assessments.map((assessment) => [assessment._id.toString(), assessment])),
  };
}

function issue(rowNumber: number, field: string | undefined, code: string, message: string): AcademicImportIssue {
  return { rowNumber, ...(field ? { field } : {}), code, message };
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

function validEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function objectId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

function getPerson(context: ImportContext, externalId: string, type: string) {
  const person = context.people.get(externalId.toUpperCase());
  return person && person.type === type && person.status === 'active' ? person : null;
}

async function validateRow(module: AcademicImportModule, row: RawRow, context: ImportContext): Promise<{ issues: AcademicImportIssue[]; key?: string }> {
  const definition = moduleDefinition(module);
  const issues = requiredIssues(definition, row);
  const value = (field: string) => row.values[normalizeHeader(field)] ?? '';
  if (issues.length) return { issues };
  if (['students', 'teachers', 'parents'].includes(module)) {
    if (!validEmail(value('email'))) issues.push(issue(row.rowNumber, 'email', 'invalid_email', 'Email format is invalid.'));
    return { issues, key: value('externalId').toUpperCase() };
  }
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
    if (!getPerson(context, value('studentExternalId'), 'student')) issues.push(issue(row.rowNumber, 'studentExternalId', 'unknown_reference', 'Active student externalId was not found in this workspace.'));
    if (!context.classesById.has(value('classId'))) issues.push(issue(row.rowNumber, 'classId', 'unknown_reference', 'classId does not belong to this workspace.'));
    if (value('status') && !['active', 'completed', 'withdrawn'].includes(value('status'))) issues.push(issue(row.rowNumber, 'status', 'invalid_value', 'Status must be active, completed, or withdrawn.'));
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

export async function previewImport(
  buffer: Buffer,
  filename: string,
  module: AcademicImportModule,
  companyId: mongoose.Types.ObjectId,
  worksheet?: string,
): Promise<ImportPreview> {
  const definition = moduleDefinition(module);
  const parsed = await parseWorkbook(buffer, filename, worksheet);
  const requiredHeaders = definition.required.map(normalizeHeader);
  const duplicateHeaders = [...new Set(parsed.headers.filter((header, index) => parsed.headers.indexOf(header) !== index))];
  const headerIssues = requiredHeaders
    .filter((header) => !parsed.headers.includes(header))
    .map((header) => issue(1, header, 'missing_header', `Required column ${header} is missing.`));
  const duplicateHeaderIssues = duplicateHeaders.map((header) => issue(1, header, 'duplicate_header', `Column ${header} appears more than once.`));
  if (headerIssues.length || duplicateHeaderIssues.length || !parsed.headers.length) {
    const issues = [...headerIssues, ...duplicateHeaderIssues];
    return { sheets: parsed.sheets, worksheet: worksheet || parsed.sheets[0], headers: parsed.headers, totalRows: parsed.rows.length, preview: [], issues: issues.length ? issues : [issue(1, undefined, 'empty_file', 'The file contains no header row or data.')], validRows: 0, invalidRows: parsed.rows.length || 0 };
  }
  const context = await buildContext(companyId);
  const issues: AcademicImportIssue[] = [];
  const seen = new Set<string>();
  let validRows = 0;
  for (const row of parsed.rows) {
    const result = await validateRow(module, row, context);
    if (result.key) {
      if (seen.has(result.key)) result.issues.push(issue(row.rowNumber, undefined, 'duplicate_upload', 'The stable matching key is duplicated in this upload.'));
      seen.add(result.key);
    }
    if (result.issues.length) issues.push(...result.issues);
    else validRows += 1;
    if (issues.length >= MAX_STORED_ISSUES) break;
  }
  return {
    sheets: parsed.sheets,
    worksheet: worksheet || parsed.sheets[0],
    headers: parsed.headers,
    totalRows: parsed.rows.length,
    preview: parsed.rows.slice(0, 25).map((row) => row.values),
    issues,
    validRows,
    invalidRows: parsed.rows.length - validRows,
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

async function writeRow(module: AcademicImportModule, row: RawRow, context: ImportContext, userId: mongoose.Types.ObjectId, mode: AcademicImportMode): Promise<'created' | 'updated' | 'skipped'> {
  const value = (field: string) => rowValue(row, field);
  if (module === 'students' || module === 'teachers' || module === 'parents') {
    const type = module === 'students' ? 'student' : module === 'teachers' ? 'teacher' : 'parent';
    const existing = await AcademicPerson.findOne({ companyId: context.companyId, externalId: value('externalId') }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching externalId does not exist.');
    const payload = { type, firstName: value('firstName'), lastName: value('lastName'), ...(value('email') ? { email: value('email') } : {}) };
    if (existing) { await AcademicPerson.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicPerson.create({ companyId: context.companyId, externalId: value('externalId'), ...payload }); return 'created';
  }
  if (module === 'departments') {
    const existing = await AcademicDepartment.findOne({ companyId: context.companyId, code: value('code').toUpperCase() }).select('_id');
    if (existing && (mode === 'create_only' || mode === 'skip_duplicates')) return 'skipped';
    if (!existing && mode === 'update_only') throw new Error('Matching department code does not exist.');
    const payload = { name: value('name'), ...(value('description') ? { description: value('description') } : {}) };
    if (existing) { await AcademicDepartment.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicDepartment.create({ companyId: context.companyId, code: value('code'), ...payload }); return 'created';
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
    const payload = { status: value('status') || 'active', ...(value('enrolledAt') ? { enrolledAt: validDate(value('enrolledAt'))! } : {}) };
    if (existing) { await AcademicEnrollment.updateOne({ _id: existing._id, companyId: context.companyId }, { $set: payload }); return 'updated'; }
    await AcademicEnrollment.create({ companyId: context.companyId, studentId: student!._id, classId, ...payload }); return 'created';
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

export async function executeImport(options: {
  buffer: Buffer;
  filename: string;
  worksheet?: string;
  module: AcademicImportModule;
  mode: AcademicImportMode;
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  job: InstanceType<typeof AcademicImportJob>;
}): Promise<void> {
  const parsed = await parseWorkbook(options.buffer, options.filename, options.worksheet);
  const context = await buildContext(options.companyId);
  const job = options.job;
  job.status = 'processing'; job.startedAt = new Date(); job.totalRows = parsed.rows.length; await job.save();
  const seen = new Set<string>();
  for (const row of parsed.rows) {
    try {
      const validation = await validateRow(options.module, row, context);
      if (validation.key && seen.has(validation.key)) validation.issues.push(issue(row.rowNumber, undefined, 'duplicate_upload', 'The stable matching key is duplicated in this upload.'));
      if (validation.key) seen.add(validation.key);
      if (validation.issues.length) {
        job.failedRows += 1; job.issues.push(...validation.issues.slice(0, MAX_STORED_ISSUES - job.issues.length));
      } else {
        const result = await writeRow(options.module, row, context, options.userId, options.mode);
        if (result === 'skipped') job.skippedRows += 1; else job.successfulRows += 1;
      }
    } catch (error) {
      job.failedRows += 1;
      if (job.issues.length < MAX_STORED_ISSUES) job.issues.push(issue(row.rowNumber, undefined, 'write_failed', error instanceof Error ? error.message : 'The row could not be imported.'));
    }
    job.processedRows += 1;
    if (job.processedRows % 50 === 0) await job.save();
  }
  job.status = job.failedRows ? 'completed_with_errors' : 'completed';
  job.completedAt = new Date();
  await job.save();
  await AuditLog.create({ companyId: options.companyId, userId: options.userId, action: 'academic.import.completed', resource: 'academic_import', resourceId: job._id.toString(), details: { module: options.module, status: job.status, totalRows: job.totalRows, successfulRows: job.successfulRows, failedRows: job.failedRows, skippedRows: job.skippedRows } });
}

export async function generateTemplate(module: AcademicImportModule, format: 'csv' | 'xlsx'): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const definition = moduleDefinition(module);
  const instruction = `# WorkGrind ${definition.label} template. Required columns: ${definition.required.join(', ')}. Do not include formulas or credentials.`;
  if (format === 'csv') {
    const csv = `${instruction}\n${definition.headers.join(',')}\n`;
    return { buffer: Buffer.from(csv, 'utf8'), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(definition.label.slice(0, 31));
  worksheet.addRow(definition.headers);
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.columns = definition.headers.map((header) => ({ header, key: header, width: Math.max(16, header.length + 2) }));
  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow(['Module', definition.label]);
  instructions.addRow(['Required columns', definition.required.join(', ')]);
  instructions.addRow(['Notes', definition.description]);
  instructions.addRow(['Security', 'Do not include formulas, macros, passwords, or credentials.']);
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
}

export function issuesCsv(issues: AcademicImportIssue[]): Buffer {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return Buffer.from(['rowNumber,field,code,message', ...issues.map((item) => [item.rowNumber, item.field ?? '', item.code, item.message].map((value) => escape(String(value))).join(','))].join('\n'), 'utf8');
}
