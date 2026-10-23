const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { generateKeyPairSync, randomBytes, sign } = require('node:crypto');

process.env.JWT_SECRET ||= randomBytes(48).toString('base64url');

const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const Integration = require('../dist/models/Integration').default;
const SocialPost = require('../dist/models/SocialPost').default;
const AuditLog = require('../dist/models/AuditLog').default;
const channelController = require('../dist/controllers/channel.controller');
const { completeOAuthCallback } = require('../dist/controllers/oauth.controller');
const { getLinkedInConnection, publishSocialPost } = require('../dist/controllers/socialPublishing.controller');
const { publishLinkedInPost, LinkedInApiError } = require('../dist/services/linkedinPublishing');
const { encryptProviderToken } = require('../dist/utils/providerTokenEncryption');

/**
 * LinkedIn member-profile publishing diagnostics: every failure is reported
 * with a specific, actionable state, and logs carry LinkedIn's error details
 * without tokens. Uses mocked LinkedIn responses; nothing is posted.
 */

const ACCESS_TOKEN = 'server-only-linkedin-access-token-value';
const saved = {
  fetch: global.fetch,
  transactionFind: OAuthTransaction.findOneAndDelete,
  integrationFindOne: Integration.findOne,
  integrationUpdateOne: Integration.updateOne,
  postFindOneAndUpdate: SocialPost.findOneAndUpdate,
  postUpdateOne: SocialPost.updateOne,
  auditCreate: AuditLog.create,
  notify: channelController.createNotification,
  consoleError: console.error,
  env: { ...process.env },
};

test.afterEach(() => {
  global.fetch = saved.fetch;
  OAuthTransaction.findOneAndDelete = saved.transactionFind;
  Integration.findOne = saved.integrationFindOne;
  Integration.updateOne = saved.integrationUpdateOne;
  SocialPost.findOneAndUpdate = saved.postFindOneAndUpdate;
  SocialPost.updateOne = saved.postUpdateOne;
  AuditLog.create = saved.auditCreate;
  channelController.createNotification = saved.notify;
  console.error = saved.consoleError;
  for (const key of ['BACKEND_URL', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_CALLBACK_URL', 'CLIENT_URL']) {
    if (saved.env[key] === undefined) delete process.env[key]; else process.env[key] = saved.env[key];
  }
});

function configureLinkedIn() {
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client';
  process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-secret';
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/oauth/linkedin/callback';
  process.env.CLIENT_URL = 'https://frontend.example.test';
}

function captureErrors() {
  const logged = [];
  console.error = (...args) => logged.push(args);
  return logged;
}

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    redirects: [],
    setHeader(name, value) { this.headers[name] = value; return this; },
    append(name, value) { this.headers[name] = [...(this.headers[name] || []), value]; return this; },
    set() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(status, url) { this.redirects.push({ status, url }); return this; },
    cookie() { return this; },
    clearCookie() { return this; },
  };
}

function callbackRequest(query) {
  const state = randomBytes(32).toString('base64url');
  return {
    params: { provider: 'linkedin' },
    query: { state, ...query },
    body: {},
    headers: { cookie: `wg_oauth_linkedin_state_${state}=${state}` },
    ip: '127.0.0.1',
  };
}

function transaction(intent, nonce = 'nonce') {
  return {
    correlationId: '1f0e7c3a-5b6d-4e8f-9a0b-1c2d3e4f5a6b',
    returnTo: intent === 'publishing' ? '/settings?tab=integrations' : '/dashboard',
    intent,
    audience: 'user',
    userId: new mongoose.Types.ObjectId(),
    codeVerifier: 'verifier',
    nonce,
  };
}

function oauthError(response) {
  // Settings/link flows use oauth_error; sign-in returns to /auth/callback with error.
  const params = new URL(response.redirects[0].url).searchParams;
  return params.get('oauth_error') ?? params.get('error');
}

// ── OAuth consent ────────────────────────────────────────────────────────────

test('an unapproved publishing scope at LinkedIn consent is reported as an app approval problem', async () => {
  configureLinkedIn();
  const logged = captureErrors();
  OAuthTransaction.findOneAndDelete = async () => transaction('publishing');
  const response = responseMock();
  await completeOAuthCallback(callbackRequest({ error: 'unauthorized_scope_error', error_description: 'Scope "w_member_social" is not authorized for your application' }), response);
  assert.equal(oauthError(response), 'publishing_scope_not_approved');
  assert.ok(logged.some(([message]) => /not approved for the publishing scope/.test(message)));

  // The same provider code during sign-in stays a generic authorization failure.
  OAuthTransaction.findOneAndDelete = async () => transaction('login');
  const signIn = responseMock();
  await completeOAuthCallback(callbackRequest({ error: 'unauthorized_scope_error' }), signIn);
  assert.notEqual(oauthError(signIn), 'publishing_scope_not_approved');
});

