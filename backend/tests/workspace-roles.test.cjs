const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const test = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || randomBytes(48).toString('base64url');

const User = require('../dist/models/User').default;
const Company = require('../dist/models/Company').default;
const Channel = require('../dist/models/Channel').default;
const AuditLog = require('../dist/models/AuditLog').default;
const planLimits = require('../dist/utils/planLimits');
const email = require('../dist/utils/email');
const {
  WORKSPACE_ROLE_CATALOG,
  canAssignOrganizationRole,
  getAssignableOrganizationRoles,
  isOrganizationRoleAssignable,
  isOrganizationRoleEligible,
  isWorkspaceAdministrator,
  permissionRole,
  resolveDefaultJoinRole,
  roleMatches,
} = require('../dist/config/organization');
const { isOrganizationFeatureAllowed } = require('../dist/middleware/organizationAccess');
const { updateMemberRole } = require('../dist/controllers/admin.controller');
const { inviteMember } = require('../dist/controllers/user.controller');
const { getWorkspaceRoles, updateCompany } = require('../dist/controllers/company.controller');
const { joinCompany, validateInvite } = require('../dist/controllers/auth.controller');
const companiesRouter = require('../dist/routes/companies').default;

/**
 * Roles come from the workspace type: a university never offers Employee,
 * Manager or Guest; a Solo workspace has no member roles; titles such as
 * Lecturer or Vice Chancellor carry an existing role's permissions, never more.
 */

const BUSINESS_ROLES = ['employee', 'manager', 'guest'];
const original = {
  userFindById: User.findById,
  userFindOne: User.findOne,
  userFind: User.find,
  userFindOneAndUpdate: User.findOneAndUpdate,
  companyFindById: Company.findById,
  companyFindOne: Company.findOne,
  channelUpdateMany: Channel.updateMany,
  auditCreate: AuditLog.create,
  withLock: planLimits.withCompanyCapacityLock,
  checkMemberLimit: planLimits.checkMemberLimit,
  sendInviteEmail: email.sendInviteEmail,
};

test.afterEach(() => {
  User.findById = original.userFindById;
  User.findOne = original.userFindOne;
  User.find = original.userFind;
  User.findOneAndUpdate = original.userFindOneAndUpdate;
  Company.findById = original.companyFindById;
  Company.findOne = original.companyFindOne;
  Channel.updateMany = original.channelUpdateMany;
  AuditLog.create = original.auditCreate;
  planLimits.withCompanyCapacityLock = original.withLock;
  planLimits.checkMemberLimit = original.checkMemberLimit;
  email.sendInviteEmail = original.sendInviteEmail;
});

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); return this; },
    set() { return this; },
  };
}

const query = (value) => {
  const promise = Promise.resolve(value);
  promise.select = () => query(value);
  promise.lean = () => Promise.resolve(value);
  promise.populate = () => query(value);
  return promise;
};

function workspace(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'Fixture Institution',
    ownerId: new mongoose.Types.ObjectId(),
    organizationType: 'university',
    accountType: 'company',
    settings: { allowGuestAccess: false, defaultRole: 'employee' },
    pendingInvites: [],
    isActive: true,
    async save() { return this; },
    ...overrides,
  };
}

// ── Catalog ────────────────────────────────────────────────────────────────

test('each workspace type offers its own roles and education types never offer business roles', () => {
  assert.deepEqual(WORKSPACE_ROLE_CATALOG.business.assignable, ['admin', 'manager', 'employee', 'guest']);
  assert.deepEqual(WORKSPACE_ROLE_CATALOG.school.assignable, ['principal', 'admin', 'teacher', 'student', 'parent']);
  assert.deepEqual(WORKSPACE_ROLE_CATALOG.college.assignable, ['principal', 'admin', 'hod', 'lecturer', 'teacher', 'student', 'parent']);
  assert.deepEqual(WORKSPACE_ROLE_CATALOG.university.assignable,
    ['vice_chancellor', 'admin', 'dean', 'hod', 'professor', 'lecturer', 'teacher', 'student', 'parent']);
  for (const type of ['school', 'college', 'university']) {
    for (const role of BUSINESS_ROLES) {
      assert.equal(isOrganizationRoleAssignable(role, type), false, `${type} does not offer ${role}`);
      assert.equal(canAssignOrganizationRole('owner', role, type, true), false, `even the ${type} owner cannot assign ${role}`);
    }
    assert.deepEqual(WORKSPACE_ROLE_CATALOG[type].joinRoles, ['student', 'parent']);
  }
  for (const role of ['student', 'teacher', 'parent', 'principal', 'dean']) {
    assert.equal(isOrganizationRoleAssignable(role, 'business'), false, `business does not offer ${role}`);
  }
});

