const assert = require('node:assert/strict');
const test = require('node:test');
const OAuthExchange = require('../dist/models/OAuthExchange').default;
const User = require('../dist/models/User').default;
const authController = require('../dist/controllers/auth.controller');
const { exchangeOAuthSession } = require('../dist/controllers/oauth.controller');

const originalFindOneAndDelete = OAuthExchange.findOneAndDelete;
const originalUserFindById = User.findById;
const originalSessionForUser = authController.sessionForUser;

const attemptId = '6c297b34-d3bf-416c-a125-365e429e6fe4';
const oneTimeCode = 'x'.repeat(43);

function validUser() {
  return {
    isActive: true,
    isDeleted: false,
    isVerified: true,
    isSuperAdmin: false,
    mfaEnabled: false,
  };
}

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) {
      this.cookies = [...(this.cookies || []), { name, value, options }];
      return this;
    },
  };
}

function exchangeRequest() {
  return { body: { code: oneTimeCode, attemptId } };
}

function restoreMocks() {
  OAuthExchange.findOneAndDelete = originalFindOneAndDelete;
  User.findById = originalUserFindById;
  authController.sessionForUser = originalSessionForUser;
}

test('expired or already consumed OAuth exchange codes are rejected', async (context) => {
  OAuthExchange.findOneAndDelete = async () => null;
  context.after(restoreMocks);

  const response = responseMock();
  await exchangeOAuthSession(exchangeRequest(), response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, 'OAUTH_CODE_INVALID');
  assert.equal(response.cookies, undefined);
});

test('exchange code consumption is one-time across repeated callback requests', async (context) => {
  let available = true;
  OAuthExchange.findOneAndDelete = async (query) => {
    assert.equal(query.correlationId, attemptId);
    if (!available) return null;
    available = false;
    return {
      correlationId: attemptId,
      audience: 'user',
      userId: { toString: () => 'verified-user-id' },
      returnTo: '/dashboard',
    };
  };
  User.findById = async () => validUser();
  authController.sessionForUser = async () => ({
    accessToken: 'workgrind-access-token',
    refreshToken: 'workgrind-refresh-token',
    user: { _id: 'verified-user-id' },
  });
  context.after(restoreMocks);

  const firstResponse = responseMock();
  await exchangeOAuthSession(exchangeRequest(), firstResponse);
  const repeatedResponse = responseMock();
  await exchangeOAuthSession(exchangeRequest(), repeatedResponse);

  assert.equal(firstResponse.statusCode, undefined);
  assert.equal(firstResponse.body.success, true);
  assert.equal(firstResponse.cookies[0].name, 'wg_refresh');
  assert.equal(repeatedResponse.statusCode, 400);
  assert.equal(repeatedResponse.body.code, 'OAUTH_CODE_INVALID');
});

test('temporary exchange-store failure returns a retryable service error', async (context) => {
  OAuthExchange.findOneAndDelete = async () => {
    const error = new Error('temporary database outage');
    error.name = 'MongoServerSelectionError';
    throw error;
  };
  context.after(restoreMocks);

  const response = responseMock();
  await exchangeOAuthSession(exchangeRequest(), response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'OAUTH_UNAVAILABLE');
  assert.equal(response.body.code === 'OAUTH_CODE_INVALID', false);
});
