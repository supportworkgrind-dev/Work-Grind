const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AcademicPerson = require('../dist/models/AcademicPerson').default;
const AcademicDepartment = require('../dist/models/AcademicDepartment').default;
const AcademicCourse = require('../dist/models/AcademicCourse').default;
const AcademicClass = require('../dist/models/AcademicClass').default;
const AcademicAssessment = require('../dist/models/AcademicAssessment').default;
const AcademicSchedule = require('../dist/models/AcademicSchedule').default;
const AcademicImportJob = require('../dist/models/AcademicImportJob').default;
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

function replace(model, name, implementation) {
  const original = model[name];
  model[name] = implementation;
  return () => { model[name] = original; };
}

function emptyContextMocks() {
  return [
    replace(AcademicPerson, 'find', () => query([])),
    replace(AcademicDepartment, 'find', () => query([])),
    replace(AcademicCourse, 'find', () => query([])),
    replace(AcademicClass, 'find', () => query([])),
    replace(AcademicAssessment, 'find', () => query([])),
  ];
}

test('academic import templates include real CSV and XLSX structures without records', async () => {
  const csv = await importService.generateTemplate('students', 'csv');
  const csvText = csv.buffer.toString('utf8');
  assert.match(csvText, /^# WorkGrind Students and admissions template/);
  assert.match(csvText, /externalId,firstName,lastName,email/);
  assert.equal(csv.contentType, 'text/csv; charset=utf-8');

  const xlsx = await importService.generateTemplate('students', 'xlsx');
  assert.equal(xlsx.extension, 'xlsx');
  assert.ok(xlsx.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])));
});

test('academic import preview handles UTF-8 Urdu text and duplicate stable identifiers', async () => {
  const restore = emptyContextMocks();
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
    assert.equal(preview.preview[0].firstname, 'عائشہ');
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('academic import preview rejects cross-tenant academic references', async () => {
  const restore = emptyContextMocks();
  try {
    const csv = Buffer.from('studentExternalId,classId\nSTU-1,507f1f77bcf86cd799439011\n', 'utf8');
    const preview = await importService.previewImport(csv, 'enrollments.csv', 'enrollments', companyId);
    assert.equal(preview.validRows, 0);
    assert.ok(preview.issues.some((item) => item.code === 'unknown_reference' && item.field === 'studentExternalId'));
    assert.ok(preview.issues.some((item) => item.code === 'unknown_reference' && item.field === 'classId'));
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('academic import execution creates tenant-scoped people and records progress', async () => {
  const restore = [
    ...emptyContextMocks(),
    replace(AcademicPerson, 'findOne', () => ({ select: async () => null })),
    replace(AcademicPerson, 'create', async (payload) => ({ _id: new mongoose.Types.ObjectId(), ...payload })),
    replace(AuditLog, 'create', async () => ({})),
  ];
  const saved = [];
  const job = new AcademicImportJob({
    _id: new mongoose.Types.ObjectId(),
    companyId,
    initiatedBy: userId,
    module: 'students',
    mode: 'create_only',
    originalFilename: 'students.csv',
  });
  job.save = async function save() { saved.push({ status: this.status, processedRows: this.processedRows }); return this; };
  try {
    await importService.executeImport({
      buffer: Buffer.from('externalId,firstName,lastName\nSTU-1,عائشہ,خان\nSTU-2,Ali,Rehman\n', 'utf8'),
      filename: 'students.csv',
      module: 'students',
      mode: 'create_only',
      companyId,
      userId,
      job,
    });
    assert.equal(job.status, 'completed');
    assert.equal(job.totalRows, 2);
    assert.equal(job.successfulRows, 2);
    assert.equal(job.failedRows, 0);
    assert.ok(saved.some((state) => state.status === 'completed' && state.processedRows === 2));
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('academic import job schema requires a tenant and preserves sanitized history fields', () => {
  const invalid = new AcademicImportJob({ module: 'students', mode: 'create_only', originalFilename: 'students.csv' });
  assert.equal(invalid.validateSync().errors.companyId.kind, 'required');
  const valid = new AcademicImportJob({ companyId, initiatedBy: userId, module: 'students', mode: 'create_only', originalFilename: 'students.csv' });
  assert.equal(valid.validateSync(), undefined);
});

test('academic import error reports are CSV-safe', () => {
  const output = importService.issuesCsv([{ rowNumber: 2, field: 'firstName', code: 'invalid', message: 'Contains, a "quoted" value' }]).toString('utf8');
  assert.match(output, /"Contains, a ""quoted"" value"/);
});