test('a Solo workspace has no member roles and cannot be joined', () => {
  assert.deepEqual(getAssignableOrganizationRoles('owner', 'business', 'individual', true), []);
  assert.equal(resolveDefaultJoinRole('business', 'employee', 'individual'), '');
});

test('existing education members with business roles keep their access but cannot be given those roles again', () => {
  for (const type of ['school', 'college', 'university']) {
    assert.equal(isOrganizationRoleEligible('employee', type), true);
    assert.equal(isOrganizationFeatureAllowed({ organizationType: type, accountType: 'company' }, 'employee', 'academic'), true);
  }
  // Universities used "principal" before Vice Chancellor existed.
  assert.equal(isOrganizationRoleEligible('principal', 'university'), true);
  assert.equal(isOrganizationRoleAssignable('principal', 'university'), false);
  assert.equal(isWorkspaceAdministrator('principal', 'university'), true);
});

test('institution titles carry exactly the permissions of their base role', () => {
  assert.equal(permissionRole('lecturer'), 'teacher');
  assert.equal(permissionRole('professor'), 'teacher');
  assert.equal(permissionRole('vice_chancellor'), 'principal');
  assert.equal(roleMatches('lecturer', ['teacher'], 'college'), true);
  assert.equal(roleMatches('lecturer', ['admin', 'manager'], 'college'), false, 'a lecturer is not an administrator');
  assert.equal(roleMatches('professor', ['admin'], 'university'), false);
  assert.equal(isWorkspaceAdministrator('professor', 'university'), false);
  assert.equal(isWorkspaceAdministrator('vice_chancellor', 'university'), true);
  const university = { organizationType: 'university', accountType: 'company' };
  assert.equal(isOrganizationFeatureAllowed(university, 'vice_chancellor', 'workspaceSettings'), true);
  assert.equal(isOrganizationFeatureAllowed(university, 'professor', 'academic'), true);
  assert.equal(isOrganizationFeatureAllowed(university, 'professor', 'academicAdmin'), false);
  assert.equal(isOrganizationFeatureAllowed(university, 'lecturer', 'memberDirectory'), false);
  // Roles from another workspace type grant nothing.
  assert.equal(isOrganizationFeatureAllowed(university, 'lecturer', 'businessCrm'), false);
  assert.equal(isOrganizationFeatureAllowed({ organizationType: 'school', accountType: 'company' }, 'vice_chancellor', 'academic'), false);
  assert.equal(isOrganizationFeatureAllowed({ organizationType: 'business', accountType: 'company' }, 'professor', 'companyWorkspace'), false);
});

test('only the owner assigns administrative roles; administrators assign teaching and member roles', () => {
  assert.deepEqual(getAssignableOrganizationRoles('owner', 'university', 'company', true), WORKSPACE_ROLE_CATALOG.university.assignable);
  assert.deepEqual(getAssignableOrganizationRoles('admin', 'university', 'company', false), ['professor', 'lecturer', 'teacher', 'student', 'parent']);
  assert.deepEqual(getAssignableOrganizationRoles('vice_chancellor', 'university', 'company', false), ['professor', 'lecturer', 'teacher', 'student', 'parent']);
  assert.deepEqual(getAssignableOrganizationRoles('principal', 'school', 'company', false), ['teacher', 'student', 'parent']);
  assert.deepEqual(getAssignableOrganizationRoles('teacher', 'school', 'company', false), []);
  assert.deepEqual(getAssignableOrganizationRoles('manager', 'business', 'company', false), ['employee', 'guest']);
  assert.equal(canAssignOrganizationRole('admin', 'hod', 'college', false), false);
  assert.equal(canAssignOrganizationRole('owner', 'owner', 'college', true), false);
});

