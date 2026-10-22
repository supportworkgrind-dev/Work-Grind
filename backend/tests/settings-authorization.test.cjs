const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const test = require('node:test');

const User = require('../dist/models/User').default;
const Company = require('../dist/models/Company').default;
const AuditLog = require('../dist/models/AuditLog').default;
const email = require('../dist/utils/email');
const { isWorkspaceAdministrator } = require('../dist/config/organization');
const { requireWorkspaceAdministrator } = require('../dist/middleware/organizationAccess');
const companiesRouter = require('../dist/routes/companies').default;
const adminRouter = require('../dist/routes/admin').default;
const usersRouter = require('../dist/routes/users').default;
const { updateMe, deactivateMe } = require('../dist/controllers/user.controller');
const { resendInvite, removeMember } = require('../dist/controllers/company.controller');
const { getAuditLogs } = require('../dist/controllers/admin.controller');
const { getMe } = require('../dist/controllers/auth.controller');

const original = {
  userFindById: User.findById,
  userFindOne: User.findOne,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  companyFindById: Company.findById,
  companyExists: Company.exists,
  auditFind: AuditLog.find,
  auditCount: AuditLog.countDocuments,
  sendInviteEmail: email.sendInviteEmail,
};

test.afterEach(() => {
  User.findById = original.userFindById;
  User.findOne = original.userFindOne;
  User.findByIdAndUpdate = original.userFindByIdAndUpdate;
  Company.findById = original.companyFindById;
  Company.exists = original.companyExists;
  AuditLog.find = original.auditFind;
  AuditLog.countDocuments = original.auditCount;
  email.sendInviteEmail = original.sendInviteEmail;
});

const companyId = new mongoose.Types.ObjectId();
const ownerId = new mongoose.Types.ObjectId();
const actorId = new mongoose.Types.ObjectId();

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set() { return this; },
  };
}

