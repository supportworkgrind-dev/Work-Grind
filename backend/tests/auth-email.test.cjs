const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const test = require('node:test');

process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const User = require('../dist/models/User').default;
const PendingRegistration = require('../dist/models/PendingRegistration').default;
const email = require('../dist/utils/email');
const authController = require('../dist/controllers/auth.controller');
const { encryptPendingPassword, hashVerificationCode } = require('../dist/services/pendingRegistration');

const original = {
  userExists: User.exists,
  userCreate: User.create,
  userFindOne: User.findOne,
  userFindOneAndUpdate: User.findOneAndUpdate,
  userUpdateOne: User.updateOne,
  pendingFindOne: PendingRegistration.findOne,
  pendingCreate: PendingRegistration.create,
  pendingFindOneAndUpdate: PendingRegistration.findOneAndUpdate,
  pendingDeleteOne: PendingRegistration.deleteOne,
  pendingUpdateOne: PendingRegistration.updateOne,
  sendVerificationCodeEmail: email.sendVerificationCodeEmail,
  sendPasswordResetEmail: email.sendPasswordResetEmail,
  sendWelcomeEmail: email.sendWelcomeEmail,
};

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const requestForRegister = {
  body: {
    fullName: 'Test User',
    email: 'signup@example.test',
    password: 'StrongPass1!',
    accountType: 'company',
    organizationType: 'business',
  },
};

test.afterEach(() => {
  User.exists = original.userExists;
  User.create = original.userCreate;
  User.findOne = original.userFindOne;
  User.findOneAndUpdate = original.userFindOneAndUpdate;
  User.updateOne = original.userUpdateOne;
  PendingRegistration.findOne = original.pendingFindOne;
  PendingRegistration.create = original.pendingCreate;
  PendingRegistration.findOneAndUpdate = original.pendingFindOneAndUpdate;
  PendingRegistration.deleteOne = original.pendingDeleteOne;
  PendingRegistration.updateOne = original.pendingUpdateOne;
  email.sendVerificationCodeEmail = original.sendVerificationCodeEmail;
  email.sendPasswordResetEmail = original.sendPasswordResetEmail;
  email.sendWelcomeEmail = original.sendWelcomeEmail;
});

test('signup returns accepted only after the SMTP provider confirms email acceptance', async () => {
  let saved;
  let mailed = 0;
  User.exists = async () => false;
  PendingRegistration.findOne = async () => null;
  PendingRegistration.create = async (record) => { saved = record; return record; };
  email.sendVerificationCodeEmail = async () => { mailed += 1; return { success: true, messageId: 'accepted' }; };

  const response = makeResponse();
  await authController.register(requestForRegister, response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.success, true);
  assert.equal(mailed, 1);
  assert.equal(saved.email, 'signup@example.test');
  assert.equal(typeof saved.verificationCodeHash, 'string');
  assert.equal(saved.verificationCodeHash.length, 64);
  assert.equal(saved.accountType, 'company');
  assert.equal(saved.organizationType, 'business');
});

