const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const AcademicPerson = require('../dist/models/AcademicPerson').default;
const AcademicDepartment = require('../dist/models/AcademicDepartment').default;
const AcademicCourse = require('../dist/models/AcademicCourse').default;
const AcademicClass = require('../dist/models/AcademicClass').default;
const AcademicAssessment = require('../dist/models/AcademicAssessment').default;
const AcademicEnrollment = require('../dist/models/AcademicEnrollment').default;
const AcademicGuardianLink = require('../dist/models/AcademicGuardianLink').default;
const AcademicImportJob = require('../dist/models/AcademicImportJob').default;
const AcademicImportLock = require('../dist/models/AcademicImportLock').default;
const AcademicSequence = require('../dist/models/AcademicSequence').default;
const AcademicSettings = require('../dist/models/AcademicSettings').default;
const AuditLog = require('../dist/models/AuditLog').default;
const importService = require('../dist/services/academicImport.service');

const companyId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

function query(rows) {
  return {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => rows,
  };
}

function single(value) {
  return {
    select() { return this; },
    sort() { return this; },
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function replace(model, name, implementation) {
  const original = model[name];
  model[name] = implementation;
  return () => { model[name] = original; };
}

function contextMocks({ people = [], departments = [], courses = [], classes = [], settings = null } = {}) {
  return [
    replace(AcademicPerson, 'find', () => query(people)),
    replace(AcademicDepartment, 'find', () => query(departments)),
    replace(AcademicCourse, 'find', () => query(courses)),
    replace(AcademicClass, 'find', () => query(classes)),
    replace(AcademicAssessment, 'find', () => query([])),
    replace(AcademicEnrollment, 'find', () => query([])),
    replace(AcademicSettings, 'findOne', () => single(settings)),
    replace(AcademicImportJob, 'findOne', () => single(null)),
  ];
}

function restoreAll(restore) {
  restore.reverse().forEach((undo) => undo());
}

function newJob(module = 'students', mode = 'create_only') {
  const job = new AcademicImportJob({ _id: new mongoose.Types.ObjectId(), companyId, initiatedBy: userId, module, mode, originalFilename: `${module}.csv` });
  const saved = [];
  job.save = async function save() { saved.push({ status: this.status, processedRows: this.processedRows }); return this; };
  return { job, saved };
}

const allowCapacity = (_type, create) => create();

test('student templates list every supported profile field with required-field guidance', async () => {
  const csv = await importService.generateTemplate('students', 'csv');
  const csvText = csv.buffer.toString('utf8');
  assert.match(csvText, /^# WorkGrind Students and admissions template/);
  assert.match(csvText, /Provide firstName and lastName, or fullName/);
  const headerLine = csvText.split('\n').find((line) => !line.startsWith('#'));
  for (const header of ['externalId', 'fullName', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'admissionDate', 'className', 'section', 'academicYear', 'rollNumber', 'departmentCode', 'courseCode', 'enrollmentStatus', 'status', 'address', 'guardianName', 'guardianEmail', 'guardianPhone', 'guardianRelationship']) {
    assert.ok(headerLine.split(',').includes(header), `missing ${header}`);
  }
  assert.equal(csv.contentType, 'text/csv; charset=utf-8');

  const xlsx = await importService.generateTemplate('students', 'xlsx');
  assert.equal(xlsx.extension, 'xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx.buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Students and admissions', 'Instructions']);
  assert.equal(workbook.worksheets[0].getRow(2).cellCount, 0, 'the data sheet must not contain sample records');
  const instructions = [];
  workbook.getWorksheet('Instructions').eachRow((row) => instructions.push(row.getCell(1).value));
  assert.ok(instructions.includes('guardianPhone'));
});

test('column mapping suggestions match human headers and aliases', () => {
  const definition = importService.moduleDefinition('students');
  const headers = ['student_id', 'student_name', 'e_mail_address', 'dob', 'class', 'sec', 'roll_no', 'father_name', 'parent_phone', 'unrelated'];
  const labels = ['Student ID', 'Student Name', 'Email Address', 'DOB', 'Class', 'Sec', 'Roll No', 'Father Name', 'Parent Phone', 'Unrelated'];
  const mapping = importService.suggestMapping(definition, headers, labels);
  assert.equal(mapping.externalId, 'student_id');
  assert.equal(mapping.fullName, 'student_name');
  assert.equal(mapping.email, 'e_mail_address');
  assert.equal(mapping.dateOfBirth, 'dob');
  assert.equal(mapping.className, 'class');
  assert.equal(mapping.section, 'sec');
  assert.equal(mapping.rollNumber, 'roll_no');
  assert.equal(mapping.guardianPhone, 'parent_phone');
  assert.equal(mapping.guardianName, null, 'an unknown header is never guessed');
});

test('academic import preview handles UTF-8 Urdu text and duplicate stable identifiers', async () => {
  const restore = contextMocks();
  try {
    const csv = Buffer.from([
      'externalId,firstName,lastName,email',
      'STU-1,عائشہ,خان,aisha@example.edu',
      'STU-1,Another,Student,another@example.edu',
    ].join('\n'), 'utf8');
    const preview = await importService.previewImport(csv, 'students.csv', 'students', companyId);
    assert.equal(preview.totalRows, 2);
    assert.equal(preview.validRows, 1);
    assert.equal(preview.invalidRows, 1);
    assert.equal(preview.issues[0].code, 'duplicate_upload');
    assert.equal(preview.previewRows[0].values.firstName, 'عائشہ');
    assert.equal(preview.previewRows[0].action, 'create');
    assert.equal(preview.previewRows[1].action, 'error');
  } finally {
    restoreAll(restore);
  }
});

test('preview validates student fields, guardians, classes and duplicates without writing', async () => {
  const departmentId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();
  const existingStudent = { _id: new mongoose.Types.ObjectId(), type: 'student', status: 'active', externalId: 'STU-000009', email: 'taken@example.edu', firstName: 'Sara', lastName: 'Ali', dateOfBirth: new Date('2012-01-05T00:00:00Z') };
  const existingTeacher = { _id: new mongoose.Types.ObjectId(), type: 'teacher', status: 'active', externalId: 'TCH-1', firstName: 'Omar', lastName: 'Raza' };
  const restore = contextMocks({
    people: [existingStudent, existingTeacher],
    departments: [{ _id: departmentId, code: 'SCI' }],
    classes: [{ _id: classId, name: 'Grade 7-A', academicYear: '2026-2027', departmentId, courseIds: [] }],
  });
  const writes = [replace(AcademicPerson, 'create', async () => { throw new Error('preview must not write'); })];
  try {
    const csv = Buffer.from([
      'Student Name,Email,DOB,Class,Section,Academic Year,Roll No,Guardian Name,Guardian Phone,Student ID',
      'Ayesha Khan,ayesha@example.edu,2012-04-23,Grade 7,A,2026-2027,07,Imran Khan,+92 300 7654321,',
      'Bilal Ahmed,taken@example.edu,2012-02-01,,,,,,,',
      'Sara Ali,,2012-01-05,,,,,,,',
      'Hina Noor,hina@example.edu,23/04/2012,,,,,,,',
      'Zain Malik,,,,,,12,,,',
      'Sana Iqbal,,,,,,,Only,,',
      'Teacher Clash,,,,,,,,,TCH-1',
      'Sara Ali,,,,,,,,,',
      'Ayesha Twin,ayesha@example.edu,,,,,,,,',
    ].join('\n'), 'utf8');
    const preview = await importService.previewImport(csv, 'students.csv', 'students', companyId);
    const codesByRow = new Map();
    for (const item of preview.issues) codesByRow.set(item.rowNumber, [...(codesByRow.get(item.rowNumber) ?? []), item.code]);
    assert.equal(preview.previewRows[0].action, 'create', JSON.stringify(preview.issues.filter((item) => item.rowNumber === 2)));
    assert.deepEqual(preview.previewRows[0].generated.sort(), ['externalId', 'guardianId']);
    assert.ok(codesByRow.get(3).includes('duplicate_email'));
    assert.ok(codesByRow.get(4).includes('possible_duplicate'));
    assert.ok(codesByRow.get(5).includes('invalid_date'), 'ambiguous day/month dates are rejected');
    assert.ok(codesByRow.get(6).includes('invalid_relationship'), 'roll numbers need a class');
    assert.ok(codesByRow.get(7).includes('guardian_unmatchable'));
    assert.ok(codesByRow.get(8).includes('type_conflict'));
    assert.deepEqual(codesByRow.get(9), ['possible_duplicate'], 'a name-only match is a warning, never an automatic merge');
    assert.equal(preview.issues.find((item) => item.rowNumber === 9).severity, 'warning');
    assert.ok(codesByRow.get(10).includes('duplicate_upload'), 'emails must be unique within the upload');
    assert.equal(preview.validRows, 2);
    assert.equal(preview.generatedIds, 2);
    assert.equal(preview.warningCount, 1);
  } finally {
    restoreAll([...restore, ...writes]);
  }
});

test('update-only imports never create records without an existing ID', async () => {
  const restore = contextMocks();
  try {
    const preview = await importService.previewImport(Buffer.from('fullName\nNew Student\n'), 'students.csv', 'students', companyId, undefined, { mode: 'update_only' });
    assert.equal(preview.validRows, 0);
    assert.equal(preview.issues[0].code, 'not_found');
  } finally {
    restoreAll(restore);
  }
});

test('explicit column mappings are validated against the uploaded file', async () => {
  const restore = contextMocks();
  try {
    const preview = await importService.previewImport(Buffer.from('Name\nAyesha Khan\n'), 'students.csv', 'students', companyId, undefined, { mapping: { fullName: 'not_in_file' } });
    assert.ok(preview.issues.some((item) => item.code === 'unknown_column'));
    assert.equal(preview.validRows, 0);
  } finally {
    restoreAll(restore);
  }
});

test('academic import preview rejects cross-tenant academic references', async () => {
  const restore = contextMocks();
  try {
    const csv = Buffer.from('studentExternalId,classId\nSTU-1,507f1f77bcf86cd799439011\n', 'utf8');
    const preview = await importService.previewImport(csv, 'enrollments.csv', 'enrollments', companyId);
    assert.equal(preview.validRows, 0);
    assert.ok(preview.issues.some((item) => item.code === 'unknown_reference' && item.field === 'studentExternalId'));
    assert.ok(preview.issues.some((item) => item.code === 'unknown_reference' && item.field === 'classId'));
  } finally {
    restoreAll(restore);
  }
});

test('academic import execution creates tenant-scoped people and records progress', async () => {
  const created = [];
  const restore = [
    ...contextMocks(),
    replace(AcademicPerson, 'create', async (payload) => { created.push(payload); return { _id: new mongoose.Types.ObjectId(), ...payload }; }),
    replace(AcademicImportLock, 'updateOne', async () => ({})),
    replace(AuditLog, 'create', async () => ({})),
  ];
  const { job, saved } = newJob();
  try {
    await importService.executeImport({
      buffer: Buffer.from('externalId,firstName,lastName\nSTU-1,عائشہ,خان\nSTU-2,Ali,Rehman\n', 'utf8'),
      filename: 'students.csv',
      module: 'students',
      mode: 'create_only',
      companyId,
      userId,
      job,
      capacity: allowCapacity,
    });
    assert.equal(job.status, 'completed');
    assert.equal(job.totalRows, 2);
    assert.equal(job.successfulRows, 2);
    assert.equal(job.failedRows, 0);
    assert.equal(job.personIds.length, 2);
    assert.ok(created.every((payload) => payload.companyId === companyId && payload.type === 'student'));
    assert.ok(saved.some((state) => state.status === 'completed' && state.processedRows === 2));
  } finally {
    restoreAll(restore);
  }
});

test('missing student IDs and roll numbers are generated from atomic institution counters', async () => {
  const departmentId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();
  const counters = new Map();
  const people = [];
  const enrollments = [];
  const links = [];
  const restore = [
    ...contextMocks({
      departments: [{ _id: departmentId, code: 'SCI' }],
      classes: [{ _id: classId, name: 'Grade 7 A', academicYear: '2026-2027', departmentId, courseIds: [] }],
      settings: { studentIdPrefix: 'GHS', parentIdPrefix: 'GRD', teacherIdPrefix: 'TCH', idPadding: 4, rollNumberMode: 'sequential_per_class', rollNumberPadding: 2 },
    }),
    replace(AcademicSequence, 'findOneAndUpdate', (filter, update) => {
      assert.deepEqual(update, { $inc: { value: 1 } });
      const value = (counters.get(filter.key) ?? 0) + 1;
      counters.set(filter.key, value);
      return single({ value });
    }),
    replace(AcademicPerson, 'exists', async () => null),
    replace(AcademicEnrollment, 'exists', async () => null),
    replace(AcademicPerson, 'create', async (payload) => { const record = { _id: new mongoose.Types.ObjectId(), ...payload }; people.push(record); return record; }),
    replace(AcademicGuardianLink, 'findOne', () => single(null)),
    replace(AcademicGuardianLink, 'create', async (payload) => { links.push(payload); return { _id: new mongoose.Types.ObjectId(), ...payload }; }),
    replace(AcademicEnrollment, 'findOne', () => single(null)),
    replace(AcademicEnrollment, 'create', async (payload) => { enrollments.push(payload); return { _id: new mongoose.Types.ObjectId(), ...payload }; }),
    replace(AcademicImportLock, 'updateOne', async () => ({})),
    replace(AuditLog, 'create', async () => ({})),
  ];
  const { job } = newJob();
  try {
    await importService.executeImport({
      buffer: Buffer.from([
        'fullName,className,section,academicYear,admissionDate,guardianName,guardianPhone,guardianRelationship',
        'Ayesha Khan,Grade 7,A,2026-2027,2026-04-01,Imran Khan,+92 300 7654321,father',
        'Omar Khan,Grade 7,A,2026-2027,,Imran Khan,+92 300 7654321,father',
      ].join('\n')),
      filename: 'students.csv',
      module: 'students',
      mode: 'create_only',
      companyId,
      userId,
      job,
      capacity: allowCapacity,
    });
    assert.equal(job.status, 'completed', JSON.stringify(job.issues));
    const students = people.filter((person) => person.type === 'student');
    const guardians = people.filter((person) => person.type === 'parent');
    assert.deepEqual(students.map((person) => person.externalId), ['GHS-0001', 'GHS-0002']);
    assert.equal(guardians.length, 1, 'the shared guardian is matched by phone instead of duplicated');
    assert.equal(guardians[0].externalId, 'GRD-0001');
    assert.equal(links.length, 2);
    assert.ok(links.every((link) => link.relationship === 'parent'));
    assert.deepEqual(enrollments.map((enrollment) => enrollment.rollNumber), ['01', '02']);
    assert.ok(enrollments.every((enrollment) => enrollment.classId.toString() === classId.toString()));
    assert.equal(enrollments[0].enrolledAt.toISOString(), '2026-04-01T00:00:00.000Z');
    assert.equal(job.generatedIdCount, 2);
  } finally {
    restoreAll(restore);
  }
});

test('a failure after a student is created removes that student so no partial record remains', async () => {
  const deleted = [];
  const restore = [
    ...contextMocks(),
    replace(AcademicPerson, 'create', async (payload) => ({ _id: new mongoose.Types.ObjectId(), ...payload })),
    replace(AcademicPerson, 'deleteOne', async (filter) => { deleted.push(filter); return { deletedCount: 1 }; }),
    replace(AcademicGuardianLink, 'findOne', () => single(null)),
    replace(AcademicGuardianLink, 'create', async () => { throw new Error('link write failed'); }),
    replace(AcademicImportLock, 'updateOne', async () => ({})),
    replace(AuditLog, 'create', async () => ({})),
  ];
  const { job } = newJob();
  try {
    await importService.executeImport({
      buffer: Buffer.from('externalId,fullName,guardianId,guardianName,guardianEmail\nSTU-7,Ayesha Khan,GRD-7,Imran Khan,imran@example.com\n'),
      filename: 'students.csv',
      module: 'students',
      mode: 'create_only',
      companyId,
      userId,
      job,
      capacity: allowCapacity,
    });
    assert.equal(job.status, 'completed_with_errors');
    assert.equal(job.failedRows, 1);
    assert.equal(job.successfulRows, 0);
    assert.equal(deleted.length, 2, 'both the student and the new guardian are rolled back');
    assert.ok(deleted.every((filter) => filter.companyId === companyId));
    assert.equal(job.personIds.length, 0);
  } finally {
    restoreAll(restore);
  }
});

test('plan limits stop imported student creation with a row error', async () => {
  const restore = [
    ...contextMocks(),
    replace(AcademicImportLock, 'updateOne', async () => ({})),
    replace(AuditLog, 'create', async () => ({})),
  ];
  const { job } = newJob();
  try {
    await importService.executeImport({
      buffer: Buffer.from('externalId,fullName\nSTU-1,Ayesha Khan\n'),
      filename: 'students.csv',
      module: 'students',
      mode: 'create_only',
      companyId,
      userId,
      job,
      capacity: async () => {
        const error = new Error('Student limit reached (50 on Starter plan).');
        error.name = 'ImportRowError';
        throw Object.assign(error, { code: 'plan_limit' });
      },
    });
    assert.equal(job.failedRows, 1);
    assert.match(job.issues[0].message, /Student limit reached/);
  } finally {
    restoreAll(restore);
  }
});

test('academic import job schema requires a tenant and preserves sanitized history fields', () => {
  const invalid = new AcademicImportJob({ module: 'students', mode: 'create_only', originalFilename: 'students.csv' });
  assert.equal(invalid.validateSync().errors.companyId.kind, 'required');
  const valid = new AcademicImportJob({ companyId, initiatedBy: userId, module: 'students', mode: 'create_only', originalFilename: 'students.csv' });
  assert.equal(valid.validateSync(), undefined);
});

test('academic import error reports are CSV-safe and neutralize spreadsheet formulas', () => {
  const output = importService.issuesCsv([
    { rowNumber: 2, field: 'firstName', code: 'invalid', message: 'Contains, a "quoted" value' },
    { rowNumber: 3, field: 'courseCodes', code: 'unknown_reference', message: '=HYPERLINK("http://evil")' },
  ]).toString('utf8');
  assert.match(output, /"Contains, a ""quoted"" value"/);
  assert.match(output, /"'=HYPERLINK/);
  assert.equal(importService.spreadsheetSafe('+92 300'), "'+92 300");
  assert.equal(importService.spreadsheetSafe('Ayesha'), 'Ayesha');
});

test('identifier settings reject unsafe prefixes and unsupported roll number formats', () => {
  const { parseIdentifierSettings, formatSequenceId } = require('../dist/services/academicIdentifiers');
  assert.match(parseIdentifierSettings({ studentIdPrefix: 'S T' }).error, /prefixes/);
  assert.match(parseIdentifierSettings({ rollNumberMode: 'random' }).error, /roll number/);
  assert.deepEqual(parseIdentifierSettings({ studentIdPrefix: 'ghs', idPadding: 5 }).settings, { studentIdPrefix: 'GHS', idPadding: 5 });
  assert.equal(formatSequenceId('STU', 42, 6), 'STU-000042');
});
