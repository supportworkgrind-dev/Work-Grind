const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const test = require('node:test');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const User = require('../dist/models/User').default;
const { refresh } = require('../dist/controllers/auth.controller');
const { hashRefreshToken } = require('../dist/services/pendingRegistration');
const { REFRESH_COOKIE_NAME } = require('../dist/utils/authCookie');

const originalFindById = User.findById;
const originalFindOneAndUpdate = User.findOneAndUpdate;

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    setCookie: undefined,
    clearedCookie: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    cookie(name, value, options) {
      this.setCookie = { name, value, options };
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookie = { name, options };
      return this;
    },
  };
}

function makeRefreshToken(expired = false) {
  return jwt.sign(
    { userId: 'refresh-test-user', companyId: 'refresh-test-workspace', role: 'owner', jti: randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: expired ? -1 : '7d' },
  );
}

function makeUser(refreshTokens) {
  return {
    _id: { toString: () => 'refresh-test-user' },
    companyId: { toString: () => 'refresh-test-workspace' },
    role: 'owner',
    refreshTokens,
    isVerified: true,
    isActive: true,
    isDeleted: false,
  };
}

async function callRefresh(refreshToken) {
  const response = makeResponse();
  await refresh({
    path: '/refresh',
    headers: { cookie: `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}` },
    body: {},
  }, response);
  return response;
}

test.afterEach(() => {
  User.findById = originalFindById;
  User.findOneAndUpdate = originalFindOneAndUpdate;
  process.env.NODE_ENV = 'test';
});

test('expired refresh credentials are rejected and the stale cookie is cleared', async () => {
  process.env.NODE_ENV = 'production';
  const response = await callRefresh(makeRefreshToken(true));

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.clearedCookie.name, REFRESH_COOKIE_NAME);
  assert.equal(response.clearedCookie.options.httpOnly, true);
  assert.equal(response.clearedCookie.options.secure, true);
  assert.equal(response.clearedCookie.options.sameSite, 'lax');
  assert.equal(response.clearedCookie.options.path, '/api/auth');
});

test('revoked refresh credentials are rejected and the stale cookie is cleared', async () => {
  const refreshToken = makeRefreshToken();
  User.findById = async () => makeUser([]);

  const response = await callRefresh(refreshToken);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.clearedCookie.name, REFRESH_COOKIE_NAME);
});

test('a valid refresh rotates only that stored credential and returns the access token', async () => {
  process.env.NODE_ENV = 'production';
  const refreshToken = makeRefreshToken();
  const otherSessionToken = hashRefreshToken(makeRefreshToken());
  const user = makeUser([hashRefreshToken(refreshToken), otherSessionToken]);
  let updateFilter;
  let updatePipeline;
  User.findById = async () => user;
  User.findOneAndUpdate = async (filter, update) => {
    updateFilter = filter;
    updatePipeline = update;
    return user;
  };

  const response = await callRefresh(refreshToken);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.accessToken, 'string');
  assert.equal(updateFilter._id, user._id);
  assert.deepEqual(updateFilter.refreshTokens.$in, [
    hashRefreshToken(refreshToken),
    refreshToken,
  ]);
  assert.equal(Array.isArray(updatePipeline), true);
  assert.equal(updatePipeline[0].$set.refreshTokens.$concatArrays[0].$filter.input.$ifNull[0], '$refreshTokens');
  assert.deepEqual(updatePipeline[0].$set.refreshTokens.$concatArrays[0].$filter.cond.$not[0].$in[1], [
    hashRefreshToken(refreshToken),
    refreshToken,
  ]);
  assert.equal(response.setCookie.name, REFRESH_COOKIE_NAME);
  assert.equal(response.setCookie.options.httpOnly, true);
  assert.equal(response.setCookie.options.secure, true);
  assert.equal(response.setCookie.options.sameSite, 'lax');
  assert.equal(response.setCookie.options.path, '/api/auth');
});
