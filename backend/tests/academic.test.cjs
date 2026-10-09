const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AcademicPerson = require('../dist/models/AcademicPerson').default;
const AcademicDepartment = require('../dist/models/AcademicDepartment').default;
const AcademicCourse = require('../dist/models/AcademicCourse').default;
const AcademicClass = require('../dist/models/AcademicClass').default;
const AcademicGuardianLink = require('../dist/models/AcademicGuardianLink').default;
const AcademicEnrollment = require('../dist/models/AcademicEnrollment').default;
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const academicController = require('../dist/controllers/academic.controller');
const academicPortalController = require('../dist/controllers/academicPortal.controller');
const { requireAcademicAdmin } = require('../dist/middleware/academicOrganization');

const companyId = new mongoose.Types.ObjectId();
const recordId = new mongoose.Types.ObjectId();

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function mockAuthenticatedUser(role = 'admin') {
  const originalFindById = User.findById;
  User.findById = () => ({
    select: async () => ({
      companyId,
      role,
      isActive: true,
      isVerified: true,
      isDeleted: false,
    }),
  });
  return () => { User.findById = originalFindById; };
}

test('academic records require a tenant and supported person types', () => {
  const personWithoutTenant = new AcademicPerson({ type: 'student', firstName: 'A', lastName: 'Learner' });
  assert.equal(personWithoutTenant.validateSync().errors.companyId.kind, 'required');

  const invalidPersonType = new AcademicPerson({
    companyId,
    type: 'administrator',
    firstName: 'A',
    lastName: 'Learner',
  });
  assert.equal(invalidPersonType.validateSync().errors.type.kind, 'enum');

  const enrollmentWithoutTenant = new AcademicEnrollment({
    studentId: recordId,
    classId: new mongoose.Types.ObjectId(),
  });
  assert.equal(enrollmentWithoutTenant.validateSync().errors.companyId.kind, 'required');
});

test('departments, courses, classes, and guardian links require tenant ownership', () => {
  assert.equal(new AcademicDepartment({ name: 'Science', code: 'SCI' }).validateSync().errors.companyId.kind, 'required');
  assert.equal(new AcademicCourse({ name: 'Biology', code: 'BIO', departmentId: recordId }).validateSync().errors.companyId.kind, 'required');
  assert.equal(new AcademicClass({ name: 'Year 1', academicYear: '2025-2026', departmentId: recordId }).validateSync().errors.companyId.kind, 'required');
  assert.equal(new AcademicGuardianLink({ studentId: recordId, guardianId: new mongoose.Types.ObjectId(), relationship: 'parent' }).validateSync().errors.companyId.kind, 'required');
});

test('course creation rejects a department outside the authenticated tenant', async () => {
  const originalFindOne = AcademicDepartment.findOne;
  AcademicDepartment.findOne = (filter) => {
    assert.equal(filter.companyId.toString(), companyId.toString());
    return { select: async () => null };
  };
  try {
    const res = makeResponse();
    await academicController.createCourse({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' },
      body: { name: 'Biology', code: 'BIO', departmentId: recordId.toString() },
    }, res);
    assert.equal(res.statusCode, 400);
  } finally {
    AcademicDepartment.findOne = originalFindOne;
  }
});

test('class creation rejects courses outside its tenant or department', async () => {
  const originalDepartmentFindOne = AcademicDepartment.findOne;
  const originalCourseFind = AcademicCourse.find;
  let courseFilter;
  AcademicDepartment.findOne = () => ({ select: async () => ({ _id: recordId }) });
  AcademicCourse.find = (filter) => {
    courseFilter = filter;
    return { select: async () => [] };
  };
  try {
    const res = makeResponse();
    await academicController.createClass({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' },
      body: {
        name: 'Year 1',
        academicYear: '2025-2026',
        departmentId: recordId.toString(),
        courseIds: [new mongoose.Types.ObjectId().toString()],
      },
    }, res);
    assert.equal(courseFilter.companyId.toString(), companyId.toString());
    assert.equal(courseFilter.departmentId.toString(), recordId.toString());
    assert.equal(res.statusCode, 400);
  } finally {
    AcademicDepartment.findOne = originalDepartmentFindOne;
    AcademicCourse.find = originalCourseFind;
  }
});

test('guardian relationships require a parent and student in the same tenant', async () => {
  const originalFindOne = AcademicPerson.findOne;
  const filters = [];
  AcademicPerson.findOne = (filter) => {
    filters.push(filter);
    return { select: async () => filter.type === 'student' ? { _id: recordId } : null };
  };
  try {
    const res = makeResponse();
    await academicController.createGuardianLink({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' },
      body: {
        studentId: recordId.toString(),
        guardianId: new mongoose.Types.ObjectId().toString(),
        relationship: 'parent',
      },
    }, res);
    assert.equal(filters.length, 2);
    assert.ok(filters.every((filter) => filter.companyId.toString() === companyId.toString()));
    assert.equal(res.statusCode, 400);
  } finally {
    AcademicPerson.findOne = originalFindOne;
  }
});

