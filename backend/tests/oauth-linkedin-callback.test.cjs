const assert = require('node:assert/strict');
const test = require('node:test');
const { generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const OAuthExchange = require('../dist/models/OAuthExchange').default;
const User = require('../dist/models/User').default;
const { completeOAuthCallback, exchangeOAuthSession, startOAuth } = require('../dist/controllers/oauth.controller');
const authController = require('../dist/controllers/auth.controller');
const callingId = require('../dist/services/callingId');
const email = require('../dist/utils/email');

const originalTransactionFind = OAuthTransaction.findOneAndDelete;
const originalTransactionCreate = OAuthTransaction.create;
const originalExchangeCreate = OAuthExchange.create;
const originalExchangeFindOneAndDelete = OAuthExchange.findOneAndDelete;
const originalUserFindOne = User.findOne;
const originalUserFindById = User.findById;
const originalSessionForUser = authController.sessionForUser;
const originalCreateUser = callingId.createWorkGrindUser;
const originalWelcomeEmail = email.sendWelcomeEmail;
const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;

function configureLinkedIn() {
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client';
  process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-secret';
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/oauth/linkedin/callback';
  process.env.CLIENT_URL = 'https://frontend.example.test';
}

function makeIdToken(privateKey, keyId, nonce, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://www.linkedin.com',
    aud: 'test-linkedin-client',
    sub: 'linkedin-callback-subject',
    exp: now + 300,
    iat: now,
    nonce,
    email: 'person@example.test',
    email_verified: true,
    name: 'Example Person',
    ...claims,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

async function mockLinkedInProvider(context, nonce, claims = {}) {
  const keyId = `linkedin-callback-${randomBytes(6).toString('hex')}`;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: keyId,
    use: 'sig',
    kty: 'RSA',
    alg: 'RS256',
  };
  const originalFetch = global.fetch;
  global.fetch = async (input) => {
    if (String(input) === 'https://www.linkedin.com/oauth/v2/accessToken') {
      return new Response(JSON.stringify({
        id_token: makeIdToken(privateKey, keyId, nonce, claims),
        access_token: 'server-only-access-token',
        scope: 'openid profile email',
      }), { status: 200 });
    }
    if (String(input) === 'https://www.linkedin.com/oauth/openid/jwks') {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }
    throw new Error('Unexpected OAuth endpoint');
  };
  context.after(() => { global.fetch = originalFetch; });
}

function responseMock() {
  return {
    headers: {},
    redirects: [],
    setHeader(name, value) { this.headers[name] = value; return this; },
    append(name, value) {
      this.headers[name] = [...(this.headers[name] || []), value];
      return this;
    },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(status, url) { this.redirects.push({ status, url }); return this; },
    cookie(name, value, options) {
      this.cookies = [...(this.cookies || []), { name, value, options }];
      return this;
    },
  };
}

function callbackRequest(state) {
  return {
    params: { provider: 'linkedin' },
    query: { state, code: 'linkedin-authorization-code' },
    body: {},
    headers: { cookie: `wg_oauth_linkedin_state_${state}=${state}` },
    ip: '127.0.0.1',
  };
}

function restoreOAuthMocks() {
  OAuthTransaction.findOneAndDelete = originalTransactionFind;
  OAuthTransaction.create = originalTransactionCreate;
  OAuthExchange.create = originalExchangeCreate;
  OAuthExchange.findOneAndDelete = originalExchangeFindOneAndDelete;
  User.findOne = originalUserFindOne;
  User.findById = originalUserFindById;
  authController.sessionForUser = originalSessionForUser;
  callingId.createWorkGrindUser = originalCreateUser;
  email.sendWelcomeEmail = originalWelcomeEmail;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
}

test('LinkedIn callback creates a correlated exchange for a successful verified-user login', async (context) => {
  configureLinkedIn();
  const nonce = randomBytes(32).toString('base64url');
  const correlationId = 'eae7e9b1-e3c8-4c3a-8c81-1300b4ba93df';
  await mockLinkedInProvider(context, nonce);
  const user = {
    _id: { toString: () => 'verified-user-id' },
    isActive: true,
    isDeleted: false,
    isVerified: true,
    isSuperAdmin: false,
    mfaEnabled: false,
    get: (field) => field === 'linkedinId' ? 'linkedin-callback-subject' : undefined,
  };
  let savedExchange;
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId,
    returnTo: '/dashboard',
    intent: 'login',
    audience: 'user',
    codeVerifier: 'linkedin-verifier',
    nonce,
  });
  User.findOne = async () => user;
  OAuthExchange.create = async (exchange) => { savedExchange = exchange; return exchange; };
  context.after(restoreOAuthMocks);

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(randomBytes(32).toString('base64url')), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.origin, 'https://frontend.example.test');
  assert.equal(destination.pathname, '/auth/callback');
  assert.equal(destination.searchParams.get('attemptId'), correlationId);
  assert.equal(savedExchange.correlationId, correlationId);
  assert.equal(savedExchange.userId.toString(), 'verified-user-id');
  assert.equal(savedExchange.returnTo, '/dashboard');
  assert.equal(destination.searchParams.get('code').length, 43);
});