test('invite codes give education joiners Student, even where the saved default was Employee', () => {
  assert.equal(resolveDefaultJoinRole('university', 'employee'), 'student');
  assert.equal(resolveDefaultJoinRole('school', 'parent'), 'parent');
  assert.equal(resolveDefaultJoinRole('school', 'principal'), 'student', 'an elevated role is never an open-join role');
  assert.equal(resolveDefaultJoinRole('business', 'employee'), 'employee');
  assert.equal(resolveDefaultJoinRole('business', undefined), 'employee');
});

// ── Role changes ───────────────────────────────────────────────────────────

function memberRoleRequest(company, actor, target, role) {
  Company.findById = () => query(company);
  User.findOne = () => query(target);
  return {
    params: { userId: target._id.toString() },
    body: { role },
    user: { userId: actor._id.toString(), companyId: company._id.toString(), role: actor.role, organizationType: company.organizationType },
  };
}

test('a university owner cannot give a member a business role', async () => {
  const company = workspace();
  const owner = { _id: company.ownerId, role: 'owner' };
  const member = { _id: new mongoose.Types.ObjectId(), role: 'student' };
  for (const role of BUSINESS_ROLES) {
    const res = makeResponse();
    await updateMemberRole(memberRoleRequest(company, owner, member, role), res);
    assert.equal(res.statusCode, 400, `${role} is refused`);
  }
});

