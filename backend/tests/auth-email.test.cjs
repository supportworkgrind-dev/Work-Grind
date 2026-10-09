const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const test = require('node:test');

process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const User = require('../dist/models/User').default;
const PendingRegistration = require('../dist/models/PendingRegistration').default;
const email = require('../dist/utils/email');
const authController = require('../dist/controllers/auth.controller');

const original = {
  userExists: User.exists,
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
  },
};

test.afterEach(() => {
  User.exists = original.userExists;
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