test('LinkedIn signup start preserves the Solo choice and uses OIDC scopes, callback URL, state, and PKCE', async (context) => {
  configureLinkedIn();
  let savedTransaction;
  OAuthTransaction.create = async (transaction) => { savedTransaction = transaction; return transaction; };
  context.after(restoreOAuthMocks);

  const response = responseMock();
  await startOAuth({
    params: { provider: 'linkedin' },
    query: {
      intent: 'signup',
      accountType: 'individual',
      organizationType: 'business',
    },
    headers: {},
    accepts: () => false,
  }, response);

  assert.equal(response.body.success, true);
  assert.equal(savedTransaction.intent, 'signup');
  assert.equal(savedTransaction.accountType, 'individual');
  assert.equal(savedTransaction.organizationType, 'business');
  assert.equal(savedTransaction.returnTo, '/create-company');
  const authorizationUrl = new URL(response.body.authUrl);
  assert.equal(authorizationUrl.searchParams.get('scope'), 'openid profile email');
  assert.equal(
    authorizationUrl.searchParams.get('redirect_uri'),
    'https://backend.example.test/api/auth/oauth/linkedin/callback',
  );
  assert.ok(authorizationUrl.searchParams.get('state'));
  assert.ok(authorizationUrl.searchParams.get('code_challenge'));
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
});

test('LinkedIn signup preserves selected academic workspace through user and exchange creation', async (context) => {
  configureLinkedIn();
  const nonce = randomBytes(32).toString('base64url');
  await mockLinkedInProvider(context, nonce);
  const createInputs = [];
  let savedExchange;
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId: '7bdfb74a-614d-44e8-9cc2-397c903a3579',
    returnTo: '/create-company',
    intent: 'signup',
    audience: 'user',
    accountType: 'company',
    organizationType: 'college',
    codeVerifier: 'linkedin-verifier',
    nonce,
  });
  User.findOne = async () => null;
  callingId.createWorkGrindUser = async (input) => {
    createInputs.push(input);
    return {
      _id: { toString: () => 'new-college-owner-id' },
      companyId: undefined,
    };
  };
  email.sendWelcomeEmail = async () => ({ success: true });
  OAuthExchange.create = async (exchange) => { savedExchange = exchange; return exchange; };
  context.after(restoreOAuthMocks);

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(randomBytes(32).toString('base64url')), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(createInputs.length, 1);
  assert.equal(createInputs[0].accountType, 'company');
  assert.equal(createInputs[0].signupOrganizationType, 'college');
  assert.equal(destination.pathname, '/auth/callback');
  assert.equal(destination.searchParams.get('attemptId'), savedExchange.correlationId);
  assert.equal(savedExchange.returnTo, '/create-company');
});

test('LinkedIn signup rejects missing verified email without creating an account', async (context) => {
  configureLinkedIn();
  const nonce = randomBytes(32).toString('base64url');
  await mockLinkedInProvider(context, nonce, { email: undefined, email_verified: undefined });
  let createCalled = false;
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId: 'ab1a9528-fdb0-45d4-97b1-98ce947f7513',
    returnTo: '/create-company',
    intent: 'signup',
    audience: 'user',
    accountType: 'company',
    organizationType: 'business',
    codeVerifier: 'linkedin-verifier',
    nonce,
  });
  User.findOne = async () => null;
  callingId.createWorkGrindUser = async () => {
    createCalled = true;
    throw new Error('Unexpected user creation');
  };
  context.after(restoreOAuthMocks);

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(randomBytes(32).toString('base64url')), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.pathname, '/signup');
  assert.equal(destination.searchParams.get('workspace'), 'business');
  assert.equal(destination.searchParams.get('oauth_error'), 'verified_email_required');
  assert.equal(createCalled, false);
});