test('a university owner assigns Lecturer and the change is audited with the previous role', async () => {
  const company = workspace();
  const owner = { _id: company.ownerId, role: 'owner' };
  const member = { _id: new mongoose.Types.ObjectId(), role: 'employee', fullName: 'Legacy Staff' };
  const audits = [];
  let update;
  User.findOneAndUpdate = (filter, values) => {
    update = { filter, values };
    return query({ ...member, role: values.role });
  };
  AuditLog.create = async (entry) => { audits.push(entry); };
  const res = makeResponse();
  await updateMemberRole(memberRoleRequest(company, owner, member, 'lecturer'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(update.values.role, 'lecturer');
  assert.equal(String(update.filter.companyId), company._id.toString(), 'the update is scoped to the workspace');
  assert.equal(audits[0].details.previousRole, 'employee');
  assert.equal(audits[0].details.newRole, 'lecturer');
});

test('a non-owner administrator cannot change another administrator or grant an elevated role', async () => {
  const company = workspace({ organizationType: 'school' });
  const principal = { _id: new mongoose.Types.ObjectId(), role: 'principal' };
  const otherAdmin = { _id: new mongoose.Types.ObjectId(), role: 'admin' };
  const teacher = { _id: new mongoose.Types.ObjectId(), role: 'teacher' };
  User.findOneAndUpdate = () => { throw new Error('must not update'); };

  const demote = makeResponse();
  await updateMemberRole(memberRoleRequest(company, principal, otherAdmin, 'teacher'), demote);
  assert.equal(demote.statusCode, 403);

  const promote = makeResponse();
  await updateMemberRole(memberRoleRequest(company, principal, teacher, 'admin'), promote);
  assert.equal(promote.statusCode, 403);
});

test('a member of another workspace is not found', async () => {
  const company = workspace();
  const owner = { _id: company.ownerId, role: 'owner' };
  const filters = [];
  Company.findById = () => query(company);
  User.findOne = (filter) => { filters.push(filter); return query(null); };
  const res = makeResponse();
  await updateMemberRole({
    params: { userId: new mongoose.Types.ObjectId().toString() },
    body: { role: 'student' },
    user: { userId: owner._id.toString(), companyId: company._id.toString(), role: 'owner', organizationType: 'university' },
  }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(String(filters[0].companyId), company._id.toString());
});

// ── Invitations and joining ────────────────────────────────────────────────

function stubAdmission() {
  planLimits.withCompanyCapacityLock = async (_id, run) => run();
  planLimits.checkMemberLimit = async () => ({ allowed: true });
  email.sendInviteEmail = async () => {};
}

test('a university invitation without a role defaults to Student, and Employee is refused', async () => {
  const company = workspace();
  Company.findById = () => query(company);
  User.findById = () => query({ _id: company.ownerId, fullName: 'Owner Person' });
  stubAdmission();
  const request = (body) => ({ body, user: { userId: company.ownerId.toString(), companyId: company._id.toString(), role: 'owner' } });

  const refused = makeResponse();
  await inviteMember(request({ email: 'staff@uni.example', role: 'employee' }), refused);
  assert.equal(refused.statusCode, 403);
  assert.equal(company.pendingInvites.length, 0);

  const sent = makeResponse();
  await inviteMember(request({ email: 'learner@uni.example' }), sent);
  assert.equal(sent.statusCode, 200);
  assert.equal(company.pendingInvites[0].role, 'student');
});

test('joining a university with its invite code gives Student, not the stored Employee default', async () => {
  const company = workspace({ inviteCode: 'UNI123' });
  const joiner = {
    _id: new mongoose.Types.ObjectId(), email: 'new@uni.example', companyId: null, role: 'employee',
    async save() { return this; },
  };
  Company.findOne = (filter) => query(filter.inviteCode ? company : null);
  Company.findById = () => query(company);
  User.findById = () => query(joiner);
  Channel.updateMany = async () => ({});
  stubAdmission();
  const res = makeResponse();
  await joinCompany({ body: { inviteCode: 'uni123' }, user: { userId: joiner._id.toString() } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.role, 'student');
  assert.equal(joiner.role, 'student');
});

test('a Solo workspace invite code is not a way to join it', async () => {
  const company = workspace({ organizationType: 'business', accountType: 'individual', inviteCode: 'SOLO1' });
  const joiner = { _id: new mongoose.Types.ObjectId(), email: 'x@example.com', companyId: null, async save() { return this; } };
  Company.findOne = (filter) => query(filter.inviteCode ? company : null);
  User.findById = () => query(joiner);
  stubAdmission();
  const res = makeResponse();
  await joinCompany({ body: { inviteCode: 'SOLO1' }, user: { userId: joiner._id.toString() } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(joiner.companyId, null);

  const preview = makeResponse();
  await validateInvite({ params: { tokenOrCode: 'SOLO1' } }, preview);
  assert.equal(preview.statusCode, 404);
});

test('invitation previews report the workspace type and an education role', async () => {
  const company = workspace({ inviteCode: 'UNI123' });
  Company.findOne = (filter) => query(filter.inviteCode ? company : null);
  const res = makeResponse();
  await validateInvite({ params: { tokenOrCode: 'UNI123' } }, res);
  assert.equal(res.body.invite.role, 'student');
  assert.equal(res.body.invite.organizationType, 'university');
});

// ── Workspace settings ─────────────────────────────────────────────────────

function settingsRequest(company, body) {
  Company.findById = () => query(company);
  return { body, user: { userId: company.ownerId.toString(), companyId: company._id.toString(), role: 'owner' } };
}

test('an education workspace cannot save a business default role', async () => {
  const company = workspace({ organizationType: 'college' });
  for (const defaultRole of ['employee', 'guest', 'admin']) {
    const res = makeResponse();
    await updateCompany(settingsRequest(company, { settings: { defaultRole } }), res);
    assert.equal(res.statusCode, 400, `${defaultRole} is refused`);
  }
});

test('changing the workspace type is blocked while members hold roles the new type does not offer', async () => {
  const company = workspace({ organizationType: 'business' });
  User.find = () => query([
    { _id: company.ownerId, role: 'owner' },
    { _id: new mongoose.Types.ObjectId(), role: 'employee' },
  ]);
  const res = makeResponse();
  await updateCompany(settingsRequest(company, { organizationType: 'university' }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'MEMBER_ROLES_INCOMPATIBLE');
});

test('the role catalog endpoint answers for the caller’s own workspace and role', async () => {
  const layer = companiesRouter.stack.find((entry) => entry.route?.path === '/roles' && entry.route.methods.get);
  assert.ok(layer, 'GET /companies/roles is registered');
  const company = workspace();
  Company.findById = (id) => { assert.equal(String(id), company._id.toString()); return query(company); };

  const asAdmin = makeResponse();
  await getWorkspaceRoles({ user: { userId: new mongoose.Types.ObjectId().toString(), companyId: company._id.toString(), role: 'admin' } }, asAdmin);
  assert.deepEqual(asAdmin.body.roles.map((role) => role.id), WORKSPACE_ROLE_CATALOG.university.assignable);
  assert.deepEqual(asAdmin.body.assignableRoles, ['professor', 'lecturer', 'teacher', 'student', 'parent']);
  assert.equal(asAdmin.body.defaultJoinRole, 'student');
  assert.ok(!asAdmin.body.roles.some((role) => BUSINESS_ROLES.includes(role.id)));
});
