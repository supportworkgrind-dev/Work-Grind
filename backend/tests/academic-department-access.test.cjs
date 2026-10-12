const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AcademicDepartment = require('../dist/models/AcademicDepartment').default;
const AcademicCourse = require('../dist/models/AcademicCourse').default;
const AcademicClass = require('../dist/models/AcademicClass').default;
const AcademicEnrollment = require('../dist/models/AcademicEnrollment').default;
const AcademicTeachingAssignment = require('../dist/models/AcademicTeachingAssignment').default;
const AcademicAssessment = require('../dist/models/AcademicAssessment').default;
const AcademicGuardianLink = require('../dist/models/AcademicGuardianLink').default;
const User = require('../dist/models/User').default;
const AuditLog = require('../dist/models/AuditLog').default;
const { updateAcademicRecord, listClasses } = require('../dist/controllers/academic.controller');
const { requireAssignedAcademicDepartment } = require('../dist/middleware/academicDepartmentAccess');

const companyId = new mongoose.Types.ObjectId();
const departmentId = new mongoose.Types.ObjectId();
const otherDepartmentId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const classId = new mongoose.Types.ObjectId();
const otherClassId = new mongoose.Types.ObjectId();
const courseId = new mongoose.Types.ObjectId();
const studentId = new mongoose.Types.ObjectId();
const crossDepartmentStudentId = new mongoose.Types.ObjectId();
const teacherId = new mongoose.Types.ObjectId();
const guardianId = new mongoose.Types.ObjectId();
const assessmentId = new mongoose.Types.ObjectId();

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function replace(model, key, implementation) {
  const original = model[key];
  model[key] = implementation;
  return () => { model[key] = original; };
}

function query(rows) {
  return {
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    populate() { return this; },
    lean: async () => rows,
  };
}

function selected(rows) {
  return { select: () => ({ lean: async () => rows }) };
}

test('department schema persists optional dean and HOD assignments', () => {
  const department = new AcademicDepartment({ companyId, name: 'Science', code: 'SCI' });
  assert.deepEqual(department.authorizedDeanUserIds, []);
  assert.deepEqual(department.authorizedHodUserIds, []);
  assert.equal(department.validateSync(), undefined);
});

test('Dean cannot assign themselves or edit department assignments through academic CRUD', async () => {
  const res = response();
  await updateAcademicRecord({
    params: { resource: 'departments', id: departmentId.toString() },
    user: { companyId: companyId.toString(), userId: userId.toString(), role: 'dean' },
    body: { authorizedDeanUserIds: [userId.toString()] },
  }, res);
  assert.equal(res.statusCode, 403);
});