test('rejected LinkedIn client credentials are named on the publishing path only', async () => {
  configureLinkedIn();
  captureErrors();
  global.fetch = async (input) => {
    assert.equal(String(input), 'https://www.linkedin.com/oauth/v2/accessToken');
    return new Response(JSON.stringify({ error: 'invalid_client', error_description: 'Client authentication failed' }), { status: 401 });
  };
  OAuthTransaction.findOneAndDelete = async () => transaction('publishing');
  const publishing = responseMock();
  await completeOAuthCallback(callbackRequest({ code: 'authorization-code' }), publishing);
  assert.equal(oauthError(publishing), 'provider_credentials_rejected');

  OAuthTransaction.findOneAndDelete = async () => transaction('login');
  const signIn = responseMock();
  await completeOAuthCallback(callbackRequest({ code: 'authorization-code' }), signIn);
  assert.equal(oauthError(signIn), 'provider_unavailable');
});

test('a grant without w_member_social is refused and logs the granted scope names, not the token', async () => {
  configureLinkedIn();
  const logged = captureErrors();
  const nonce = randomBytes(16).toString('base64url');
  const keyId = `diag-${randomBytes(4).toString('hex')}`;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://www.linkedin.com', aud: 'test-linkedin-client', sub: 'member-subject', exp: now + 300, iat: now,
    nonce, email: 'person@example.test', email_verified: true, name: 'Example Person',
  })).toString('base64url');
  const idToken = `${header}.${payload}.${sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')}`;
  global.fetch = async (input) => {
    const url = String(input);
    if (url === 'https://www.linkedin.com/oauth/v2/accessToken') {
      return new Response(JSON.stringify({ id_token: idToken, access_token: ACCESS_TOKEN, scope: 'openid profile email' }), { status: 200 });
    }
    if (url === 'https://www.linkedin.com/oauth/openid/jwks') {
      return new Response(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: keyId, use: 'sig', alg: 'RS256' }] }), { status: 200 });
    }
    if (url === 'https://www.linkedin.com/oauth/v2/introspectToken') {
      return new Response(JSON.stringify({ active: true, client_id: 'test-linkedin-client', auth_type: '3L', expires_at: now + 5_000_000, scope: 'openid,profile,email' }), { status: 200 });
    }
    throw new Error(`Unexpected request to ${url}`);
  };
  OAuthTransaction.findOneAndDelete = async () => transaction('publishing', nonce);
  const response = responseMock();
  await completeOAuthCallback(callbackRequest({ code: 'authorization-code' }), response);

  assert.equal(oauthError(response), 'publishing_permission_denied');
  const scopeLog = logged.find(([message]) => /did not grant the member-posting scope/.test(message));
  assert.ok(scopeLog, 'the missing scope is logged');
  assert.deepEqual(scopeLog[1].grantedScopes, ['openid', 'profile', 'email']);
  assert.equal(scopeLog[1].requiredScope, 'w_member_social');
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(ACCESS_TOKEN));
});

// ── Connection state ─────────────────────────────────────────────────────────

async function connectionState(record) {
  Integration.findOne = () => ({ lean: async () => record });
  const res = responseMock();
  await getLinkedInConnection({ user: { companyId: new mongoose.Types.ObjectId().toString() } }, res);
  return res.body.connection;
}

const future = () => new Date(Date.now() + 30 * 86_400_000);
const connected = (overrides = {}) => ({
  status: 'connected',
  tokenExpiresAt: future(),
  config: { grantedScopes: ['openid', 'profile', 'email', 'w_member_social'], identityName: 'Example Person', linkedinSubject: 'member' },
  ...overrides,
});

test('the connection state distinguishes every LinkedIn situation', async () => {
  configureLinkedIn();
  assert.equal((await connectionState(null)).state, 'not_connected');
  assert.equal((await connectionState({ status: 'disconnected' })).state, 'not_connected');
  const ok = await connectionState(connected());
  assert.equal(ok.state, 'connected');
  assert.equal(ok.canPublishMemberPosts, true);
  assert.deepEqual(ok.formats, { text: true, image: ['image/jpeg', 'image/png'], video: ['video/mp4'] });
  assert.equal((await connectionState(connected({ tokenExpiresAt: new Date(Date.now() - 1000) }))).state, 'reauthorization_required');
  assert.equal((await connectionState(connected({ status: 'error', errorMessage: 'authorization_revoked' }))).state, 'reauthorization_required');
  assert.equal((await connectionState(connected({ status: 'error', errorMessage: 'permission_or_member_access_denied' }))).state, 'permission_missing');
  const missingScope = await connectionState(connected({ config: { grantedScopes: ['openid', 'profile'], linkedinSubject: 'member' } }));
  assert.equal(missingScope.state, 'permission_missing');
  assert.equal(missingScope.requiredScope, 'w_member_social');

  delete process.env.LINKEDIN_CLIENT_SECRET;
  assert.equal((await connectionState(connected())).state, 'configuration_required');
});

