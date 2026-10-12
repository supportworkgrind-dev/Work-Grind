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

test('Social Publishing is available to authorized workspace contributors but excludes learners and parents', () => {
  assert.equal(can('business', 'individual', 'owner', 'socialPublishing'), true);
  assert.equal(can('business', 'individual', 'employee', 'socialPublishing'), false);
  assert.equal(can('business', 'company', 'employee', 'socialPublishing'), true);
  assert.equal(can('business', 'company', 'guest', 'socialPublishing'), false);
  assert.equal(can('school', 'company', 'teacher', 'socialPublishing'), true);
  assert.equal(can('college', 'company', 'faculty', 'socialPublishing'), true);
  assert.equal(can('university', 'company', 'hod', 'socialPublishing'), true);
  assert.equal(can('school', 'company', 'student', 'socialPublishing'), false);
  assert.equal(can('university', 'company', 'parent', 'socialPublishing'), false);
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
