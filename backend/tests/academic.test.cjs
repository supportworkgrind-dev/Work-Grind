const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AcademicPerson = require('../dist/models/AcademicPerson').default;
const AcademicDepartment = require('../dist/models/AcademicDepartment').default;
const AcademicCourse = require('../dist/models/AcademicCourse').default;
const AcademicClass = require('../dist/models/AcademicClass').default;
const AcademicGuardianLink = require('../dist/models/AcademicGuardianLink').default;
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const academicController = require('../dist/controllers/academic.controller');
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

test('academic people require a tenant and a supported academic type', () => {
  const missingTenant = new AcademicPerson({ type: 'student', firstName: 'A', lastName: 'Learner' });
  assert.equal(missingTenant.validateSync().errors.companyId.kind, 'required');

  const invalidType = new AcademicPerson({
    companyId,
    type: 'administrator',
    firstName: 'A',
    lastName: 'Learner',
  });
  assert.equal(invalidType.validateSync().errors.type.kind, 'enum');
});

test('academic departments, courses, classes, and guardian links require tenant ownership', () => {
  assert.equal(new AcademicDepartment({ name: 'Science', code: 'SCI' }).validateSync().errors.companyId.kind, 'required');
  assert.equal(new AcademicCourse({ name: 'Biology', code: 'BIO', departmentId: recordId }).validateSync().errors.companyId.kind, 'required');
  assert.equal(new AcademicClass({ name: 'Year 1', academicYear: '2025-2026', departmentId: recordId }).validateSync().errors.companyId.kind, 'required');
  assert.equal(new AcademicGuardianLink({ studentId: recordId, guardianId: new mongoose.Types.ObjectId(), relationship: 'parent' }).validateSync().errors.companyId.kind, 'required');
});

test('course creation rejects a department outside the authenticated tenant', async () => {
  const originalFindOne = AcademicDepartment.findOne;
  let capturedFilter;
  AcademicDepartment.findOne = (filter) => {
    capturedFilter = filter;
    return { select: async () => null };
  };

  try {
    const res = makeResponse();
    await academicController.createCourse({
      user: { companyId: companyId.toString(), userId: recordId.toString(), role: 'admin' },
      body: { name: 'Biology', code: 'BIO', departmentId: recordId.toString() },
    }, res);

    assert.equal(capturedFilter.companyId.toString(), companyId.toString());
    assert.equal(res.statusCode, 400);
  } finally {
    AcademicDepartment.findOne = originalFindOne;
  }
});

test('class creation rejects courses outside its tenant or department', async () => {
  const originalDepartmentFindOne = AcademicDepartment.findOne;
  const originalCourseFind = AcademicCourse.find;
  let courseFilter;
  AcademicDepartment.findOne = (filter) => {
    assert.equal(filter.companyId.toString(), companyId.toString());
    return { select: async () => ({ _id: recordId }) };
  };
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

test('academic access revalidates tenant membership and administrative role from the database', async () => {
  const originalFindById = User.findById;
  const originalCompanyFindOne = Company.findOne;
  let companyLookupCount = 0;
  User.findById = () => ({
    select: async () => ({
      companyId,
      role: 'employee',
      isActive: true,
      isVerified: true,
      isDeleted: false,
    }),
  });
  Company.findOne = () => {
    companyLookupCount += 1;
    return { select: async () => ({ organizationType: 'school', isActive: true }) };
  };

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
    assert.equal(companyLookupCount, 0);
  } finally {
    User.findById = originalFindById;
    Company.findOne = originalCompanyFindOne;
  }
});

test('academic access rejects stale tokens for a different organization', async () => {
  const originalFindById = User.findById;
  const originalCompanyFindOne = Company.findOne;
  User.findById = () => ({
    select: async () => ({
      companyId,
      role: 'admin',
      isActive: true,
      isVerified: true,
      isDeleted: false,
    }),
  });
  Company.findOne = () => {
    throw new Error('Company lookup must not run for a stale tenant claim');
  };

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
    User.findById = originalFindById;
    Company.findOne = originalCompanyFindOne;
  }
});

test('academic endpoints are not enabled for business workspaces', async () => {
  const originalFindById = User.findById;
  const originalCompanyFindOne = Company.findOne;
  User.findById = () => ({
    select: async () => ({
      companyId,
      role: 'admin',
      isActive: true,
      isVerified: true,
      isDeleted: false,
    }),
  });
  Company.findOne = (filter) => {
    assert.equal(filter._id.toString(), companyId.toString());
    assert.equal(filter.isActive, true);
    return { select: async () => ({ organizationType: 'business', isActive: true }) };
  };

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
    User.findById = originalFindById;
    Company.findOne = originalCompanyFindOne;
  }
});