test('the connection status never exposes the stored token', async () => {
  configureLinkedIn();
  const body = await connectionState(connected({ accessToken: encryptProviderToken(ACCESS_TOKEN) }));
  assert.doesNotMatch(JSON.stringify(body), /accessToken|server-only/);
});

// ── Publishing failures ──────────────────────────────────────────────────────

test('LinkedIn error bodies are kept as sanitized diagnostics on the thrown error', async () => {
  global.fetch = async () => new Response(JSON.stringify({
    serviceErrorCode: 100,
    message: `Not enough permissions to access: partnerApiPostsExternal.CREATE Bearer ${ACCESS_TOKEN}`,
  }), { status: 403, headers: { 'content-type': 'application/json' } });
  const error = await publishLinkedInPost('token', 'member', 'Hello').catch((caught) => caught);
  assert.ok(error instanceof LinkedInApiError);
  assert.equal(error.status, 403);
  assert.equal(error.stage, 'post');
  assert.equal(error.providerCode, '100');
  assert.match(error.providerMessage, /Not enough permissions to access: partnerApiPostsExternal\.CREATE/);
  assert.doesNotMatch(error.providerMessage, new RegExp(ACCESS_TOKEN));
});

function mockPublishPath(response) {
  const connection = {
    _id: new mongoose.Types.ObjectId(),
    status: 'connected',
    accessToken: encryptProviderToken(ACCESS_TOKEN),
    tokenExpiresAt: future(),
    config: { grantedScopes: ['openid', 'profile', 'email', 'w_member_social'], linkedinSubject: 'member-subject' },
    saved: false,
    async save() { this.saved = true; },
  };
  Integration.findOne = () => ({ select: async () => connection });
  const post = { _id: new mongoose.Types.ObjectId(), companyId: new mongoose.Types.ObjectId(), authorId: new mongoose.Types.ObjectId(), text: 'Launch day', media: [], platform: 'linkedin' };
  SocialPost.findOneAndUpdate = async () => post;
  const updates = [];
  SocialPost.updateOne = async (filter, mutation) => { updates.push(mutation); return { matchedCount: 1, modifiedCount: 1 }; };
  AuditLog.create = async () => ({});
  channelController.createNotification = async () => ({});
  global.fetch = async () => response();
  return { connection, updates };
}

function publishRequest() {
  return {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: {},
    user: { companyId: new mongoose.Types.ObjectId().toString(), userId: new mongoose.Types.ObjectId().toString(), role: 'owner', organizationType: 'business' },
    ip: '127.0.0.1',
  };
}

test('a 403 from LinkedIn fails the post, flags missing permission, and logs LinkedIn\'s reason safely', async () => {
  configureLinkedIn();
  const logged = captureErrors();
  const { connection, updates } = mockPublishPath(() => new Response(JSON.stringify({ serviceErrorCode: 100, message: 'Not enough permissions to access: partnerApiPostsExternal.CREATE' }), { status: 403, headers: { 'content-type': 'application/json' } }));
  const res = responseMock();
  await publishSocialPost(publishRequest(), res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'permission_or_member_access_denied');
  assert.equal(connection.status, 'error');
  assert.equal(connection.errorMessage, 'permission_or_member_access_denied');
  assert.ok(updates.some((update) => update.$set?.status === 'failed'), 'the post is marked failed, never published');
  const failure = logged.find(([message]) => message === '[SocialPublishing] LinkedIn publish failed.');
  assert.equal(failure[1].httpStatus, 403);
  assert.equal(failure[1].providerErrorCode, '100');
  assert.match(failure[1].providerMessage, /partnerApiPostsExternal\.CREATE/);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(ACCESS_TOKEN));
});

test('a revoked LinkedIn token asks for reauthorization', async () => {
  configureLinkedIn();
  captureErrors();
  const { connection } = mockPublishPath(() => new Response(JSON.stringify({ serviceErrorCode: 65601, message: 'The token used in the request has been revoked by the user' }), { status: 401, headers: { 'content-type': 'application/json' } }));
  const res = responseMock();
  await publishSocialPost(publishRequest(), res);
  assert.equal(res.body.code, 'authorization_revoked');
  assert.equal(connection.errorMessage, 'authorization_revoked');
});

test('an unsupported LinkedIn API version is reported as a configuration problem, not a member issue', async () => {
  configureLinkedIn();
  captureErrors();
  const { connection } = mockPublishPath(() => new Response(JSON.stringify({ code: 'NONEXISTENT_VERSION', message: 'Requested version 202610 is not active' }), { status: 426, headers: { 'content-type': 'application/json' } }));
  const res = responseMock();
  await publishSocialPost(publishRequest(), res);
  assert.equal(res.body.code, 'provider_version_unsupported');
  assert.equal(connection.status, 'connected', 'the member connection stays intact');
});
