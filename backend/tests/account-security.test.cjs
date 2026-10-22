const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const test = require('node:test');

process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const { authenticator } = require('otplib');
const User = require('../dist/models/User').default;
const AuditLog = require('../dist/models/AuditLog').default;
const OAuthExchange = require('../dist/models/OAuthExchange').default;
const Company = require('../dist/models/Company').default;
const { login } = require('../dist/controllers/auth.controller');
const { exchangeOAuthSession } = require('../dist/controllers/oauth.controller');
const {
  disableUserMfa,
  enableUserMfa,
  exportMyData,
  getSecurityEvents,
  revokeOtherSessions,
  startUserMfaSetup,
  unlinkSignInProvider,
  verifyUserMfaLogin,
} = require('../dist/controllers/accountSecurity.controller');
const { verifySuperAdminMfaLogin } = require('../dist/controllers/superAdmin.controller');
const { authenticate } = require('../dist/middleware/auth');
const { encryptSecret, decryptSecret, hashRecoveryCode } = require('../dist/utils/mfa');
const { generateUserMfaChallengeToken } = require('../dist/utils/jwt');
const { hashRefreshToken } = require('../dist/services/pendingRegistration');

const original = {
  findOne: User.findOne,
  findById: User.findById,
  findOneAndUpdate: User.findOneAndUpdate,
  updateOne: User.updateOne,
  auditCreate: AuditLog.create,
  auditFind: AuditLog.find,
  exchangeFindOneAndDelete: OAuthExchange.findOneAndDelete,
  companyFindById: Company.findById,
};
const events = [];

test.beforeEach(() => {
  events.length = 0;
  AuditLog.create = async (event) => { events.push(event); return event; };
});

test.afterEach(() => {
  User.findOne = original.findOne;
  User.findById = original.findById;
  User.findOneAndUpdate = original.findOneAndUpdate;
  User.updateOne = original.updateOne;
  AuditLog.create = original.auditCreate;
  AuditLog.find = original.auditFind;
  OAuthExchange.findOneAndDelete = original.exchangeFindOneAndDelete;
  Company.findById = original.companyFindById;
});

const companyId = new mongoose.Types.ObjectId();

function response() {
  return {
    statusCode: 200,
    body: undefined,
    cookies: [],
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); return this; },
    clearCookie() { return this; },
    set(name, value) { if (typeof name === 'string') this.headers[name] = value; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };
}

function mfaUser(overrides = {}) {
  const secret = authenticator.generateSecret();
  const user = {
    _id: new mongoose.Types.ObjectId(),
    companyId,
    role: 'employee',
    email: 'member@example.invalid',
    fullName: 'Member',
    isActive: true,
    isVerified: true,
    isDeleted: false,
    password: 'stored-hash',
    mfaEnabled: true,
    mfaSecretEncrypted: encryptSecret(secret),
    recoveryCodesHashed: [hashRecoveryCode('ABCD-EFGH')],
    mfaFailedAttempts: 0,
    refreshTokens: [],
    comparePassword: async (candidate) => candidate === 'Correct#Pass1',
    save: async () => undefined,
    ...overrides,
  };
  return { user, secret };
}

const selectable = (value) => ({ select: async () => value, then: (resolve) => resolve(value) });

test('password sign-in with MFA enabled returns a challenge instead of a session', async () => {
  const { user } = mfaUser();
  User.findOne = () => ({ select: async () => user });
  Company.findById = () => ({ select: async () => null });
  const res = response();
  await login({ body: { email: user.email, password: 'Correct#Pass1' }, ip: '127.0.0.1' }, res);
  assert.equal(res.body.mfaRequired, true);
  assert.equal(typeof res.body.mfaToken, 'string');
  assert.equal(res.body.accessToken, undefined);
  assert.equal(res.cookies.length, 0, 'no refresh cookie before the second factor');
  assert.deepEqual(user.refreshTokens, []);
});

