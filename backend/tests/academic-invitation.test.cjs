const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const mongoose = require('mongoose');
const AcademicInvitation = require('../dist/models/AcademicInvitation').default;
const AcademicPerson = require('../dist/models/AcademicPerson').default;
const AuditLog = require('../dist/models/AuditLog').default;
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const invitations = require('../dist/services/academicInvitation.service');
const { EmailProviderConfigurationError } = require('../dist/utils/email');
const { requireAcademicInstitutionAdmin } = require('../dist/middleware/academicOrganization');

const companyId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

function replace(model, name, implementation) {
  const original = model[name];
  model[name] = implementation;
  return () => { model[name] = original; };
}

function chain(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function restoreAll(restore) {
  restore.reverse().forEach((undo) => undo());
}

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('invitation tokens are random, URL-safe, and stored only as SHA-256 hashes', () => {
  const first = invitations.createInvitationToken();
  const second = invitations.createInvitationToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, crypto.createHash('sha256').update(first.token).digest('hex'));
  assert.equal(invitations.hashInvitationToken(first.token), first.tokenHash);
  assert.ok(!first.tokenHash.includes(first.token));
});

test('sent invitations past their expiry are reported as expired and retryable', () => {
  const past = { status: 'sent', expiresAt: new Date(Date.now() - 1000) };
  const future = { status: 'sent', expiresAt: new Date(Date.now() + 60_000) };
  assert.equal(invitations.displayStatus(past), 'expired');
  assert.equal(invitations.isRetryable(past), true);
  assert.equal(invitations.displayStatus(future), 'sent');
  assert.equal(invitations.isRetryable(future), false);
  assert.equal(invitations.isRetryable({ status: 'failed' }), true);
  assert.equal(invitations.isRetryable({ status: 'accepted' }), false);
});

test('missing email configuration stops invitations before any record is written', async () => {
  const writes = [];
  const restore = [
    replace(AcademicInvitation, 'findOneAndUpdate', () => { writes.push('invitation'); return chain(null); }),
    replace(AcademicPerson, 'find', () => { writes.push('people'); return chain([]); }),
  ];
  try {
    await assert.rejects(
      invitations.sendAcademicInvitations({
        companyId,
        userId: adminId,
        personIds: [new mongoose.Types.ObjectId()],
        checkConfiguration: async () => { throw new EmailProviderConfigurationError(['SMTP_HOST']); },
        sender: async () => { throw new Error('must not send'); },
      }),
      EmailProviderConfigurationError,
    );
    assert.deepEqual(writes, []);
  } finally {
    restoreAll(restore);
  }
});

test('only provider-accepted emails are marked sent; failures discard the token and stay retryable', async () => {
  const accepted = { _id: new mongoose.Types.ObjectId(), type: 'student', firstName: 'Ayesha', email: 'ayesha@example.edu', status: 'active' };
  const bounced = { _id: new mongoose.Types.ObjectId(), type: 'student', firstName: 'Bilal', email: 'bounce@example.edu', status: 'active' };
  const noEmail = { _id: new mongoose.Types.ObjectId(), type: 'student', firstName: 'Sara', status: 'active' };
  const linked = { _id: new mongoose.Types.ObjectId(), type: 'student', firstName: 'Omar', email: 'omar@example.edu', status: 'active', userId: new mongoose.Types.ObjectId() };
  const upserts = new Map();
  const updates = [];
  const emails = [];
  const restore = [
    replace(Company, 'findOne', () => chain({ _id: companyId, name: 'Greenwood <High>', organizationType: 'school' })),
    replace(AcademicPerson, 'find', (filter) => {
      assert.equal(filter.companyId, companyId, 'people are always tenant-scoped');
      return chain([accepted, bounced, noEmail, linked]);
    }),
    replace(AcademicInvitation, 'find', () => chain([])),
    replace(AcademicInvitation, 'findOneAndUpdate', async (filter, update) => {
      assert.equal(filter.companyId, companyId);
      const record = { _id: new mongoose.Types.ObjectId(), ...update.$set };
      upserts.set(filter.personId.toString(), record);
      return record;
    }),
    replace(AcademicInvitation, 'updateOne', async (filter, update) => { updates.push({ filter, update }); return { modifiedCount: 1 }; }),
    replace(AuditLog, 'create', async () => ({})),
  ];
  try {
    const outcome = await invitations.sendAcademicInvitations({
      companyId,
      userId: adminId,
      personIds: [accepted._id, bounced._id, noEmail._id, linked._id],
      checkConfiguration: async () => undefined,
      sender: async (message) => {
        emails.push(message);
        return message.email.startsWith('bounce')
          ? { success: false, error: 'Email provider did not accept the recipient.' }
          : { success: true, messageId: 'queued-1' };
      },
    });
    assert.deepEqual(outcome.summary, { sent: 1, failed: 1, already_linked: 1, already_accepted: 0, no_email: 1, inactive: 0 });
    assert.equal(emails.length, 2);
    const delivered = emails.find((message) => message.email === accepted.email);
    assert.equal(delivered.institutionName, 'Greenwood <High>');
    assert.equal(upserts.get(accepted._id.toString()).tokenHash, invitations.hashInvitationToken(delivered.token));
    assert.ok(upserts.get(accepted._id.toString()).expiresAt > new Date(Date.now() + 6 * 86_400_000));
    const sentUpdate = updates.find((item) => item.update.$set?.status === 'sent');
    assert.equal(sentUpdate.filter._id, upserts.get(accepted._id.toString())._id);
    const failedUpdate = updates.find((item) => item.update.$set?.status === 'failed');
    assert.equal(failedUpdate.filter._id, upserts.get(bounced._id.toString())._id);
    assert.deepEqual(failedUpdate.update.$unset, { tokenHash: 1 });
    assert.match(failedUpdate.update.$set.lastError, /did not accept/);
    assert.equal(outcome.results.find((item) => item.personId === bounced._id.toString()).outcome, 'failed');
  } finally {
    restoreAll(restore);
  }
});

