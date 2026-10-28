const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomBytes } = require('node:crypto');
const test = require('node:test');
const mongoose = require('mongoose');

process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const User = require('../dist/models/User').default;
const Company = require('../dist/models/Company').default;
const PendingRegistration = require('../dist/models/PendingRegistration').default;
const email = require('../dist/utils/email');
const academicInvitations = require('../dist/services/academicInvitation.service');
const planLimits = require('../dist/utils/planLimits');
const authController = require('../dist/controllers/auth.controller');
const { inviteMember } = require('../dist/controllers/user.controller');
const validation = require('../dist/services/registrationValidation');

const stubbed = [];
function replace(target, name, implementation) {
  stubbed.push([target, name, target[name]]);
  target[name] = implementation;
}
test.afterEach(() => {
  while (stubbed.length) {
    const [target, name, original] = stubbed.pop();
    target[name] = original;
  }
});

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function query(value) {
  return { select() { return this; }, populate() { return this; }, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
}

/** Captures what a successful registration would save, without a database. */
function acceptRegistrations() {
  const saved = [];
  replace(User, 'exists', async () => false);
  replace(PendingRegistration, 'findOne', async () => null);
  replace(PendingRegistration, 'create', async (record) => { saved.push(record); return record; });
  replace(email, 'sendVerificationCodeEmail', async () => ({ success: true, messageId: 'accepted' }));
  return saved;
}

const valid = { fullName: 'Ayesha Khan', email: 'ayesha@example.test', password: 'StrongPass1!' };

test('each invalid registration field gets its own actionable error', async () => {
  const saved = acceptRegistrations();
  const res = makeResponse();
  await authController.register({ body: { fullName: '', email: 'not-an-email', password: 'short', accountType: 'team', organizationType: 'shop' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'REGISTRATION_INVALID');
  assert.deepEqual(Object.keys(res.body.errors).sort(), ['accountType', 'email', 'fullName', 'organizationType', 'password']);
  assert.equal(res.body.errors.fullName, 'Enter your full name.');
  assert.match(res.body.errors.email, /valid email address/);
  assert.equal(res.body.errors.password, 'Your password needs at least 8 characters, an uppercase letter, a number and a symbol such as ! @ # or ?.');
  assert.match(res.body.message, /highlighted fields/);
  assert.equal(saved.length, 0);
});

test('a single problem is returned as the message itself, naming only what is missing', async () => {
  acceptRegistrations();
  const res = makeResponse();
  await authController.register({ body: { ...valid, password: 'Strongpass1', accountType: 'company', organizationType: 'business' } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(Object.keys(res.body.errors), ['password']);
  assert.equal(res.body.message, 'Your password needs a symbol such as ! @ # or ?.');
});

test('a Solo signup cannot choose an education organization', async () => {
  acceptRegistrations();
  const res = makeResponse();
  await authController.register({ body: { ...valid, accountType: 'individual', organizationType: 'school' } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(Object.keys(res.body.errors), ['organizationType']);
});

test('a workspace invitation registers with the inviting workspace type, never the client\'s', async () => {
  const saved = acceptRegistrations();
  replace(Company, 'findOne', (filter) => query(filter['pendingInvites.token'] === 'invite-token'
    ? { organizationType: 'university', accountType: 'company', pendingInvites: [{ token: 'invite-token', email: 'ayesha@example.test', role: 'student' }] }
    : null));
  const res = makeResponse();
  // The old /join form sent no workspace type at all; a tampered client might send another one.
  await authController.register({ body: { ...valid, inviteToken: 'invite-token', accountType: 'individual', organizationType: 'business' } }, res);
  assert.equal(res.statusCode, 202, JSON.stringify(res.body));
  assert.equal(saved[0].accountType, 'company');
  assert.equal(saved[0].organizationType, 'university');
});

test('an invitation sent to another address is reported on the email field', async () => {
  const saved = acceptRegistrations();
  replace(Company, 'findOne', () => query({ organizationType: 'school', accountType: 'company', pendingInvites: [{ token: 'invite-token', email: 'invited@example.test' }] }));
  const res = makeResponse();
  await authController.register({ body: { ...valid, inviteToken: 'invite-token' } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(Object.keys(res.body.errors), ['email']);
  assert.match(res.body.errors.email, /different email address/);
  assert.equal(saved.length, 0);
});

test('unknown, expired and Solo invitation codes are reported on the invitation, not as a generic error', async () => {
  acceptRegistrations();
  let lookups = [];
  replace(Company, 'findOne', (filter) => {
    lookups.push(filter);
    // Token lookup misses; the code lookup finds a Solo workspace.
    return query(filter.inviteCode === 'SOLO1234' ? { organizationType: 'business', accountType: 'individual', settings: {} } : null);
  });
  for (const inviteToken of ['expired-token', 'SOLO1234']) {
    const res = makeResponse();
    await authController.register({ body: { ...valid, inviteToken } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.body.errors), ['invitation']);
    assert.match(res.body.errors.invitation, /invalid or has expired/);
  }
  assert.ok(lookups.some((filter) => filter['pendingInvites.expiresAt']?.$gt instanceof Date), 'expired invitations are excluded by the query');
  assert.ok(lookups.every((filter) => !('isActive' in filter) || filter.isActive === true), 'inactive workspaces are excluded');
});

test('an invite code registers with that workspace type and allows any email', async () => {
  const saved = acceptRegistrations();
  replace(Company, 'findOne', (filter) => query(filter.inviteCode === 'SCH00L01' ? { organizationType: 'school', accountType: 'company', settings: { defaultRole: 'student' } } : null));
  const res = makeResponse();
  await authController.register({ body: { ...valid, inviteToken: 'sch00l01' } }, res);
  assert.equal(res.statusCode, 202, JSON.stringify(res.body));
  assert.equal(saved[0].organizationType, 'school');
});

test('an academic onboarding invitation takes the institution type from the server', async () => {
  const saved = acceptRegistrations();
  replace(academicInvitations, 'describeAcademicInvitation', async (token) => (token === 'a'.repeat(43)
    ? { institutionName: 'Greenwood', organizationType: 'college', role: 'student', firstName: 'Ayesha', email: 'ayesha@example.test' }
    : null));
  const res = makeResponse();
  await authController.register({ body: { ...valid, academicInviteToken: 'a'.repeat(43), organizationType: 'business' } }, res);
  assert.equal(res.statusCode, 202, JSON.stringify(res.body));
  assert.equal(saved[0].organizationType, 'college');
  assert.equal(saved[0].accountType, 'company');
});

test('frontend and backend password rules agree on every requirement and symbol', async () => {
  const frontend = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/lib/passwordPolicy.ts')).href);
  const samples = ['', 'short', 'alllowercase1!', 'ALLUPPER1!', 'NoDigits!!', 'NoSymbol123', 'Valid1!pass', 'Ünicode1!x', 'spaces In 1 !'];
  for (let code = 32; code < 127; code += 1) samples.push(`Abcdefg1${String.fromCharCode(code)}`);
  for (const password of samples) {
    assert.deepEqual(frontend.missingPasswordRequirements(password), validation.missingPasswordRequirements(password), JSON.stringify(password));
  }
  assert.equal(frontend.passwordError('Strongpass1'), 'Your password needs a symbol such as ! @ # or ?.');
  assert.equal(frontend.PASSWORD_MIN_LENGTH, validation.PASSWORD_MIN_LENGTH);
});

test('an invitation is only reported as sent once the email provider accepts it', async () => {
  const companyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const company = { _id: companyId, ownerId, name: 'North Co', organizationType: 'business', accountType: 'company', settings: { defaultRole: 'employee' }, pendingInvites: [], async save() { return this; } };
  replace(Company, 'findById', () => query(company));
  replace(User, 'findById', () => query({ fullName: 'Owner' }));
  replace(planLimits, 'withCompanyCapacityLock', async (_id, run) => run());
  replace(planLimits, 'checkMemberLimit', async () => ({ allowed: true }));
  replace(email, 'sendInviteEmail', async () => ({ success: false, error: 'Email delivery failed.' }));
  const request = { body: { email: 'new@example.test' }, user: { userId: ownerId.toString(), companyId: companyId.toString(), role: 'owner' } };

  const failed = makeResponse();
  await inviteMember(request, failed);
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.body.code, 'INVITE_EMAIL_FAILED');
  assert.equal(company.pendingInvites.length, 1, 'the invitation is kept so it can be resent');

  const badEmail = makeResponse();
  await inviteMember({ ...request, body: { email: 'nope' } }, badEmail);
  assert.equal(badEmail.statusCode, 400);
  assert.match(badEmail.body.errors.email, /valid email address/);
});

test('invitation emails escape workspace and inviter names', async () => {
  const nodemailer = require('nodemailer');
  const sent = [];
  const env = { ...process.env };
  Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_USER: 'noreply@workgrind.test', SMTP_PASS: 'x', CLIENT_URL: 'https://app.workgrind.test' });
  replace(nodemailer, 'createTransport', () => ({ sendMail: async (message) => { sent.push(message); return { accepted: [message.to] }; }, close() {} }));
  email.closeEmailTransporter();
  try {
    const result = await email.sendInviteEmail('a@example.test', '<img src=x onerror=1>', 'Acme <b>Co</b>', 'tok');
    assert.equal(result.success, true);
    assert.doesNotMatch(sent[0].html, /<img src=x/);
    assert.match(sent[0].html, /Acme &lt;b&gt;Co&lt;\/b&gt;/);
    assert.match(sent[0].html, /\/join\?token=tok/);
  } finally {
    email.closeEmailTransporter();
    process.env = env;
  }
});