test('signup requires a valid account and organization type before issuing verification', async () => {
  let created = false;
  PendingRegistration.create = async () => { created = true; };
  const response = makeResponse();

  await authController.register({
    body: { ...requestForRegister.body, accountType: undefined, organizationType: undefined },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(created, false);
});

test('all five signup choices persist into pending registration', async () => {
  const choices = [
    { accountType: 'individual', organizationType: 'business' },
    { accountType: 'company', organizationType: 'business' },
    { accountType: 'company', organizationType: 'school' },
    { accountType: 'company', organizationType: 'college' },
    { accountType: 'company', organizationType: 'university' },
  ];
  let saved;
  User.exists = async () => false;
  PendingRegistration.findOne = async () => null;
  PendingRegistration.create = async (record) => { saved = record; return record; };
  email.sendVerificationCodeEmail = async () => ({ success: true });

  for (const [index, choice] of choices.entries()) {
    const response = makeResponse();
    await authController.register({
      body: {
        ...requestForRegister.body,
        email: `signup-${index}@example.test`,
        ...choice,
      },
    }, response);
    assert.equal(response.statusCode, 202);
    assert.equal(saved.accountType, choice.accountType);
    assert.equal(saved.organizationType, choice.organizationType);
  }
});

test('email verification creates an unassigned signup as workspace owner with the selected type', async () => {
  const emailAddress = 'school-owner@example.test';
  const code = '123456';
  const password = 'StrongPass1!';
  const pending = {
    _id: 'pending-school-owner',
    email: emailAddress,
    fullName: 'School Owner',
    ...encryptPendingPassword(password),
    verificationCodeHash: hashVerificationCode(emailAddress, code),
    accountType: 'company',
    organizationType: 'school',
    attempts: 1,
  };
  let createdData;
  PendingRegistration.findOneAndUpdate = async () => pending;
  PendingRegistration.deleteOne = async () => ({ deletedCount: 1 });
  User.exists = async () => false;
  User.create = async (data) => {
    createdData = data;
    return {
      ...data,
      _id: { toString: () => 'verified-school-owner' },
      callingId: 'WG-12345',
      refreshTokens: [],
      save: async () => {},
    };
  };
  email.sendWelcomeEmail = async () => ({ success: true });
  const response = makeResponse();
  response.cookie = () => {};

  await authController.verifyRegistrationCode({
    body: { email: emailAddress, code },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(createdData.role, 'owner');
  assert.equal(createdData.accountType, 'company');
  assert.equal(createdData.signupOrganizationType, 'school');
  assert.equal(response.body.user.role, 'owner');
  assert.equal(response.body.user.signupOrganizationType, 'school');
});

test('signup returns a delivery error and invalidates pending code when provider rejects delivery', async () => {
  let savedHash;
  let clearFilter;
  let clearUpdate;
  User.exists = async () => false;
  PendingRegistration.findOne = async () => null;
  PendingRegistration.create = async (record) => { savedHash = record.verificationCodeHash; return record; };
  PendingRegistration.updateOne = async (filter, update) => {
    clearFilter = filter;
    clearUpdate = update;
    return { modifiedCount: 1 };
  };
  email.sendVerificationCodeEmail = async () => ({ success: false, error: 'Email delivery failed.' });

  const response = makeResponse();
  await authController.register(requestForRegister, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /could not deliver/i);
  assert.equal(clearFilter.email, 'signup@example.test');
  assert.equal(clearFilter.verificationCodeHash, savedHash);
  assert.deepEqual(clearUpdate.$unset, { verificationCodeHash: 1, verificationExpiresAt: 1 });
});

test('expired signup verification codes are rejected without creating an account', async () => {
  let filter;
  PendingRegistration.findOneAndUpdate = async (query) => { filter = query; return null; };
  User.findOneAndUpdate = () => ({ select: async () => null });
  const response = makeResponse();

  await authController.verifyRegistrationCode({
    body: { email: 'signup@example.test', code: '123456' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /invalid or expired/i);
  assert.ok(filter.verificationExpiresAt.$gt instanceof Date);
  assert.ok(filter.expiresAt.$gt instanceof Date);
});

test('password reset provider failure clears the unusable token and keeps the anti-enumeration response', async () => {
  const user = {
    _id: 'reset-user',
    email: 'reset@example.test',
    fullName: 'Reset User',
    save: async () => {},
  };
  let clearFilter;
  User.findOne = async () => user;
  User.updateOne = async (filter) => { clearFilter = filter; return { modifiedCount: 1 }; };
  email.sendPasswordResetEmail = async () => ({ success: false, error: 'Email delivery failed.' });
  const response = makeResponse();

  await authController.forgotPassword({ body: { email: 'reset@example.test' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.match(response.body.message, /does not confirm whether an email was sent/i);
  assert.equal(clearFilter._id, user._id);
  assert.equal(typeof clearFilter.resetPasswordToken, 'string');
});
