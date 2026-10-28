/**
 * End-to-end academic import, export and onboarding against a real MongoDB.
 *
 * Runs only when ACADEMIC_TEST_MONGODB_URI points at a local, disposable
 * server (for example one started with mongodb-memory-server); it creates and
 * drops its own database. SMTP is replaced with an in-process transport so no
 * email leaves the machine.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const uri = process.env.ACADEMIC_TEST_MONGODB_URI;
const isLocal = Boolean(uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?/.test(uri));
const skip = isLocal ? false : 'set ACADEMIC_TEST_MONGODB_URI to a local disposable MongoDB to run';

Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: process.env.JWT_SECRET || 'academic-integration-access-secret-0123456789',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'academic-integration-refresh-secret-0123456789',
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
const ids = {};
const tokens = {};

function useSmtp(enabled) {
  const email = require('../dist/utils/email');
  email.closeEmailTransporter();
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL', 'CLIENT_URL']) delete process.env[key];
  if (enabled) {
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'noreply@workgrind.test', SMTP_PASS: 'not-a-real-password', CLIENT_URL: 'https://app.workgrind.test' });
  }
}

async function call(path, { method = 'GET', token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: payload, headers: response.headers };
}

function csvForm(fields, csv, filename = 'students.csv') {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append('file', new Blob([csv], { type: 'text/csv' }), filename);
  return form;
}

function tokenFromEmail(message) {
  return /academic-invite\?token=([A-Za-z0-9_-]+)/.exec(message.html)[1];
}

test.describe('academic onboarding (real MongoDB)', { skip }, () => {
  test.before(async () => {
    await mongoose.connect(uri, { dbName: `wg_academic_it_${Date.now()}` });
    const express = require('express');
    const { generateAccessToken } = require('../dist/utils/jwt');
    const Company = require('../dist/models/Company').default;
    const User = require('../dist/models/User').default;
    const models = ['AcademicPerson', 'AcademicEnrollment', 'AcademicImportJob', 'AcademicImportLock', 'AcademicSequence', 'AcademicInvitation', 'AcademicSettings', 'AcademicGuardianLink', 'AcademicClass', 'AcademicDepartment', 'AcademicCourse'];
    for (const name of models) await require(`../dist/models/${name}`).default.syncIndexes();
    await User.syncIndexes();

    const app = express();
    app.use(express.json());
    // Same mount order as src/index.ts.
    app.use('/api/academic/portal', require('../dist/routes/academicPortal').default);
    app.use('/api/academic', require('../dist/routes/academic').default);
    app.use('/api/academic-invitations', require('../dist/routes/academicInvitations').default);
    app.use(require('../dist/middleware/errorHandler').errorHandler);
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const makeUser = async (email, role, companyId) => User.create({
      fullName: email.split('@')[0], email, password: 'Str0ng!Passw0rd', role, isVerified: true, isActive: true, ...(companyId ? { companyId } : {}),
    });
    const ownerA = new mongoose.Types.ObjectId();
    const ownerB = new mongoose.Types.ObjectId();
    const grant = (grantedBy) => ({ plan: 'school', grantedBy, grantedAt: new Date() });
    const schoolA = await Company.create({ name: 'Greenwood High', inviteCode: 'GRNWD001', ownerId: ownerA, organizationType: 'school', accountType: 'company', isActive: true, manualGrant: grant(ownerA) });
    const schoolB = await Company.create({ name: 'Riverside School', inviteCode: 'RVRSD001', ownerId: ownerB, organizationType: 'school', accountType: 'company', isActive: true, manualGrant: grant(ownerB) });
    ids.schoolA = schoolA._id;
    ids.schoolB = schoolB._id;
    const adminA = await makeUser('admin@greenwood.test', 'admin', schoolA._id);
    const hodA = await makeUser('hod@greenwood.test', 'hod', schoolA._id);
    const adminB = await makeUser('admin@riverside.test', 'admin', schoolB._id);
    for (const [key, user] of Object.entries({ adminA, hodA, adminB })) {
      tokens[key] = generateAccessToken({ userId: user._id.toString(), companyId: user.companyId.toString(), role: user.role });
    }
    const AcademicDepartment = require('../dist/models/AcademicDepartment').default;
    const AcademicClass = require('../dist/models/AcademicClass').default;
    const science = await AcademicDepartment.create({ companyId: schoolA._id, name: 'Science', code: 'SCI' });
    const grade7a = await AcademicClass.create({ companyId: schoolA._id, departmentId: science._id, name: 'Grade 7 - A', academicYear: '2026-2027' });
    await AcademicClass.create({ companyId: schoolA._id, departmentId: science._id, name: 'Grade 7 - A', academicYear: '2025-2026' });
    ids.grade7a = grade7a._id;
    const otherDepartment = await AcademicDepartment.create({ companyId: schoolB._id, name: 'Arts', code: 'ART' });
    ids.classB = (await AcademicClass.create({ companyId: schoolB._id, departmentId: otherDepartment._id, name: 'Grade 1', academicYear: '2026-2027' }))._id;
    ids.makeUser = makeUser;
    ids.generateAccessToken = generateAccessToken;
  });

  test.after(async () => {
    server?.closeAllConnections();
    await new Promise((resolve) => server?.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  });

  const studentsCsv = [
    'Student Name,Email,DOB,Class,Section,Academic Year,Admission Date,Phone,Address,Guardian Name,Guardian Phone,Relationship',
    'Ayesha Khan,ayesha@student.test,2013-04-23,Grade 7,A,2026-2027,2026-04-01,+92 300 1111111,12 Garden Road,Imran Khan,+92 300 7654321,father',
    'Omar Khan,omar@bounce.test,2014-06-02,Grade 7,A,2026-2027,2026-04-01,,,Imran Khan,+92 300 7654321,father',
    'Sara Ali,,2013-09-15,Grade 7,A,2026-2027,,,,Nadia Ali,+92 321 5550000,mother',
  ].join('\n');

  test('department heads cannot reach institution-wide import, export or invitation routes', async () => {
    for (const path of ['/api/academic/imports/modules', '/api/academic/exports/students?format=csv', '/api/academic/invitations']) {
      const response = await call(path, { token: tokens.hodA });
      assert.equal(response.status, 403, path);
    }
    assert.equal((await call('/api/academic/imports/modules')).status, 401);
  });

  test('roll number generation follows the institution setting', async () => {
    const response = await call('/api/academic/imports/settings', { method: 'PUT', token: tokens.adminA, json: { rollNumberMode: 'sequential_per_class', rollNumberPadding: 2 } });
    assert.equal(response.status, 200);
    assert.equal(response.body.settings.rollNumberMode, 'sequential_per_class');
    assert.equal(response.body.settings.studentIdPrefix, 'STU');
  });

  test('preview maps human headers, validates, and writes nothing', async () => {
    const AcademicPerson = require('../dist/models/AcademicPerson').default;
    const response = await call('/api/academic/imports/preview', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'create_only' }, studentsCsv) });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const preview = response.body.preview;
    assert.equal(preview.mapping.fullName, 'student_name');
    assert.equal(preview.mapping.guardianRelationship, 'relationship');
    assert.equal(preview.validRows, 3, JSON.stringify(preview.issues));
    assert.equal(preview.generatedIds, 3);
    assert.deepEqual(preview.actions, { create: 3, update: 0, skip: 0 });
    assert.equal(await AcademicPerson.countDocuments({ companyId: ids.schoolA }), 0);
  });

  test('confirmed import saves complete student records with unique IDs, roll numbers and guardians', async () => {
    const AcademicPerson = require('../dist/models/AcademicPerson').default;
    const AcademicEnrollment = require('../dist/models/AcademicEnrollment').default;
    const AcademicGuardianLink = require('../dist/models/AcademicGuardianLink').default;
    const unconfirmed = await call('/api/academic/imports/jobs', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'create_only' }, studentsCsv) });
    assert.equal(unconfirmed.status, 400);

    const response = await call('/api/academic/imports/jobs', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'create_only', confirmed: 'true', idempotencyKey: 'import-key-0001' }, studentsCsv) });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.job.status, 'completed');
    assert.equal(response.body.job.successfulRows, 3);
    assert.equal(response.body.job.generatedIdCount, 3);
    assert.equal(response.body.job.personCount, 3);
    ids.importJob = response.body.job.id;

    const students = await AcademicPerson.find({ companyId: ids.schoolA, type: 'student' }).sort({ externalId: 1 }).lean();
    assert.deepEqual(students.map((student) => student.externalId), ['STU-000001', 'STU-000002', 'STU-000003']);
    const ayesha = students.find((student) => student.firstName === 'Ayesha');
    assert.equal(ayesha.email, 'ayesha@student.test');
    assert.equal(ayesha.phone, '+92 300 1111111');
    assert.equal(ayesha.address, '12 Garden Road');
    assert.equal(ayesha.dateOfBirth.toISOString().slice(0, 10), '2013-04-23');
    assert.equal(ayesha.startDate.toISOString().slice(0, 10), '2026-04-01');
    const enrollments = await AcademicEnrollment.find({ companyId: ids.schoolA }).lean();
    assert.equal(enrollments.length, 3);
    assert.ok(enrollments.every((enrollment) => enrollment.classId.toString() === ids.grade7a.toString()), 'section and academic year select the right class');
    assert.deepEqual(enrollments.map((enrollment) => enrollment.rollNumber).sort(), ['01', '02', '03']);
    const guardians = await AcademicPerson.find({ companyId: ids.schoolA, type: 'parent' }).lean();
    assert.equal(guardians.length, 2, 'the shared guardian is created once');
    assert.equal(await AcademicGuardianLink.countDocuments({ companyId: ids.schoolA }), 3);
    ids.ayesha = ayesha._id;
    ids.omar = students.find((student) => student.firstName === 'Omar')._id;
  });

  test('repeated requests and re-uploads never duplicate students', async () => {
    const AcademicPerson = require('../dist/models/AcademicPerson').default;
    const sameKey = await call('/api/academic/imports/jobs', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'create_only', confirmed: 'true', idempotencyKey: 'import-key-0001' }, studentsCsv) });
    assert.equal(sameKey.status, 200);
    assert.equal(sameKey.body.idempotent, true);
    const sameFile = await call('/api/academic/imports/jobs', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'create_only', confirmed: 'true', idempotencyKey: 'import-key-0002' }, studentsCsv) });
    assert.equal(sameFile.status, 409);
    assert.equal(sameFile.body.code, 'DUPLICATE_FILE');
    const forced = await call('/api/academic/imports/jobs', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'create_only', confirmed: 'true', idempotencyKey: 'import-key-0003', allowReimport: 'true' }, studentsCsv) });
    assert.equal(forced.status, 201);
    assert.equal(forced.body.job.successfulRows, 0, 'duplicate email, name and birth date checks stop every row');
    assert.equal(forced.body.job.failedRows, 3);
    assert.equal(await AcademicPerson.countDocuments({ companyId: ids.schoolA, type: 'student' }), 3);

    const errors = await call(`/api/academic/imports/jobs/${forced.body.job.id}/errors.csv`, { token: tokens.adminA });
    assert.equal(errors.status, 200);
    assert.match(errors.body.toString('utf8'), /duplicate_email|possible_duplicate/);
  });

  test('upserts update matched IDs without overwriting blank fields', async () => {
    const AcademicPerson = require('../dist/models/AcademicPerson').default;
    const csv = 'Student ID,First Name,Last Name,Phone\nSTU-000001,Ayesha,Khan,+92 300 2222222\n';
    const response = await call('/api/academic/imports/jobs', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'upsert', confirmed: 'true', idempotencyKey: 'import-key-0004' }, csv, 'update.csv') });
    assert.equal(response.status, 201);
    assert.equal(response.body.job.successfulRows, 1);
    const ayesha = await AcademicPerson.findById(ids.ayesha).lean();
    assert.equal(ayesha.phone, '+92 300 2222222');
    assert.equal(ayesha.email, 'ayesha@student.test', 'a column that is not supplied keeps its value');
  });

  test('concurrent ID reservations and import locks stay unique', async () => {
    const { generatePersonExternalId, getIdentifierSettings, acquireImportLock, releaseImportLock, AcademicImportBusyError } = require('../dist/services/academicIdentifiers');
    const settings = await getIdentifierSettings(ids.schoolA);
    const generated = await Promise.all(Array.from({ length: 25 }, () => generatePersonExternalId(ids.schoolA, 'student', settings)));
    assert.equal(new Set(generated).size, 25);
    const jobs = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const results = await Promise.allSettled(jobs.map((jobId) => acquireImportLock(ids.schoolA, jobId)));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.ok(results.find((result) => result.status === 'rejected').reason instanceof AcademicImportBusyError);
    await Promise.all(jobs.map((jobId) => releaseImportLock(ids.schoolA, jobId)));
    await acquireImportLock(ids.schoolB, jobs[0]);
    await releaseImportLock(ids.schoolB, jobs[0]);
  });

  test('another institution cannot see, export, reference or invite these students', async () => {
    const exported = await call('/api/academic/exports/students?format=csv', { token: tokens.adminB });
    assert.equal(exported.status, 200);
    assert.doesNotMatch(exported.body.toString('utf8'), /STU-000001|ayesha/);
    const listing = await call('/api/academic/invitations?type=student', { token: tokens.adminB });
    assert.equal(listing.body.total, 0);
    const preview = await call('/api/academic/imports/preview', { method: 'POST', token: tokens.adminB, form: csvForm({ module: 'enrollments' }, `studentExternalId,classId\nSTU-000001,${ids.grade7a}\n`, 'enrollments.csv') });
    assert.equal(preview.body.preview.validRows, 0);
    assert.ok(preview.body.preview.issues.some((item) => item.field === 'classId' && item.code === 'unknown_reference'));
    useSmtp(true);
    const invite = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminB, json: { personIds: [ids.ayesha.toString()], confirmed: true } });
    assert.equal(invite.status, 200);
    assert.equal(invite.body.summary.sent, 0);
    assert.equal(outbox.length, 0);
    const job = await call(`/api/academic/imports/jobs/${ids.importJob}`, { token: tokens.adminB });
    assert.equal(job.status, 404);
  });

  test('invitations are never reported as sent when email is not configured', async () => {
    const AcademicInvitation = require('../dist/models/AcademicInvitation').default;
    useSmtp(false);
    const response = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { importJobId: ids.importJob, confirmed: true } });
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'EMAIL_NOT_CONFIGURED');
    assert.equal(await AcademicInvitation.countDocuments({}), 0);
    const unconfirmed = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { importJobId: ids.importJob } });
    assert.equal(unconfirmed.status, 400);
  });

  test('confirmed invitations report sent, failed and skipped people truthfully', async () => {
    useSmtp(true);
    const response = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { importJobId: ids.importJob, confirmed: true } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.summary, { sent: 1, failed: 1, already_linked: 0, already_accepted: 0, no_email: 1, inactive: 0 });
    const delivered = outbox.find((message) => message.to === 'ayesha@student.test');
    assert.ok(delivered);
    assert.doesNotMatch(delivered.html, /STU-000001|2013-04-23|Garden Road/, 'the email carries no student record data');
    tokens.invite = tokenFromEmail(delivered);

    const listing = await call('/api/academic/invitations?type=student', { token: tokens.adminA });
    const byName = Object.fromEntries(listing.body.invitations.map((row) => [row.name, row]));
    assert.equal(byName['Ayesha Khan'].status, 'sent');
    assert.equal(byName['Omar Khan'].status, 'failed');
    assert.equal(byName['Omar Khan'].retryable, true);
    assert.equal(byName['Sara Ali'].status, 'no_email');

    const retry = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { scope: 'retryable', type: 'student', confirmed: true } });
    assert.equal(retry.body.summary.failed, 1);
    const after = await call('/api/academic/invitations?type=student&status=failed', { token: tokens.adminA });
    assert.equal(after.body.invitations[0].sendAttempts, 2);
  });

  test('the invitation link is single-use, email-bound and links the account to the right institution', async () => {
    const AcademicPerson = require('../dist/models/AcademicPerson').default;
    const User = require('../dist/models/User').default;
    const publicView = await call(`/api/academic-invitations/${tokens.invite}`);
    assert.equal(publicView.status, 200);
    assert.deepEqual(Object.keys(publicView.body.invitation).sort(), ['email', 'expiresAt', 'firstName', 'institutionName', 'organizationType', 'role']);
    assert.equal(publicView.body.invitation.institutionName, 'Greenwood High');

    const stranger = await ids.makeUser('stranger@example.test', 'owner');
    const strangerToken = ids.generateAccessToken({ userId: stranger._id.toString(), companyId: '', role: 'owner' });
    const mismatch = await call('/api/academic-invitations/accept', { method: 'POST', token: strangerToken, json: { token: tokens.invite } });
    assert.equal(mismatch.status, 403);
    assert.equal(mismatch.body.code, 'EMAIL_MISMATCH');

    const student = await ids.makeUser('ayesha@student.test', 'owner');
    const studentToken = ids.generateAccessToken({ userId: student._id.toString(), companyId: '', role: 'owner' });
    const accepted = await call('/api/academic-invitations/accept', { method: 'POST', token: studentToken, json: { token: tokens.invite } });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.role, 'student');
    assert.equal(accepted.body.company.name, 'Greenwood High');
    assert.equal(accepted.body.company.inviteCode, undefined);
    assert.ok(accepted.body.accessToken);
    const linkedUser = await User.findById(student._id).lean();
    assert.equal(linkedUser.companyId.toString(), ids.schoolA.toString());
    assert.equal(linkedUser.role, 'student');
    assert.equal((await AcademicPerson.findById(ids.ayesha).lean()).userId.toString(), student._id.toString());

    const reused = await call('/api/academic-invitations/accept', { method: 'POST', token: accepted.body.accessToken, json: { token: tokens.invite } });
    assert.equal(reused.status, 410);
    assert.equal((await call(`/api/academic-invitations/${tokens.invite}`)).status, 404);

    const portal = await call('/api/academic/portal/me', { token: accepted.body.accessToken });
    tokens.portalStatus = portal.status;
    const listing = await call('/api/academic/invitations?type=student&status=accepted', { token: tokens.adminA });
    assert.equal(listing.body.invitations[0].name, 'Ayesha Khan');
    const resend = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { personIds: [ids.ayesha.toString()], confirmed: true } });
    assert.equal(resend.body.summary.already_linked, 1, 'onboarded students are never re-invited');
  });

  test('expired and revoked links cannot be used', async () => {
    const AcademicInvitation = require('../dist/models/AcademicInvitation').default;
    const AcademicPerson = require('../dist/models/AcademicPerson').default;
    const teacher = await AcademicPerson.create({ companyId: ids.schoolA, type: 'teacher', firstName: 'Bilal', lastName: 'Raza', email: 'bilal@teacher.test', externalId: 'TCH-000001' });
    outbox.length = 0;
    const sent = await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { personIds: [teacher._id.toString()], confirmed: true } });
    assert.equal(sent.body.summary.sent, 1);
    const token = tokenFromEmail(outbox[0]);
    await AcademicInvitation.updateOne({ personId: teacher._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const user = await ids.makeUser('bilal@teacher.test', 'owner');
    const userToken = ids.generateAccessToken({ userId: user._id.toString(), companyId: '', role: 'owner' });
    assert.equal((await call('/api/academic-invitations/accept', { method: 'POST', token: userToken, json: { token } })).status, 410);
    const listing = await call('/api/academic/invitations?type=teacher', { token: tokens.adminA });
    assert.equal(listing.body.invitations[0].status, 'expired');
    assert.equal(listing.body.invitations[0].retryable, true);

    outbox.length = 0;
    await call('/api/academic/invitations/send', { method: 'POST', token: tokens.adminA, json: { personIds: [teacher._id.toString()], confirmed: true } });
    const fresh = tokenFromEmail(outbox[0]);
    const invitationId = (await AcademicInvitation.findOne({ personId: teacher._id }).lean())._id.toString();
    assert.equal((await call(`/api/academic/invitations/${invitationId}/revoke`, { method: 'POST', token: tokens.adminA })).status, 200);
    assert.equal((await call('/api/academic-invitations/accept', { method: 'POST', token: userToken, json: { token: fresh } })).status, 410);
  });

  test('exports return re-importable records with onboarding status', async () => {
    const csv = await call('/api/academic/exports/students?format=csv', { token: tokens.adminA });
    assert.equal(csv.status, 200);
    const text = csv.body.toString('utf8').replace(/^﻿/, '');
    const [header, ...rows] = text.trim().split('\n');
    assert.match(header, /^externalId,firstName,lastName,email,phone,dateOfBirth,admissionDate,className/);
    assert.match(header, /onboardingStatus$/);
    const ayesha = rows.find((row) => row.includes('STU-000001'));
    assert.match(ayesha, /"Grade 7 - A","","2026-2027"/);
    assert.match(ayesha, /"'\+92 300 2222222"/, 'phone numbers are protected from formula evaluation');
    assert.match(ayesha, /"account_linked"$/);
    const xlsx = await call('/api/academic/exports/students?format=xlsx', { token: tokens.adminA });
    assert.equal(xlsx.status, 200);
    assert.ok(xlsx.body.subarray(0, 2).equals(Buffer.from('PK')));

    const reimport = await call('/api/academic/imports/preview', { method: 'POST', token: tokens.adminA, form: csvForm({ module: 'students', mode: 'upsert' }, csv.body, 'export.csv') });
    assert.equal(reimport.body.preview.validRows, 3, JSON.stringify(reimport.body.preview.issues));
    assert.deepEqual(reimport.body.preview.actions, { create: 0, update: 3, skip: 0 });
  });

  test('a linked student can open their academic portal', () => {
    assert.equal(tokens.portalStatus, 200);
  });
});
