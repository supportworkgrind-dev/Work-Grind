const assert = require('node:assert/strict');
const test = require('node:test');
const { randomBytes } = require('node:crypto');
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const { completeOAuthCallback } = require('../dist/controllers/oauth.controller');

const originalFindOneAndDelete = OAuthTransaction.findOneAndDelete;

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

function callbackRequest(state, cookieState = state, extraQuery = {}) {
  return {
    params: { provider: 'linkedin' },
    query: { state, ...extraQuery },
    body: {},
    headers: { cookie: cookieState ? `wg_oauth_linkedin_state_${cookieState}=${cookieState}` : '' },
    ip: '127.0.0.1',
  };
}

test('LinkedIn callback accepts independent per-attempt state cookies for concurrent sign-ins', async (context) => {
  process.env.CLIENT_URL = 'https://frontend.example.test';
  const consumed = new Set();
  OAuthTransaction.findOneAndDelete = async ({ stateHash, provider, expiresAt }) => {
    assert.equal(provider, 'linkedin');
    assert.ok(expiresAt.$gt instanceof Date);
    if (consumed.has(stateHash)) return null;
    consumed.add(stateHash);
    return {
      stateHash,
      returnTo: '/dashboard',
      intent: 'login',
      audience: 'user',
    };
  };
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  const states = [
    randomBytes(32).toString('base64url'),
    randomBytes(32).toString('base64url'),
  ];
  const results = await Promise.all(states.map(async (state) => {
    const response = responseMock();
    await completeOAuthCallback(callbackRequest(state, state, { error: 'access_denied' }), response);
    return response;
  }));

  assert.deepEqual(results.map((response) => new URL(response.redirects[0].url).searchParams.get('error')), [
    'cancelled',
    'cancelled',
  ]);
  assert.ok(results.every((response) =>
    response.headers['Set-Cookie'].some((cookie) => cookie.startsWith(
      `wg_oauth_linkedin_state_${states[results.indexOf(response)]}=`,
    ))));
});

test('LinkedIn callback rejects a missing or mismatched browser state cookie before transaction lookup', async (context) => {
  let transactionLookups = 0;
  OAuthTransaction.findOneAndDelete = async () => {
    transactionLookups += 1;
    return null;
  };
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  const state = randomBytes(32).toString('base64url');
  const response = responseMock();
  await completeOAuthCallback(callbackRequest(state, randomBytes(32).toString('base64url')), response);

  assert.equal(transactionLookups, 0);
  assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), 'attempt_expired');
});

test('OAuth callback rejects missing or malformed state before transaction lookup', async (context) => {
  let transactionLookups = 0;
  OAuthTransaction.findOneAndDelete = async () => {
    transactionLookups += 1;
    return null;
  };
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  for (const state of ['', 'not a valid state']) {
    const request = callbackRequest(state);
    request.query.state = state;
    const response = responseMock();
    await completeOAuthCallback(request, response);

    const destination = new URL(response.redirects[0].url);
    assert.equal(destination.searchParams.get('error'), 'invalid_request');
    assert.match(
      destination.searchParams.get('supportId'),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  }
  assert.equal(transactionLookups, 0);
});

test('OAuth signup cancellation returns to the selected workspace details step', async (context) => {
  process.env.CLIENT_URL = 'https://frontend.example.test';
  const selections = [
    { workspace: 'solo', accountType: 'individual', organizationType: 'business' },
    { workspace: 'business', accountType: 'company', organizationType: 'business' },
    { workspace: 'school', accountType: 'company', organizationType: 'school' },
    { workspace: 'college', accountType: 'company', organizationType: 'college' },
    { workspace: 'university', accountType: 'company', organizationType: 'university' },
  ];
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  for (const selection of selections) {
    OAuthTransaction.findOneAndDelete = async () => ({
      returnTo: '/create-company',
      intent: 'signup',
      audience: 'user',
      accountType: selection.accountType,
      organizationType: selection.organizationType,
    });

    const state = randomBytes(32).toString('base64url');
    const response = responseMock();
    await completeOAuthCallback(callbackRequest(state, state, { error: 'access_denied' }), response);

    const destination = new URL(response.redirects[0].url);
    assert.equal(destination.pathname, '/signup');
    assert.equal(destination.searchParams.get('workspace'), selection.workspace);
    assert.equal(destination.searchParams.get('step'), 'details');
    assert.equal(destination.searchParams.get('oauth_error'), 'cancelled');
  }
});

test('LinkedIn callback rejects expired or replayed OAuth transactions', async (context) => {
  let available = true;
  OAuthTransaction.findOneAndDelete = async () => {
    if (!available) return null;
    available = false;
    return {
      returnTo: '/dashboard',
      intent: 'login',
      audience: 'user',
    };
  };
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  const state = randomBytes(32).toString('base64url');
  const firstResponse = responseMock();
  await completeOAuthCallback(callbackRequest(state, state, { error: 'access_denied' }), firstResponse);
  const replayResponse = responseMock();
  await completeOAuthCallback(callbackRequest(state, state, { error: 'access_denied' }), replayResponse);

  assert.equal(new URL(firstResponse.redirects[0].url).searchParams.get('error'), 'cancelled');
  assert.equal(new URL(replayResponse.redirects[0].url).searchParams.get('error'), 'attempt_expired');
});

test('LinkedIn callback with a valid state but no authorization code does not continue sign-in', async (context) => {
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client';
  process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-secret';
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/oauth/linkedin/callback';
  process.env.CLIENT_URL = 'https://frontend.example.test';
  OAuthTransaction.findOneAndDelete = async () => ({
    returnTo: '/dashboard',
    intent: 'login',
    audience: 'user',
    codeVerifier: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
  });
  context.after(() => { OAuthTransaction.findOneAndDelete = originalFindOneAndDelete; });

  const state = randomBytes(32).toString('base64url');
  const response = responseMock();
  await completeOAuthCallback(callbackRequest(state, state), response);

  assert.equal(new URL(response.redirects[0].url).searchParams.get('error'), 'attempt_expired');
});