test('trusted principal can assign only active university Dean/HOD members', async () => {
  const deanId = new mongoose.Types.ObjectId();
  const originalUserFind = User.find;
  const originalDepartmentUpdate = AcademicDepartment.findOneAndUpdate;
  const originalAuditCreate = AuditLog.create;
  let updateFilter;
  let updateValues;
  User.find = (filter) => {
    assert.equal(filter.companyId.toString(), companyId.toString());
    return {
      select: () => ({
        lean: async () => [{ _id: deanId, role: 'dean' }],
      }),
    };
  };
  AcademicDepartment.findOneAndUpdate = (filter, update) => {
    updateFilter = filter;
    updateValues = update.$set;
    return { select: async () => ({ _id: departmentId }) };
  };
  AuditLog.create = async () => ({});
  try {
    const res = response();
    await updateAcademicRecord({
      params: { resource: 'departments', id: departmentId.toString() },
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'principal' },
      body: { authorizedDeanUserIds: [deanId.toString()] },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(updateFilter._id.toString(), departmentId.toString());
    assert.deepEqual(updateValues.authorizedDeanUserIds, [deanId]);
  } finally {
    User.find = originalUserFind;
    AcademicDepartment.findOneAndUpdate = originalDepartmentUpdate;
    AuditLog.create = originalAuditCreate;
  }
});

test('unassigned HOD is denied and an assigned Dean cannot mutate a class in another department', async () => {
  const restore = [
    replace(AcademicDepartment, 'find', () => ({ select: () => ({ lean: async () => [{ _id: departmentId }] }) })),
    replace(AcademicCourse, 'distinct', async () => [courseId]),
    replace(AcademicClass, 'distinct', async () => [classId]),
    replace(AcademicEnrollment, 'distinct', async () => [studentId, crossDepartmentStudentId]),
    replace(AcademicTeachingAssignment, 'distinct', async () => [teacherId]),
    replace(AcademicAssessment, 'distinct', async () => [assessmentId]),
    replace(AcademicGuardianLink, 'distinct', async () => [guardianId]),
    replace(AcademicEnrollment, 'find', () => selected([
      { studentId, classId },
      { studentId: crossDepartmentStudentId, classId },
      { studentId: crossDepartmentStudentId, classId: otherClassId },
    ])),
    replace(AcademicTeachingAssignment, 'find', () => selected([{ teacherId, classId }])),
    replace(AcademicClass, 'find', () => selected([
      { _id: classId, departmentId },
      { _id: otherClassId, departmentId: otherDepartmentId },
    ])),
    replace(AcademicGuardianLink, 'find', () => selected([])),
    replace(AcademicClass, 'findOne', () => ({
      select: () => ({ lean: async () => ({ departmentId: otherDepartmentId }) }),
    })),
  ];
  try {
    const res = response();
    let nextCalled = false;
    const req = {
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'dean' },
      params: { resource: 'classes', id: otherClassId.toString() },
      path: `/classes/${otherClassId}`,
      method: 'PATCH',
      body: { name: 'Moved class' },
    };
    await requireAssignedAcademicDepartment(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 404);
    assert.equal(nextCalled, false);
    assert.deepEqual(req.academicDepartmentScope.studentIds, [studentId.toString(), crossDepartmentStudentId.toString()]);
    assert.deepEqual(req.academicDepartmentScope.departmentExclusiveStudentIds, [studentId.toString()]);

    const deleteRes = response();
    await requireAssignedAcademicDepartment({
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'dean' },
      params: { resource: 'departments', id: departmentId.toString() },
      path: `/departments/${departmentId}`,
      method: 'DELETE',
      body: {},
    }, deleteRes, () => { nextCalled = true; });
    assert.equal(deleteRes.statusCode, 403);
    assert.equal(nextCalled, false);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }

  const originalDepartmentFind = AcademicDepartment.find;
  AcademicDepartment.find = () => ({ select: () => ({ lean: async () => [] }) });
  try {
    const res = response();
    let nextCalled = false;
    await requireAssignedAcademicDepartment({
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'hod' },
      path: '/departments',
      method: 'GET',
      params: {},
    }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  } finally {
    AcademicDepartment.find = originalDepartmentFind;
  }
});

test('department-scoped class listing filters both rows and totals', async () => {
  const originalFind = AcademicClass.find;
  const originalCount = AcademicClass.countDocuments;
  let listFilter;
  let countFilter;
  AcademicClass.find = (filter) => {
    listFilter = filter;
    return query([]);
  };
  AcademicClass.countDocuments = async (filter) => {
    countFilter = filter;
    return 0;
  };
  try {
    const res = response();
    await listClasses({
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'dean' },
      query: {},
      academicDepartmentScope: {
        departmentIds: [departmentId.toString()],
        classIds: [classId.toString()],
        courseIds: [courseId.toString()],
        studentIds: [],
        teacherIds: [],
        guardianIds: [],
        personIds: [],
        assessmentIds: [],
      },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(listFilter.companyId.toString(), companyId.toString());
    assert.deepEqual(listFilter.departmentId.$in.map(String), [departmentId.toString()]);
    assert.deepEqual(countFilter, listFilter);
  } finally {
    AcademicClass.find = originalFind;
    AcademicClass.countDocuments = originalCount;
  }
});
