const assert = require('node:assert/strict');
const test = require('node:test');
const { generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const OAuthExchange = require('../dist/models/OAuthExchange').default;
const User = require('../dist/models/User').default;
const { completeOAuthCallback, exchangeOAuthSession } = require('../dist/controllers/oauth.controller');

const originalFindOneAndDelete = OAuthTransaction.findOneAndDelete;
const originalExchangeFindOneAndDelete = OAuthExchange.findOneAndDelete;
const originalExchangeCreate = OAuthExchange.create;
const originalUserFindOne = User.findOne;

function configureGoogle() {
  process.env.NODE_ENV = 'production';
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://backend.example.test/api/auth/oauth/google/callback';
  process.env.CLIENT_URL = 'https://frontend.example.test';
}

function signedGoogleIdToken(privateKey, keyId) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: 'test-google-client',
    sub: 'google-callback-subject',
    exp: now + 300,
    iat: now,
    nonce: 'google-callback-nonce',
    email: 'person@example.test',
    email_verified: true,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

function callbackResponse() {
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
    params: { provider: 'google' },
    query: { state, code: 'google-authorization-code' },
    body: {},
    headers: { cookie: `wg_oauth_google_state_${state}=${state}` },
    ip: '127.0.0.1',
  };
}

async function installGoogleProviderResponse(context) {
  const keyId = `google-callback-test-${randomBytes(6).toString('hex')}`;
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
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({
        id_token: signedGoogleIdToken(privateKey, keyId),
        access_token: 'server-only-access-token',
      }), { status: 200 });
    }
    if (String(input) === 'https://www.googleapis.com/oauth2/v3/certs') {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }
    throw new Error('Unexpected OAuth endpoint');
  };
  context.after(() => { global.fetch = originalFetch; });
}

test('Google callback completes an existing verified-user login and persists the correlation ID', async (context) => {
  configureGoogle();
  await installGoogleProviderResponse(context);
  const state = randomBytes(32).toString('base64url');
  const user = {
    _id: { toString: () => 'user-id' },
    isActive: true,
    isDeleted: false,
    isVerified: true,
    isSuperAdmin: false,
    mfaEnabled: false,
    get: (field) => field === 'googleId' ? 'google-callback-subject' : undefined,
  };
  let savedExchange;
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId: 'f15db9f8-9110-46e3-9e69-a33d12c071ef',
    returnTo: '/dashboard',
    intent: 'login',
    audience: 'user',
    codeVerifier: 'google-verifier',
    nonce: 'google-callback-nonce',
  });
  User.findOne = async () => user;
  OAuthExchange.create = async (exchange) => { savedExchange = exchange; return exchange; };
  context.after(() => {
    OAuthTransaction.findOneAndDelete = originalFindOneAndDelete;
    OAuthExchange.create = originalExchangeCreate;
    User.findOne = originalUserFindOne;
  });

  const response = callbackResponse();
  await completeOAuthCallback(callbackRequest(state), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.pathname, '/auth/callback');
  assert.equal(destination.searchParams.get('attemptId'), savedExchange.correlationId);
  assert.equal(destination.searchParams.has('code'), true);
  assert.equal(savedExchange.userId.toString(), 'user-id');
});

test('Google signup reports duplicate email and returns to the selected education workspace', async (context) => {
  configureGoogle();
  await installGoogleProviderResponse(context);
  const state = randomBytes(32).toString('base64url');
  let lookupCount = 0;
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId: '0f1823b3-d6bd-46a3-b608-e764079ac9f3',
    returnTo: '/create-company',
    intent: 'signup',
    audience: 'user',
    accountType: 'company',
    organizationType: 'college',
    codeVerifier: 'google-verifier',
    nonce: 'google-callback-nonce',
  });
  User.findOne = async (query) => {
    lookupCount += 1;
    return 'googleId' in query ? null : { _id: 'existing-email-user' };
  };
  OAuthExchange.create = async () => {
    throw new Error('A duplicate account must not create an exchange session.');
  };
  context.after(() => {
    OAuthTransaction.findOneAndDelete = originalFindOneAndDelete;
    OAuthExchange.create = originalExchangeCreate;
    User.findOne = originalUserFindOne;
  });

  const response = callbackResponse();
  await completeOAuthCallback(callbackRequest(state), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(lookupCount, 2);
  assert.equal(destination.pathname, '/signup');
  assert.equal(destination.searchParams.get('workspace'), 'college');
  assert.equal(destination.searchParams.get('step'), 'details');
  assert.equal(destination.searchParams.get('oauth_error'), 'account_exists');
});

test('Google token rejection redirects with a support ID without exposing provider details', async (context) => {
  configureGoogle();
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    error: 'invalid_client',
    error_description: 'Private provider response detail.',
  }), { status: 401 });
  context.after(() => { global.fetch = originalFetch; });

  const correlationId = '79f51f35-40c2-4658-ae8c-671cf303431f';
  OAuthTransaction.findOneAndDelete = async () => ({
    correlationId,
    returnTo: '/dashboard',
    intent: 'login',
    audience: 'user',
    codeVerifier: 'google-verifier',
    nonce: 'google-callback-nonce',
  });
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  const response = callbackResponse();
  await completeOAuthCallback(callbackRequest(randomBytes(32).toString('base64url')), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.searchParams.get('error'), 'try_again');
  assert.equal(destination.searchParams.get('supportId'), correlationId);
  assert.equal(destination.toString().includes('Private provider response detail'), false);
});

test('OAuth session exchange rejects malformed attempt IDs before querying exchange codes', async (context) => {
  let lookupCount = 0;
  OAuthExchange.findOneAndDelete = async () => {
    lookupCount += 1;
    return null;
  };
  context.after(() => { OAuthExchange.findOneAndDelete = originalExchangeFindOneAndDelete; });

  const response = callbackResponse();
  await exchangeOAuthSession({
    body: { code: 'a'.repeat(32), attemptId: 'not-a-uuid' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, 'OAUTH_CODE_INVALID');
  assert.equal(lookupCount, 0);
});