test('linked WorkGrind accounts must be active and belong to the same tenant', async () => {
  const originalFindOne = User.findOne;
  let capturedFilter;
  User.findOne = (filter) => {
    capturedFilter = filter;
    return { select: async () => null };
  };
  try {
    const res = makeResponse();
    await academicController.createPerson({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' },
      body: {
        type: 'student',
        firstName: 'A',
        lastName: 'Learner',
        userId: new mongoose.Types.ObjectId().toString(),
      },
    }, res);
    assert.equal(capturedFilter.companyId.toString(), companyId.toString());
    assert.equal(capturedFilter.isActive, true);
    assert.equal(capturedFilter.isVerified, true);
    assert.equal(res.statusCode, 400);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('academic access revalidates tenant membership and administrative role', async () => {
  const restoreUser = mockAuthenticatedUser('employee');
  const originalCompanyFindOne = Company.findOne;
  Company.findOne = () => ({ select: async () => ({ organizationType: 'school', isActive: true }) });
  try {
    const res = makeResponse();
    let continued = false;
    await requireAcademicAdmin(
      { user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'owner' } },
      res,
      () => { continued = true; }
    );
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);
  } finally {
    restoreUser();
    Company.findOne = originalCompanyFindOne;
  }
});

test('academic access rejects a stale token claiming another organization', async () => {
  const restoreUser = mockAuthenticatedUser('admin');
  const originalCompanyFindOne = Company.findOne;
  Company.findOne = () => { throw new Error('Tenant mismatch must be rejected before organization lookup'); };
  try {
    const res = makeResponse();
    let continued = false;
    await requireAcademicAdmin(
      { user: { companyId: new mongoose.Types.ObjectId().toString(), userId: recordId.toString(), role: 'admin' } },
      res,
      () => { continued = true; }
    );
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);
  } finally {
    restoreUser();
    Company.findOne = originalCompanyFindOne;
  }
});

test('academic endpoints are disabled for business workspaces', async () => {
  const restoreUser = mockAuthenticatedUser();
  const originalCompanyFindOne = Company.findOne;
  Company.findOne = () => ({ select: async () => ({ organizationType: 'business', isActive: true }) });
  try {
    const res = makeResponse();
    let continued = false;
    await requireAcademicAdmin(
      { user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' } },
      res,
      () => { continued = true; }
    );
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);
  } finally {
    restoreUser();
    Company.findOne = originalCompanyFindOne;
  }
});

test('enrollment creation rejects student or class records outside the tenant', async () => {
  const originalPersonFindOne = AcademicPerson.findOne;
  const originalClassFindOne = AcademicClass.findOne;
  let personFilter;
  let classFilter;
  AcademicPerson.findOne = (filter) => {
    personFilter = filter;
    return { select: async () => null };
  };
  AcademicClass.findOne = (filter) => {
    classFilter = filter;
    return { select: async () => ({ _id: filter._id }) };
  };
  try {
    const res = makeResponse();
    await academicController.createEnrollment({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' },
      body: { studentId: recordId.toString(), classId: new mongoose.Types.ObjectId().toString() },
    }, res);
    assert.equal(personFilter.companyId.toString(), companyId.toString());
    assert.equal(classFilter.companyId.toString(), companyId.toString());
    assert.equal(res.statusCode, 400);
  } finally {
    AcademicPerson.findOne = originalPersonFindOne;
    AcademicClass.findOne = originalClassFindOne;
  }
});

test('student portal limits enrollments to the linked student profile', async () => {
  const originalPersonFindOne = AcademicPerson.findOne;
  const originalEnrollmentFind = AcademicEnrollment.find;
  let enrollmentFilter;
  AcademicPerson.findOne = () => ({
    select: async () => ({ _id: recordId, type: 'student', firstName: 'A', lastName: 'Learner' }),
  });
  AcademicEnrollment.find = (filter) => {
    enrollmentFilter = filter;
    return { populate() { return this; }, lean: async () => [] };
  };
  try {
    const res = makeResponse();
    await academicPortalController.getAcademicPortal({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'employee' },
    }, res);
    assert.equal(enrollmentFilter.companyId.toString(), companyId.toString());
    assert.deepEqual(enrollmentFilter.studentId.$in.map((id) => id.toString()), [recordId.toString()]);
    assert.equal(res.body.profile.type, 'student');
  } finally {
    AcademicPerson.findOne = originalPersonFindOne;
    AcademicEnrollment.find = originalEnrollmentFind;
  }
});

test('parent portal limits student records to explicit guardian links', async () => {
  const originalPersonFindOne = AcademicPerson.findOne;
  const originalLinkFind = AcademicGuardianLink.find;
  const originalPeopleFind = AcademicPerson.find;
  const originalEnrollmentFind = AcademicEnrollment.find;
  const studentId = new mongoose.Types.ObjectId();
  let enrollmentFilter;
  AcademicPerson.findOne = () => ({
    select: async () => ({ _id: recordId, type: 'parent', firstName: 'P', lastName: 'Guardian' }),
  });
  AcademicGuardianLink.find = (filter) => {
    assert.equal(filter.companyId.toString(), companyId.toString());
    assert.equal(filter.guardianId.toString(), recordId.toString());
    return { select: async () => [{ studentId }] };
  };
  AcademicPerson.find = () => ({
    select() { return this; },
    lean: async () => [{ _id: studentId, firstName: 'S', lastName: 'Learner' }],
  });
  AcademicEnrollment.find = (filter) => {
    enrollmentFilter = filter;
    return { populate() { return this; }, lean: async () => [] };
  };
  try {
    const res = makeResponse();
    await academicPortalController.getAcademicPortal({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'employee' },
    }, res);
    assert.deepEqual(enrollmentFilter.studentId.$in.map((id) => id.toString()), [studentId.toString()]);
    assert.equal(res.body.students.length, 1);
  } finally {
    AcademicPerson.findOne = originalPersonFindOne;
    AcademicGuardianLink.find = originalLinkFind;
    AcademicPerson.find = originalPeopleFind;
    AcademicEnrollment.find = originalEnrollmentFind;
  }
});
