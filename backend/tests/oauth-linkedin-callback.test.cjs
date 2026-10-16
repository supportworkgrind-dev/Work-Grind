const assert = require('node:assert/strict');
const test = require('node:test');
const { generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const OAuthExchange = require('../dist/models/OAuthExchange').default;
const User = require('../dist/models/User').default;
const { completeOAuthCallback, startOAuth } = require('../dist/controllers/oauth.controller');
const callingId = require('../dist/services/callingId');
const email = require('../dist/utils/email');

const originalTransactionFind = OAuthTransaction.findOneAndDelete;
const originalTransactionCreate = OAuthTransaction.create;
const originalExchangeCreate = OAuthExchange.create;
const originalUserFindOne = User.findOne;
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

function makeIdToken(privateKey, keyId, nonce) {
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
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

async function mockLinkedInProvider(context, nonce) {
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
        id_token: makeIdToken(privateKey, keyId, nonce),
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
  User.findOne = originalUserFindOne;
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
