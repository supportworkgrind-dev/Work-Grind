const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isOrganizationFeatureAllowed,
  requireAnyOrganizationFeature,
} = require('../dist/middleware/organizationAccess');

const can = (organizationType, accountType, role, feature) =>
  isOrganizationFeatureAllowed({ organizationType, accountType }, role, feature);

test('feature registry separates Solo, Company, and education capabilities by role', () => {
  assert.equal(can('business', 'individual', 'owner', 'soloWorkspace'), true);
  assert.equal(can('business', 'individual', 'owner', 'companyWorkspace'), false);
  assert.equal(can('business', 'company', 'employee', 'companyWorkspace'), true);
  assert.equal(can('business', 'company', 'employee', 'businessCrm'), false);

  assert.equal(can('school', 'company', 'teacher', 'academic'), true);
  assert.equal(can('school', 'company', 'student', 'academic'), true);
  assert.equal(can('school', 'company', 'student', 'academicAdmin'), false);
  assert.equal(can('university', 'company', 'dean', 'academicAdmin'), true);
  assert.equal(can('college', 'company', 'hod', 'businessCrm'), false);
  assert.equal(can('university', 'company', 'student', 'globalCalling'), false);
});

test('Social Publishing is limited to Business and Solo workspaces and their contributor roles', () => {
  assert.equal(can('business', 'individual', 'owner', 'socialPublishing'), true);
  assert.equal(can('business', 'individual', 'employee', 'socialPublishing'), false);
  for (const role of ['owner', 'founder', 'admin', 'manager', 'employee']) {
    assert.equal(can('business', 'company', role, 'socialPublishing'), true, role);
  }
  assert.equal(can('business', 'company', 'guest', 'socialPublishing'), false);
});

test('Social Publishing is unavailable to every role in school, college, and university workspaces', () => {
  const educationRoles = ['owner', 'founder', 'principal', 'director', 'admin', 'office_staff', 'teacher', 'faculty', 'manager', 'employee', 'student', 'parent', 'guest'];
  for (const organizationType of ['school', 'college', 'university']) {
    for (const role of [...educationRoles, ...(organizationType === 'university' ? ['dean', 'hod'] : [])]) {
      assert.equal(can(organizationType, 'company', role, 'socialPublishing'), false, `${organizationType} ${role}`);
    }
  }
});

test('any-of workspace middleware allows Solo content but fails closed without an eligible workspace', () => {
  const middleware = requireAnyOrganizationFeature('workspaceContent', 'soloWorkspace');
  let nextCalled = false;
  middleware({
    user: { organizationType: 'business', accountType: 'individual', role: 'owner' },
  }, {
    status() { return this; },
    json() { return this; },
  }, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  let statusCode;
  let responseBody;
  middleware({
    user: { organizationType: 'university', accountType: 'company', role: 'student' },
  }, {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; return this; },
  }, () => { nextCalled = true; });
  assert.equal(statusCode, 403);
  assert.equal(responseBody.success, false);
});
