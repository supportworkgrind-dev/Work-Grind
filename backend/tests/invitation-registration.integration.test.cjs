/**
 * End-to-end workspace invitation against a real MongoDB: an owner invites a
 * teacher, the invitee registers exactly as the /join page does, verifies the
 * emailed code, joins, and lands in the inviting school with the invited role.
 *
 * Runs only when ACADEMIC_TEST_MONGODB_URI points at a local, disposable
 * server; it creates and drops its own database. SMTP is replaced with an
 * in-process transport so no email leaves the machine.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const uri = process.env.ACADEMIC_TEST_MONGODB_URI;
const isLocal = Boolean(uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?/.test(uri));
const skip = isLocal ? false : 'set ACADEMIC_TEST_MONGODB_URI to a local disposable MongoDB to run';

Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: process.env.JWT_SECRET || 'invitation-integration-access-secret-0123456789',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'invitation-integration-refresh-secret-0123456789',
  SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'noreply@workgrind.test', SMTP_PASS: 'not-a-real-password',
  CLIENT_URL: 'https://app.workgrind.test',
});

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const outbox = [];
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    outbox.push(message);
    // Addresses at bounce.test are refused, as a provider would refuse them.
    return message.to.endsWith('@bounce.test')
      ? { accepted: [], rejected: [message.to], messageId: `m-${outbox.length}` }
      : { accepted: [message.to], rejected: [], messageId: `m-${outbox.length}` };
  },
  close() {},
});

let server;
let baseUrl;
const state = {};

async function call(path, { method = 'GET', token, json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const lastMailTo = (address) => [...outbox].reverse().find((message) => message.to === address);

test.describe('workspace invitation registration (real MongoDB)', { skip }, () => {
  test.before(async () => {
    await mongoose.connect(uri, { dbName: `wg_invitation_it_${Date.now()}` });
    const express = require('express');
    const Company = require('../dist/models/Company').default;
    const User = require('../dist/models/User').default;
    const { generateAccessToken } = require('../dist/utils/jwt');
    for (const name of ['User', 'Company', 'PendingRegistration']) await require(`../dist/models/${name}`).default.syncIndexes();

    const app = express();
    app.use(express.json());
    app.use('/api/auth', require('../dist/routes/auth').default);
    app.use('/api/companies', require('../dist/routes/companies').default);
    app.use(require('../dist/middleware/errorHandler').errorHandler);
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;

    const ownerId = new mongoose.Types.ObjectId();
    const grant = { plan: 'school', grantedBy: ownerId, grantedAt: new Date() };
    const school = await Company.create({ name: 'Greenwood <School>', inviteCode: 'GRNWD002', ownerId, organizationType: 'school', accountType: 'company', isActive: true, manualGrant: grant });
    const owner = await User.create({ _id: ownerId, fullName: 'Owner Person', email: 'owner@greenwood.test', password: 'Str0ng!Passw0rd', role: 'owner', isVerified: true, isActive: true, companyId: school._id });
    state.school = school;
    state.ownerToken = generateAccessToken({ userId: owner._id.toString(), companyId: school._id.toString(), role: 'owner' });
  });

  test.after(async () => {
    server?.closeAllConnections();
    await new Promise((resolve) => server?.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  });

  test('the owner invites a teacher and the email carries a join link', async () => {
    const response = await call('/companies/invite', { method: 'POST', token: state.ownerToken, json: { email: 'teacher@greenwood.test', role: 'teacher' } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const mail = lastMailTo('teacher@greenwood.test');
    assert.match(mail.html, /Greenwood &lt;School&gt;/, 'the workspace name is escaped');
    state.inviteToken = /\/join\?token=([\w-]+)/.exec(mail.html)[1];
    const invite = await call(`/auth/invite/${state.inviteToken}`);
    assert.equal(invite.body.invite.email, 'teacher@greenwood.test');
    assert.equal(invite.body.invite.role, 'teacher');
    assert.equal(invite.body.invite.organizationType, 'school');
  });

  test('the payload the /join page used to send is rejected only for the missing workspace type', async () => {
    const response = await call('/auth/register', { method: 'POST', json: { fullName: 'Tariq Teacher', email: 'teacher@greenwood.test', password: 'Str0ng!Passw0rd' } });
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(response.body.errors).sort(), ['accountType', 'organizationType']);
  });

  test('invited registration errors name the exact field', async () => {
    const weak = await call('/auth/register', { method: 'POST', json: { fullName: 'Tariq Teacher', email: 'teacher@greenwood.test', password: 'weakpassword', inviteToken: state.inviteToken } });
    assert.equal(weak.status, 400);
    assert.deepEqual(weak.body.errors, { password: 'Your password needs an uppercase letter, a number and a symbol such as ! @ # or ?.' });
    const otherEmail = await call('/auth/register', { method: 'POST', json: { fullName: 'Tariq Teacher', email: 'someone@greenwood.test', password: 'Str0ng!Passw0rd', inviteToken: state.inviteToken } });
    assert.equal(otherEmail.status, 400);
    assert.deepEqual(Object.keys(otherEmail.body.errors), ['email']);
    const unknown = await call('/auth/register', { method: 'POST', json: { fullName: 'Tariq Teacher', email: 'teacher@greenwood.test', password: 'Str0ng!Passw0rd', inviteToken: 'not-a-real-invite' } });
    assert.deepEqual(Object.keys(unknown.body.errors), ['invitation']);
  });

  test('the invitee registers, verifies the emailed code, and joins as a teacher', async () => {
    const PendingRegistration = require('../dist/models/PendingRegistration').default;
    const User = require('../dist/models/User').default;
    outbox.length = 0;
    const registered = await call('/auth/register', { method: 'POST', json: { fullName: 'Tariq Teacher', email: 'teacher@greenwood.test', password: 'Str0ng!Passw0rd', inviteToken: state.inviteToken } });
    assert.equal(registered.status, 202, JSON.stringify(registered.body));
    const pending = await PendingRegistration.findOne({ email: 'teacher@greenwood.test' }).lean();
    assert.equal(pending.organizationType, 'school', 'the workspace type comes from the invitation');
    assert.equal(pending.accountType, 'company');
    // The code is the only text of its span (the template also has six-digit colors).
    const code = />(\d{6})<\/span>/.exec(lastMailTo('teacher@greenwood.test').html)[1];

    const verified = await call('/auth/verify-registration-code', { method: 'POST', json: { email: 'teacher@greenwood.test', code } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    const joined = await call('/auth/join-company', { method: 'POST', token: verified.body.accessToken, json: { inviteToken: state.inviteToken, inviteCode: state.inviteToken } });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    assert.equal(joined.body.role, 'teacher');
    assert.equal(joined.body.company.organizationType, 'school');

    const teacher = await User.findOne({ email: 'teacher@greenwood.test' }).lean();
    assert.equal(teacher.companyId.toString(), state.school._id.toString());
    assert.equal(teacher.role, 'teacher');
    const reused = await call('/auth/invite/' + state.inviteToken);
    assert.equal(reused.status, 404, 'the invitation is single-use');
  });

  test('an invitation whose email the provider refuses is reported, kept, and can be resent', async () => {
    const failed = await call('/companies/invite', { method: 'POST', token: state.ownerToken, json: { email: 'parent@bounce.test', role: 'parent' } });
    assert.equal(failed.status, 502);
    assert.equal(failed.body.code, 'INVITE_EMAIL_FAILED');
    const invites = await call('/companies/invites', { token: state.ownerToken });
    const kept = invites.body.invites.find((invite) => invite.email === 'parent@bounce.test');
    assert.ok(kept, 'the pending invitation is kept');
    const resent = await call(`/companies/invites/${kept.token}/resend`, { method: 'POST', token: state.ownerToken });
    assert.equal(resent.status, 502, 'resending also reports the refused delivery');
  });
});