test('invitation emails escape institution names and never include passwords or student data in the link', async () => {
  const email = require('../dist/utils/email');
  const nodemailer = require('nodemailer');
  const sent = [];
  const env = { ...process.env };
  Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_USER: 'noreply@workgrind.test', SMTP_PASS: 'x', CLIENT_URL: 'https://app.workgrind.test' });
  const restore = [replace(nodemailer, 'createTransport', () => ({
    sendMail: async (message) => { sent.push(message); return { accepted: [message.to], messageId: 'm1' }; },
    close() {},
  }))];
  email.closeEmailTransporter();
  try {
    const token = invitations.createInvitationToken().token;
    const result = await email.sendAcademicInvitationEmail({ email: 'ayesha@example.edu', firstName: '<b>Ayesha</b>', institutionName: 'Green & <wood>', roleLabel: 'student', token, expiresAt: new Date(Date.now() + 7 * 86_400_000) });
    assert.equal(result.success, true);
    assert.equal(sent.length, 1);
    assert.match(sent[0].html, /Green &amp; &lt;wood&gt;/);
    assert.match(sent[0].html, /&lt;b&gt;Ayesha/);
    const link = /href="([^"]+academic-invite[^"]+)"/.exec(sent[0].html)[1];
    assert.equal(link, `https://app.workgrind.test/academic-invite?token=${token}`);
    assert.doesNotMatch(sent[0].html, /password:/i);
  } finally {
    email.closeEmailTransporter();
    restoreAll(restore);
    process.env = env;
  }
});

test('malformed or unknown invitation tokens are rejected without exposing details', async () => {
  let lookups = 0;
  const restore = [replace(AcademicInvitation, 'findOne', () => { lookups += 1; return chain(null); })];
  try {
    await assert.rejects(invitations.acceptAcademicInvitation('short', adminId.toString()), (error) => error.status === 410);
    assert.equal(lookups, 0, 'malformed tokens never reach the database');
    assert.equal(await invitations.describeAcademicInvitation('x'.repeat(43)), null);
    assert.equal(lookups, 1);
  } finally {
    restoreAll(restore);
  }
});

test('accepting requires the invited email and refuses accounts in another workspace', async () => {
  const token = invitations.createInvitationToken();
  const invitation = { _id: new mongoose.Types.ObjectId(), companyId, personId: new mongoose.Types.ObjectId(), email: 'ayesha@example.edu', tokenHash: token.tokenHash, status: 'sent', expiresAt: new Date(Date.now() + 60_000) };
  let user = { _id: new mongoose.Types.ObjectId(), email: 'someone@example.edu', isActive: true, isVerified: true, isDeleted: false };
  let claims = 0;
  const restore = [
    replace(AcademicInvitation, 'findOne', (filter) => {
      assert.equal(filter.tokenHash, token.tokenHash);
      return chain(invitation);
    }),
    replace(User, 'findById', () => chain(user)),
    replace(Company, 'findOne', () => chain({ organizationType: 'school' })),
    replace(AcademicPerson, 'findOne', () => chain({ _id: invitation.personId, type: 'student' })),
    replace(AcademicInvitation, 'findOneAndUpdate', async () => { claims += 1; return null; }),
  ];
  try {
    await assert.rejects(invitations.acceptAcademicInvitation(token.token, user._id.toString()), (error) => error.code === 'EMAIL_MISMATCH' && error.status === 403);
    user = { ...user, email: 'Ayesha@Example.edu', companyId: new mongoose.Types.ObjectId() };
    await assert.rejects(invitations.acceptAcademicInvitation(token.token, user._id.toString()), (error) => error.code === 'OTHER_WORKSPACE' && error.status === 409);
    user = { ...user, isVerified: false, companyId: undefined };
    await assert.rejects(invitations.acceptAcademicInvitation(token.token, user._id.toString()), (error) => error.code === 'ACCOUNT_NOT_ELIGIBLE');
    assert.equal(claims, 0, 'no invitation is consumed by a rejected attempt');
  } finally {
    restoreAll(restore);
  }
});

test('imports, exports and invitations are limited to institution administrators', async () => {
  const requireInstitutionDataAdmin = requireAcademicInstitutionAdmin;
  const roles = { hod: 403, dean: 403, teacher: 403, student: 403, parent: 403, admin: 200, office_staff: 200, principal: 200, vice_chancellor: 200, owner: 200 };
  for (const [role, expected] of Object.entries(roles)) {
    const userId = new mongoose.Types.ObjectId();
    const restore = [
      replace(User, 'findById', () => chain({ _id: userId, companyId, role, isActive: true, isVerified: true, isDeleted: false })),
      replace(Company, 'findOne', () => chain({ _id: companyId, organizationType: 'university', isActive: true })),
    ];
    try {
      const res = makeResponse();
      let nextCalled = false;
      await requireInstitutionDataAdmin({ user: { userId: userId.toString(), companyId: companyId.toString(), role } }, res, () => { nextCalled = true; });
      assert.equal(nextCalled ? 200 : res.statusCode, expected, `role ${role}`);
    } finally {
      restoreAll(restore);
    }
  }
});