function routeHandlers(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} is registered`);
  return layer.route.stack.map((entry) => entry.handle);
}

test('workspace administration is limited to owners and admins (and principals in education)', () => {
  const cases = [
    ['business', 'owner', true],
    ['business', 'founder', true],
    ['business', 'admin', true],
    ['business', 'manager', false],
    ['business', 'employee', false],
    ['business', 'guest', false],
    ['business', 'principal', false],
    ['school', 'owner', true],
    ['school', 'principal', true],
    ['school', 'director', true],
    ['school', 'admin', true],
    ['school', 'office_staff', true],
    ['school', 'teacher', false],
    ['school', 'student', false],
    ['school', 'parent', false],
    ['school', 'manager', false],
    ['college', 'principal', true],
    ['college', 'teacher', false],
    ['university', 'admin', true],
    ['university', 'dean', false],
    ['university', 'hod', false],
    ['university', 'student', false],
    ['unknown-type', 'owner', false],
  ];
  for (const [organizationType, role, expected] of cases) {
    assert.equal(isWorkspaceAdministrator(role, organizationType), expected, `${organizationType} ${role}`);
  }
});

test('the administrator guard rejects managers and accepts admins using the authenticated role', () => {
  const rejected = makeResponse();
  let nextCalled = false;
  requireWorkspaceAdministrator({ user: { userId: 'u', role: 'manager', organizationType: 'business' } }, rejected, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.body.code, 'WORKSPACE_ADMIN_REQUIRED');

  const dean = makeResponse();
  requireWorkspaceAdministrator({ user: { userId: 'u', role: 'dean', organizationType: 'university' } }, dean, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(dean.statusCode, 403);

  requireWorkspaceAdministrator({ user: { userId: 'u', role: 'admin', organizationType: 'business' } }, makeResponse(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('settings mutations and the audit trail are wired behind the administrator guard', () => {
  for (const [router, method, path] of [
    [companiesRouter, 'patch', '/'],
    [companiesRouter, 'delete', '/invites/:token'],
    [companiesRouter, 'post', '/regenerate-invite-code'],
    [companiesRouter, 'delete', '/members/:userId'],
    [adminRouter, 'patch', '/members/:userId/role'],
    [adminRouter, 'patch', '/members/:userId/status'],
    [adminRouter, 'get', '/audit-logs'],
  ]) {
    assert.ok(
      routeHandlers(router, method, path).includes(requireWorkspaceAdministrator),
      `${method.toUpperCase()} ${path} requires a workspace administrator`,
    );
  }
  // Managers keep member-directory invites (bounded by role-assignment rules).
  assert.equal(routeHandlers(companiesRouter, 'post', '/invite').includes(requireWorkspaceAdministrator), false);
  assert.equal(routeHandlers(usersRouter, 'post', '/invite').length, 3, 'duplicate invite route also checks the member directory policy');
});

function mockProfileUpdate() {
  const captured = {};
  User.findByIdAndUpdate = (id, update, options) => {
    Object.assign(captured, { id, update, options });
    return {
      select: async () => ({ toObject: () => ({ _id: id, ...update.$set }) }),
    };
  };
  return captured;
}

test('profile updates ignore arbitrary avatar URLs but allow removing the photo', async () => {
  const captured = mockProfileUpdate();
  const res = makeResponse();
  await updateMe({ user: { userId: actorId.toString() }, body: { fullName: 'Ada', avatar: 'javascript:alert(1)' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal('avatar' in captured.update.$set, false);

  const removed = mockProfileUpdate();
  await updateMe({ user: { userId: actorId.toString() }, body: { avatar: '' } }, makeResponse());
  assert.equal(removed.update.$set.avatar, '');
  assert.equal('avatarStorageKey' in removed.update.$set, true);
});

test('profile updates reject invalid fields with 400 before writing', async () => {
  let writes = 0;
  User.findByIdAndUpdate = () => { writes += 1; return { select: async () => null }; };
  for (const body of [
    { timeZone: 'Mars/Olympus' },
    { jobTitle: 'x'.repeat(101) },
    { department: 42 },
    { skills: 'react, node' },
    { skills: Array.from({ length: 31 }, (_, i) => `skill-${i}`) },
    { bio: 'x'.repeat(501) },
    { fullName: '   ' },
    { notificationPreferences: { taskAssigned: true } },
  ]) {
    const res = makeResponse();
    await updateMe({ user: { userId: actorId.toString() }, body }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(writes, 0);
});

test('profile updates persist trimmed, de-duplicated values and valid time zones', async () => {
  const captured = mockProfileUpdate();
  const res = makeResponse();
  await updateMe({
    user: { userId: actorId.toString() },
    body: { jobTitle: '  Teacher ', skills: [' Maths', 'Maths', 'Physics '], timeZone: 'Asia/Karachi' },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(captured.update.$set.jobTitle, 'Teacher');
  assert.deepEqual(captured.update.$set.skills, ['Maths', 'Physics']);
  assert.equal(captured.update.$set.timeZone, 'Asia/Karachi');
  assert.equal(captured.options.runValidators, true);
});

test('database validation failures return a generic 400 instead of the raw error', async () => {
  User.findByIdAndUpdate = () => ({
    select: async () => { const error = new Error('Path `bio` (secret internals) is longer'); error.name = 'ValidationError'; throw error; },
  });
  const res = makeResponse();
  await updateMe({ user: { userId: actorId.toString() }, body: { bio: 'ok' } }, res);
  assert.equal(res.statusCode, 400);
  assert.doesNotMatch(res.body.message, /secret internals/);
});

test('a workspace owner cannot deactivate their own account', async () => {
  let saved = false;
  User.findById = () => ({
    select: async () => ({
      _id: ownerId,
      email: 'owner@example.invalid',
      companyId,
      comparePassword: async () => true,
      save: async () => { saved = true; },
    }),
  });
  let existsFilter;
  Company.exists = async (filter) => { existsFilter = filter; return { _id: companyId }; };
  const res = makeResponse();
  await deactivateMe({ user: { userId: ownerId.toString() }, body: { password: 'pw', confirmEmail: 'owner@example.invalid' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'WORKSPACE_OWNER_CANNOT_DEACTIVATE');
  assert.equal(saved, false);
  assert.equal(existsFilter.ownerId, ownerId);
});

test('a non-owner member can still deactivate their own account', async () => {
  const member = {
    _id: actorId,
    email: 'member@example.invalid',
    companyId,
    comparePassword: async () => true,
    save: async () => undefined,
  };
  User.findById = () => ({ select: async () => member });
  Company.exists = async () => null;
  const res = makeResponse();
  await deactivateMe({ user: { userId: actorId.toString() }, body: { password: 'pw', confirmEmail: 'member@example.invalid' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(member.isActive, false);
  assert.equal(member.isDeleted, true);
});

function mockInviteCompany(inviteRole) {
  const company = {
    _id: companyId,
    name: 'North Co',
    ownerId,
    organizationType: 'business',
    pendingInvites: [{ email: 'new@example.invalid', token: 'invite-token', role: inviteRole, expiresAt: new Date() }],
    saved: false,
    async save() { this.saved = true; },
  };
  Company.findById = async (id) => (String(id) === companyId.toString() ? company : null);
  User.findById = async () => ({ fullName: 'Manager' });
  email.sendInviteEmail = async () => undefined;
  return company;
}

test('a manager cannot resend an elevated-role invitation created by an administrator', async () => {
  const company = mockInviteCompany('admin');
  const res = makeResponse();
  await resendInvite({ params: { token: 'invite-token' }, user: { userId: actorId.toString(), companyId: companyId.toString(), role: 'manager' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(company.saved, false);
});

test('a manager can resend an invitation for a role they may assign', async () => {
  const company = mockInviteCompany('employee');
  const res = makeResponse();
  await resendInvite({ params: { token: 'invite-token' }, user: { userId: actorId.toString(), companyId: companyId.toString(), role: 'manager' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(company.saved, true);
});

test('removing a member is scoped to the caller\'s workspace', async () => {
  const otherTenantMember = new mongoose.Types.ObjectId();
  Company.findById = () => ({ select: async () => ({ _id: companyId, ownerId, organizationType: 'business' }) });
  let memberFilter;
  User.findOne = (filter) => { memberFilter = filter; return { select: async () => null }; };
  const res = makeResponse();
  await removeMember({ params: { userId: otherTenantMember.toString() }, user: { userId: ownerId.toString(), companyId: companyId.toString(), role: 'owner' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(memberFilter.companyId, companyId.toString());
});

test('audit logs are read only from the authenticated workspace, ignoring a requested workspace id', async () => {
  const filters = [];
  AuditLog.find = (filter) => {
    filters.push(filter);
    const chain = { populate: () => chain, sort: () => chain, skip: () => chain, limit: async () => [] };
    return chain;
  };
  AuditLog.countDocuments = async (filter) => { filters.push(filter); return 0; };
  const res = makeResponse();
  await getAuditLogs({
    query: { companyId: new mongoose.Types.ObjectId().toString() },
    user: { userId: ownerId.toString(), companyId: companyId.toString(), role: 'owner' },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.logs, []);
  assert.ok(filters.length === 2 && filters.every((filter) => filter.companyId === companyId.toString()));
});

test('the current-user response no longer carries the workspace invite code', async () => {
  let populatedFields;
  User.findById = () => ({
    select() { return this; },
    populate: async (path, fields) => {
      populatedFields = fields;
      return { callingId: 'WG-1', subscriptionStatus: 'none', companyId: null, toObject: () => ({ _id: actorId }) };
    },
  });
  await getMe({ user: { userId: actorId.toString(), companyId: '' }, get: () => undefined }, makeResponse());
  assert.ok(populatedFields);
  assert.doesNotMatch(populatedFields, /\binviteCode\b/);
  assert.match(populatedFields, /\borganizationType\b/);
});

test('changing the password revokes other sessions and issues a new one for this device', async () => {
  const { randomBytes } = require('node:crypto');
  process.env.JWT_SECRET ||= randomBytes(48).toString('base64url');
  process.env.JWT_REFRESH_SECRET ||= randomBytes(48).toString('base64url');
  const { changePassword } = require('../dist/controllers/auth.controller');
  const { hashRefreshToken } = require('../dist/services/pendingRegistration');

  const user = {
    _id: actorId,
    companyId,
    role: 'employee',
    email: 'member@example.invalid',
    fullName: 'Member',
    password: 'stored-hash',
    refreshTokens: ['old-device-a', 'old-device-b'],
    comparePassword: async (candidate) => candidate === 'Current#Pass1',
    save: async () => undefined,
  };
  User.findById = () => ({ select: async () => user });
  const originalNotify = email.sendPasswordChangedNotificationEmail;
  email.sendPasswordChangedNotificationEmail = async () => ({ sent: true });
  const cookies = [];
  const res = { ...makeResponse(), cookie(...args) { cookies.push(args); return this; } };
  try {
    await changePassword({
      user: { userId: actorId.toString(), companyId: companyId.toString(), role: 'employee' },
      body: { currentPassword: 'Current#Pass1', newPassword: 'Next#Pass2' },
    }, res);
  } finally {
    email.sendPasswordChangedNotificationEmail = originalNotify;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.accessToken, 'string');
  assert.equal(user.refreshTokens.length, 1, 'only the new session remains');
  assert.ok(!user.refreshTokens.includes('old-device-a'));
  const refreshCookie = cookies.find(([name]) => /refresh/i.test(name));
  assert.ok(refreshCookie, 'a refresh cookie is set for this device');
  assert.equal(user.refreshTokens[0], hashRefreshToken(refreshCookie[1]));
  assert.equal(user.password, 'Next#Pass2', 'the new password is handed to the hashing pre-save hook');
});