test('LinkedIn callback rejects missing, malformed, expired, and replayed state before account lookup', async (context) => {
  let transactionLookups = 0;
  let userLookups = 0;
  OAuthTransaction.findOneAndDelete = async () => {
    transactionLookups += 1;
    return null;
  };
  User.findOne = async () => {
    userLookups += 1;
    return null;
  };
  context.after(restoreOAuthMocks);

  const cases = [
    {
      request: {
        ...callbackRequest(''),
        query: { code: 'linkedin-authorization-code' },
        headers: { cookie: '' },
      },
      expectedError: 'invalid_request',
      expectedLookups: 0,
    },
    {
      request: callbackRequest('bad-state'),
      expectedError: 'invalid_request',
      expectedLookups: 0,
    },
    {
      request: callbackRequest(randomBytes(32).toString('base64url')),
      expectedError: 'attempt_expired',
      expectedLookups: 1,
    },
    {
      request: callbackRequest(randomBytes(32).toString('base64url')),
      expectedError: 'attempt_expired',
      expectedLookups: 2,
    },
  ];

  for (const { request, expectedError, expectedLookups } of cases) {
    const response = responseMock();
    await completeOAuthCallback(request, response);
    const destination = new URL(response.redirects[0].url);
    assert.equal(destination.searchParams.get('error'), expectedError);
    assert.equal(transactionLookups, expectedLookups);
  }
  assert.equal(userLookups, 0);
});

test('LinkedIn solo signup preserves individual account type and completes a refresh-cookie session', async (context) => {
  configureLinkedIn();
  const nonce = randomBytes(32).toString('base64url');
  await mockLinkedInProvider(context, nonce);
  const correlationId = 'f15b05bb-0c5d-4588-8b95-4d16b30ef067';
  const createInputs = [];
  let savedExchange;
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId,
    returnTo: '/create-company',
    intent: 'signup',
    audience: 'user',
    accountType: 'individual',
    organizationType: 'business',
    codeVerifier: 'linkedin-verifier',
    nonce,
  });
  User.findOne = async () => null;
  callingId.createWorkGrindUser = async (input) => {
    createInputs.push(input);
    return { _id: { toString: () => 'new-solo-user-id' } };
  };
  email.sendWelcomeEmail = async () => ({ success: true });
  OAuthExchange.create = async (exchange) => { savedExchange = exchange; return exchange; };
  context.after(restoreOAuthMocks);

  const callbackResponseMock = responseMock();
  await completeOAuthCallback(callbackRequest(randomBytes(32).toString('base64url')), callbackResponseMock);
  const callbackDestination = new URL(callbackResponseMock.redirects[0].url);
  const exchangeCode = callbackDestination.searchParams.get('code');

  assert.equal(createInputs.length, 1);
  assert.equal(createInputs[0].accountType, 'individual');
  assert.equal(createInputs[0].signupOrganizationType, 'business');
  assert.equal(createInputs[0].linkedinId, 'linkedin-callback-subject');
  assert.equal(savedExchange.returnTo, '/create-company');

  OAuthExchange.findOneAndDelete = async (query) => {
    assert.equal(query.correlationId, correlationId);
    return {
      correlationId,
      audience: 'user',
      userId: { toString: () => 'new-solo-user-id' },
      returnTo: savedExchange.returnTo,
    };
  };
  User.findById = async (id) => {
    assert.equal(id.toString(), 'new-solo-user-id');
    return { isActive: true, isDeleted: false, isVerified: true, isSuperAdmin: false, mfaEnabled: false };
  };
  authController.sessionForUser = async () => ({
    accessToken: 'solo-access-token',
    refreshToken: 'solo-refresh-token',
    user: { _id: 'new-solo-user-id', accountType: 'individual', signupOrganizationType: 'business' },
  });

  const sessionResponse = responseMock();
  await exchangeOAuthSession({
    body: { code: exchangeCode, attemptId: correlationId },
  }, sessionResponse);

  assert.equal(sessionResponse.body.success, true);
  assert.equal(sessionResponse.body.user.accountType, 'individual');
  assert.equal(sessionResponse.body.returnTo, '/create-company');
  assert.deepEqual(sessionResponse.cookies.map(({ name, value }) => ({ name, value })), [
    { name: 'wg_refresh', value: 'solo-refresh-token' },
  ]);
});

test('Vercel production state cookies remain Secure when NODE_ENV is not set', async (context) => {
  configureLinkedIn();
  delete process.env.NODE_ENV;
  process.env.VERCEL_ENV = 'production';
  let savedCookie = '';
  OAuthTransaction.create = async () => ({});
  context.after(restoreOAuthMocks);

  const response = responseMock();
  await startOAuth({
    params: { provider: 'linkedin' },
    query: { intent: 'signup', accountType: 'company', organizationType: 'business' },
    accepts: () => false,
  }, response);

  savedCookie = response.headers['Set-Cookie'][0];
  assert.match(savedCookie, /^wg_oauth_linkedin_state_[A-Za-z0-9_-]+=([A-Za-z0-9_-]+);/);
  assert.match(savedCookie, /HttpOnly/);
  assert.match(savedCookie, /SameSite=None/);
  assert.match(savedCookie, /; Secure(?:;|$)/);
});