test('the MFA challenge cannot be used as an access token or as a super-admin challenge', async () => {
  const token = generateUserMfaChallengeToken(new mongoose.Types.ObjectId().toString(), companyId.toString());
  const accessRes = response();
  let nextCalled = false;
  await authenticate({ method: 'GET', path: '/me', originalUrl: '/api/auth/me', headers: { authorization: `Bearer ${token}` } }, accessRes, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(accessRes.statusCode, 401);

  const adminRes = response();
  await verifySuperAdminMfaLogin({ body: { challengeToken: token, code: '123456' } }, adminRes);
  assert.equal(adminRes.statusCode, 401);
});

test('a valid authenticator code completes sign-in and issues a session', async () => {
  const { user, secret } = mfaUser();
  User.findById = (id) => {
    const value = String(id) === String(user._id) ? user : null;
    return { select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  };
  const res = response();
  await verifyUserMfaLogin({
    body: { mfaToken: generateUserMfaChallengeToken(user._id.toString(), companyId.toString()), code: authenticator.generate(secret) },
    ip: '127.0.0.1',
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.accessToken, 'string');
  assert.equal(res.cookies.length, 1);
  assert.equal(user.refreshTokens.length, 1);
  assert.ok(events.some((event) => event.action === 'LOGIN_SUCCEEDED' && event.details?.method === 'mfa'));
});

test('wrong codes are counted and lock MFA sign-in after five attempts', async () => {
  const { user } = mfaUser({ mfaFailedAttempts: 4 });
  User.findById = () => selectable(user);
  let update;
  User.updateOne = async (filter, mutation) => { update = mutation; return { modifiedCount: 1 }; };
  User.findOneAndUpdate = async () => null;
  const res = response();
  await verifyUserMfaLogin({
    body: { mfaToken: generateUserMfaChallengeToken(user._id.toString(), companyId.toString()), code: '000000' },
    ip: '127.0.0.1',
  }, res);
  assert.equal(res.statusCode, 429);
  assert.ok(update.$set.mfaLockoutUntil instanceof Date);
  assert.equal(res.body.accessToken, undefined);
});

test('a recovery code works once for sign-in', async () => {
  const { user } = mfaUser();
  User.findById = () => selectable(user);
  let pulled;
  User.findOneAndUpdate = async (filter, mutation) => { pulled = mutation.$pull.recoveryCodesHashed; return user; };
  const res = response();
  await verifyUserMfaLogin({
    body: { mfaToken: generateUserMfaChallengeToken(user._id.toString(), companyId.toString()), code: 'ABCD-EFGH' },
    ip: '127.0.0.1',
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(pulled, hashRecoveryCode('ABCD-EFGH'), 'the used code is removed');
});

test('provider sign-in for an MFA account also requires the second factor', async () => {
  const { user } = mfaUser();
  OAuthExchange.findOneAndDelete = async () => ({ audience: 'user', userId: user._id, returnTo: '/dashboard', correlationId: 'test' });
  User.findById = async () => user;
  const res = response();
  await exchangeOAuthSession({ body: { code: 'x'.repeat(48) }, ip: '127.0.0.1', get: () => undefined }, res);
  assert.equal(res.body.mfaRequired, true);
  assert.equal(res.body.accessToken, undefined);
  assert.equal(res.cookies.length, 0);
});

test('MFA setup requires the current password and enabling stores only hashed recovery codes', async () => {
  const { user } = mfaUser({ mfaEnabled: false, mfaSecretEncrypted: undefined, recoveryCodesHashed: [] });
  User.findById = () => selectable(user);

  const rejected = response();
  await startUserMfaSetup({ user: { userId: user._id.toString() }, body: { currentPassword: 'wrong' } }, rejected);
  assert.equal(rejected.statusCode, 400);
  assert.equal(user.mfaTempSecretEncrypted, undefined);

  const started = response();
  await startUserMfaSetup({ user: { userId: user._id.toString() }, body: { currentPassword: 'Correct#Pass1' } }, started);
  assert.match(started.body.qrCodeUrl, /^data:image\/png;base64,/);
  assert.match(started.body.otpauthUrl, /issuer=WorkGrind(&|$)/);
  assert.equal(decryptSecret(user.mfaTempSecretEncrypted), started.body.manualKey);

  const enabled = response();
  await enableUserMfa({ user: { userId: user._id.toString() }, body: { code: authenticator.generate(started.body.manualKey) }, ip: '127.0.0.1' }, enabled);
  assert.equal(enabled.statusCode, 200);
  assert.equal(user.mfaEnabled, true);
  assert.equal(enabled.body.recoveryCodes.length, 8);
  assert.deepEqual(user.recoveryCodesHashed, enabled.body.recoveryCodes.map(hashRecoveryCode));
  assert.ok(!user.recoveryCodesHashed.includes(enabled.body.recoveryCodes[0]), 'plaintext codes are not stored');
  assert.ok(events.some((event) => event.action === 'MFA_ENABLED'));
});

test('turning MFA off needs both the current password and a valid code', async () => {
  const { user, secret } = mfaUser();
  User.findById = () => selectable(user);
  User.findOneAndUpdate = async () => null;
  let cleared;
  User.updateOne = async (filter, mutation) => { cleared = mutation; return { modifiedCount: 1 }; };

  const noCode = response();
  await disableUserMfa({ user: { userId: user._id.toString() }, body: { currentPassword: 'Correct#Pass1', code: '000000' } }, noCode);
  assert.equal(noCode.statusCode, 400);
  const noPassword = response();
  await disableUserMfa({ user: { userId: user._id.toString() }, body: { currentPassword: 'wrong', code: authenticator.generate(secret) } }, noPassword);
  assert.equal(noPassword.statusCode, 400);
  assert.equal(cleared, undefined);

  const ok = response();
  await disableUserMfa({ user: { userId: user._id.toString() }, body: { currentPassword: 'Correct#Pass1', code: authenticator.generate(secret) }, ip: '127.0.0.1' }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(cleared.$set.mfaEnabled, false);
  assert.ok('mfaSecretEncrypted' in cleared.$unset && 'recoveryCodesHashed' in cleared.$unset);
});

test('the only sign-in method cannot be unlinked; a redundant provider can', async () => {
  const { user: onlyGoogle } = mfaUser({ mfaEnabled: false, password: undefined, googleId: 'google-sub' });
  User.findById = () => selectable(onlyGoogle);
  let unset;
  User.updateOne = async (filter, mutation) => { unset = mutation.$unset; return { modifiedCount: 1 }; };
  const blocked = response();
  await unlinkSignInProvider({ params: { provider: 'google' }, user: { userId: onlyGoogle._id.toString() }, body: {} }, blocked);
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.code, 'LAST_SIGN_IN_METHOD');
  assert.equal(unset, undefined);

  const { user: withPassword } = mfaUser({ mfaEnabled: false, googleId: 'google-sub' });
  User.findById = () => selectable(withPassword);
  const wrongPassword = response();
  await unlinkSignInProvider({ params: { provider: 'google' }, user: { userId: withPassword._id.toString() }, body: { currentPassword: 'wrong' } }, wrongPassword);
  assert.equal(wrongPassword.statusCode, 400);
  const ok = response();
  await unlinkSignInProvider({ params: { provider: 'google' }, user: { userId: withPassword._id.toString() }, body: { currentPassword: 'Correct#Pass1' }, ip: '127.0.0.1' }, ok);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(unset, { googleId: 1 });
});

test('signing out other sessions keeps only the current browser session', async () => {
  const current = 'current-refresh-token';
  const user = { _id: new mongoose.Types.ObjectId(), companyId, refreshTokens: [hashRefreshToken('other-a'), hashRefreshToken(current), hashRefreshToken('other-b')] };
  User.findById = async () => user;
  let write;
  User.updateOne = async (filter, mutation) => { write = { filter, mutation }; return { modifiedCount: 1 }; };
  const res = response();
  await revokeOtherSessions({ user: { userId: user._id.toString() }, headers: { cookie: `wg_refresh=${current}` }, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.revoked, 2);
  assert.deepEqual(write.mutation.$set.refreshTokens, [hashRefreshToken(current)]);
  assert.equal(write.filter.refreshTokens, hashRefreshToken(current), 'only applies while this session is still valid');

  const unknown = response();
  await revokeOtherSessions({ user: { userId: user._id.toString() }, headers: { cookie: 'wg_refresh=not-a-session' } }, unknown);
  assert.equal(unknown.statusCode, 400);
});

test('security history is limited to the caller in their own workspace', async () => {
  let filter;
  AuditLog.find = (query) => {
    filter = query;
    const chain = { sort: () => chain, limit: () => chain, select: () => chain, lean: async () => [{ _id: 'e1', action: 'LOGIN_SUCCEEDED', createdAt: new Date(), details: { method: 'password', ipAddressInternal: 'x' } }] };
    return chain;
  };
  const userId = new mongoose.Types.ObjectId().toString();
  const res = response();
  await getSecurityEvents({ user: { userId, companyId: companyId.toString() } }, res);
  assert.equal(filter.userId, userId);
  assert.equal(filter.companyId, companyId.toString());
  assert.deepEqual(Object.keys(res.body.events[0]).sort(), ['_id', 'action', 'createdAt', 'method', 'provider', 'revoked'].sort());
});

test('the personal data export excludes credentials and secrets', async () => {
  let projection;
  const userId = new mongoose.Types.ObjectId();
  User.findById = () => ({
    select(fields) { projection = fields; return this; },
    populate() { return this; },
    lean: async () => ({ _id: userId, email: 'member@example.invalid', fullName: 'Member', companyId: { name: 'North', organizationType: 'business', accountType: 'company' }, role: 'employee', googleId: 'sub' }),
  });
  const res = response();
  await exportMyData({ user: { userId: userId.toString(), companyId: companyId.toString() }, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Disposition'], /attachment/);
  for (const field of ['refreshTokens', 'resetPasswordToken', 'verificationToken']) assert.match(projection, new RegExp(`-${field}\\b`));
  const serialized = JSON.stringify(res.body);
  assert.doesNotMatch(serialized, /password|mfaSecret|recoveryCodes|"sub"/);
  assert.deepEqual(res.body.security.connectedSignInProviders, ['google']);
  assert.ok(events.some((event) => event.action === 'DATA_EXPORTED'));
});
