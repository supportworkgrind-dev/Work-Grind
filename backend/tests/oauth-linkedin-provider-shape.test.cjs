// Regression tests that model LinkedIn's real OIDC behaviour, which differs from
// generic OIDC: its JWKS keys omit `use`/`alg`, its ID tokens do not echo the
// authorization-request nonce, and it publishes two issuer strings.
const assert = require('node:assert/strict');
const test = require('node:test');
const { generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const OAuthExchange = require('../dist/models/OAuthExchange').default;
const User = require('../dist/models/User').default;
const { completeOAuthCallback } = require('../dist/controllers/oauth.controller');
const callingId = require('../dist/services/callingId');
const email = require('../dist/utils/email');

const CLIENT_ID = 'test-linkedin-client';
const CLIENT_SECRET = 'test-linkedin-secret-value';
const AUTH_CODE = 'linkedin-authorization-code-value';
const SUBJECT = 'linkedin-real-subject';

const originals = {
  transactionFind: OAuthTransaction.findOneAndDelete,
  exchangeCreate: OAuthExchange.create,
  userFindOne: User.findOne,
  createUser: callingId.createWorkGrindUser,
  welcomeEmail: email.sendWelcomeEmail,
  fetch: global.fetch,
};

function restore() {
  OAuthTransaction.findOneAndDelete = originals.transactionFind;
  OAuthExchange.create = originals.exchangeCreate;
  User.findOne = originals.userFindOne;
  callingId.createWorkGrindUser = originals.createUser;
  email.sendWelcomeEmail = originals.welcomeEmail;
  global.fetch = originals.fetch;
}

function configureLinkedIn() {
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.LINKEDIN_CLIENT_ID = CLIENT_ID;
  process.env.LINKEDIN_CLIENT_SECRET = CLIENT_SECRET;
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/oauth/linkedin/callback';
  process.env.CLIENT_URL = 'https://frontend.example.test';
}

/**
 * Mocks LinkedIn's endpoints. By default the JWKS key and ID token match what
 * LinkedIn returns in production (no `use`, no `alg`, no `nonce`).
 */
function mockLinkedIn(context, {
  claims = {},
  jwkExtras = {},
  tokenStatus = 200,
  tokenError,
  userInfo,
} = {}) {
  const keyId = `linkedin-${randomBytes(6).toString('hex')}`;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const { kty, n, e } = publicKey.export({ format: 'jwk' });
  const jwk = { kty, e, kid: keyId, n, ...jwkExtras };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://www.linkedin.com',
    aud: CLIENT_ID,
    sub: SUBJECT,
    exp: now + 300,
    iat: now,
    email: 'member@example.test',
    email_verified: true,
    name: 'LinkedIn Member',
    ...claims,
  };
  for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${header}.${body}`;
  const idToken = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  const calls = [];

  global.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === 'https://www.linkedin.com/oauth/v2/accessToken') {
      if (tokenStatus !== 200) {
        return new Response(JSON.stringify({ error: tokenError, error_description: 'Client authentication failed' }), { status: tokenStatus });
      }
      return new Response(JSON.stringify({
        id_token: idToken,
        access_token: 'server-only-access-token',
        scope: 'openid,profile,email',
        expires_in: 3600,
      }), { status: 200 });
    }
    if (url === 'https://www.linkedin.com/oauth/openid/jwks') {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }
    if (url === 'https://api.linkedin.com/v2/userinfo' && userInfo) {
      return new Response(JSON.stringify(userInfo), { status: 200 });
    }
    throw new Error(`Unexpected OAuth endpoint ${url}`);
  };
  context.after(restore);
  return calls;
}

function responseMock() {
  return {
    headers: {},
    redirects: [],
    setHeader(name, value) { this.headers[name] = value; return this; },
    append(name, value) { this.headers[name] = [...(this.headers[name] || []), value]; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(status, url) { this.redirects.push({ status, url }); return this; },
  };
}

function callbackRequest(query = {}) {
  const state = randomBytes(32).toString('base64url');
  return {
    params: { provider: 'linkedin' },
    query: { state, code: AUTH_CODE, ...query },
    body: {},
    headers: { cookie: `wg_oauth_linkedin_state_${state}=${state}` },
    ip: '127.0.0.1',
  };
}

function transaction(overrides = {}) {
  return {
    correlationId: '6cad200e-6cc9-4a3d-a2d4-f6c9db5fd946',
    returnTo: '/dashboard',
    intent: 'login',
    audience: 'user',
    codeVerifier: 'linkedin-verifier',
    nonce: 'nonce-sent-in-authorization-request',
    ...overrides,
  };
}

function existingMember() {
  return {
    _id: { toString: () => 'existing-member-id' },
    isActive: true,
    isDeleted: false,
    isVerified: true,
    isSuperAdmin: false,
    mfaEnabled: false,
    get: (field) => field === 'linkedinId' ? SUBJECT : undefined,
  };
}

function captureErrors(context) {
  const logged = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args) => logged.push(args);
  console.warn = (...args) => logged.push(args);
  context.after(() => { console.error = originalError; console.warn = originalWarn; });
  return logged;
}

test('LinkedIn login succeeds with a production-shaped JWKS key and ID token without a nonce', async (context) => {
  configureLinkedIn();
  const calls = mockLinkedIn(context);
  let savedExchange;
  OAuthTransaction.findOneAndDelete = async () => transaction();
  User.findOne = async () => existingMember();
  OAuthExchange.create = async (exchange) => { savedExchange = exchange; return exchange; };

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.pathname, '/auth/callback');
  assert.equal(destination.searchParams.get('error'), null);
  assert.equal(savedExchange.userId.toString(), 'existing-member-id');

  const tokenCall = calls.find(({ url }) => url.endsWith('/oauth/v2/accessToken'));
  const form = new URLSearchParams(tokenCall.init.body);
  assert.equal(tokenCall.init.method, 'POST');
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('code'), AUTH_CODE);
  assert.equal(form.get('client_id'), CLIENT_ID);
  assert.equal(form.get('client_secret'), CLIENT_SECRET);
  assert.equal(form.get('redirect_uri'), 'https://backend.example.test/api/auth/oauth/linkedin/callback');
});

test('LinkedIn accepts both documented issuer strings', async (context) => {
  configureLinkedIn();
  for (const iss of ['https://www.linkedin.com', 'https://www.linkedin.com/oauth']) {
    mockLinkedIn(context, { claims: { iss } });
    OAuthTransaction.findOneAndDelete = async () => transaction();
    User.findOne = async () => existingMember();
    OAuthExchange.create = async (exchange) => exchange;
    const response = responseMock();
    await completeOAuthCallback(callbackRequest(), response);
    assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), null, iss);
  }
});

test('LinkedIn rejects a nonce that is present but does not match', async (context) => {
  configureLinkedIn();
  captureErrors(context);
  mockLinkedIn(context, { claims: { nonce: 'attacker-supplied-nonce' } });
  let userLookups = 0;
  OAuthTransaction.findOneAndDelete = async () => transaction();
  User.findOne = async () => { userLookups += 1; return existingMember(); };

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);
  assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), 'try_again');
  assert.equal(userLookups, 0);
});

test('LinkedIn rejects an untrusted issuer and a key declared for encryption', async (context) => {
  configureLinkedIn();
  captureErrors(context);
  for (const options of [
    { claims: { iss: 'https://evil.example.test' } },
    { jwkExtras: { use: 'enc' } },
  ]) {
    mockLinkedIn(context, options);
    let userLookups = 0;
    OAuthTransaction.findOneAndDelete = async () => transaction();
    User.findOne = async () => { userLookups += 1; return existingMember(); };
    const response = responseMock();
    await completeOAuthCallback(callbackRequest(), response);
    assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), 'try_again');
    assert.equal(userLookups, 0);
  }
});

// Production failure dbf9490e-0e66-4d16-b6d3-8cd7cf0feb1b: LinkedIn returned 401
// invalid_client because the deployed client secret was rejected.
test('LinkedIn client-credential rejection reports provider_unavailable and logs no secrets', async (context) => {
  configureLinkedIn();
  const logged = captureErrors(context);
  mockLinkedIn(context, { tokenStatus: 401, tokenError: 'invalid_client' });
  OAuthTransaction.findOneAndDelete = async () => transaction();

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.searchParams.get('error'), 'provider_unavailable');
  assert.ok(logged.some(([message, details]) =>
    message.startsWith('[OAuth] Provider rejected the configured client credentials.') &&
    details.correlationId === '6cad200e-6cc9-4a3d-a2d4-f6c9db5fd946'));
  assert.equal(destination.searchParams.get('supportId'), '6cad200e-6cc9-4a3d-a2d4-f6c9db5fd946');
  const entry = logged.find(([message]) => message === '[OAuth] Callback step failed.');
  assert.deepEqual(entry[1], {
    provider: 'linkedin',
    stage: 'authorization_code_exchange_and_id_token_validation',
    reason: 'token_endpoint_rejected',
    httpStatus: 401,
    providerErrorCode: 'invalid_client',
    correlationId: '6cad200e-6cc9-4a3d-a2d4-f6c9db5fd946',
  });
  const serialized = JSON.stringify(logged);
  for (const secret of [CLIENT_SECRET, AUTH_CODE, 'linkedin-verifier', 'server-only-access-token']) {
    assert.equal(serialized.includes(secret), false, `log leaked ${secret}`);
  }
});

test('LinkedIn expired or reused authorization codes still ask the member to try again', async (context) => {
  configureLinkedIn();
  const logged = captureErrors(context);
  mockLinkedIn(context, { tokenStatus: 400, tokenError: 'invalid_grant' });
  OAuthTransaction.findOneAndDelete = async () => transaction();

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);

  assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), 'try_again');
  const entry = logged.find(([message]) => message === '[OAuth] Callback step failed.');
  assert.equal(entry[1].httpStatus, 400);
  assert.equal(entry[1].providerErrorCode, 'invalid_grant');
});

test('LinkedIn cancellation redirects with the cancelled code', async (context) => {
  configureLinkedIn();
  captureErrors(context);
  OAuthTransaction.findOneAndDelete = async () => transaction();
  global.fetch = async () => { throw new Error('No provider call expected after cancellation'); };
  context.after(restore);

  const response = responseMock();
  await completeOAuthCallback(callbackRequest({ code: undefined, error: 'access_denied' }), response);
  assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), 'cancelled');
});

test('LinkedIn signup uses a verified userinfo email when the ID token omits it', async (context) => {
  configureLinkedIn();
  const calls = mockLinkedIn(context, {
    claims: { email: undefined, email_verified: undefined },
    userInfo: { sub: SUBJECT, email: 'Member@Example.test', email_verified: true, name: 'LinkedIn Member' },
  });
  const createInputs = [];
  OAuthTransaction.findOneAndDelete = async () => transaction({
    intent: 'signup', returnTo: '/create-company', accountType: 'company', organizationType: 'university',
  });
  User.findOne = async () => null;
  callingId.createWorkGrindUser = async (input) => {
    createInputs.push(input);
    return { _id: { toString: () => 'new-university-owner' } };
  };
  email.sendWelcomeEmail = async () => ({ success: true });
  OAuthExchange.create = async (exchange) => exchange;

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);

  assert.equal(new URL(response.redirects[0].url).pathname, '/auth/callback');
  assert.equal(createInputs.length, 1);
  assert.equal(createInputs[0].email, 'member@example.test');
  assert.equal(createInputs[0].signupOrganizationType, 'university');
  const userInfoCall = calls.find(({ url }) => url === 'https://api.linkedin.com/v2/userinfo');
  assert.equal(userInfoCall.init.headers.Authorization, 'Bearer server-only-access-token');
});

test('LinkedIn ignores userinfo for a different subject and refuses to create the account', async (context) => {
  configureLinkedIn();
  captureErrors(context);
  mockLinkedIn(context, {
    claims: { email: undefined, email_verified: undefined },
    userInfo: { sub: 'someone-else', email: 'other@example.test', email_verified: true },
  });
  let createCalled = false;
  OAuthTransaction.findOneAndDelete = async () => transaction({
    intent: 'signup', returnTo: '/create-company', accountType: 'company', organizationType: 'business',
  });
  User.findOne = async () => null;
  callingId.createWorkGrindUser = async () => { createCalled = true; return {}; };

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);
  assert.equal(new URL(response.redirects[0].url).searchParams.get('oauth_error'), 'verified_email_required');
  assert.equal(createCalled, false);
});
