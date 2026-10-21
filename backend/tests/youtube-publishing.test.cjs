const assert = require('node:assert/strict');
const test = require('node:test');
const { generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'youtube-test-jwt-secret';

const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const Integration = require('../dist/models/Integration').default;
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const AuditLog = require('../dist/models/AuditLog').default;
const SocialPost = require('../dist/models/SocialPost').default;
const { completeOAuthCallback, startOAuth } = require('../dist/controllers/oauth.controller');
const { publishSocialPost } = require('../dist/controllers/socialPublishing.controller');
const { buildAuthorizationUrl, getOAuthConfiguration } = require('../dist/services/oauth');
const socialMedia = require('../dist/services/socialMedia');
const channelController = require('../dist/controllers/channel.controller');
const { getSocialProviderCatalog } = require('../dist/services/socialProviders');
const {
  getYouTubeAccessToken,
  uploadYouTubeVideo,
  validateYouTubeMetadata,
  YouTubeApiError,
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_UPLOAD_SCOPE,
} = require('../dist/services/youtubePublishing');
const { decryptProviderToken, encryptProviderToken } = require('../dist/utils/providerTokenEncryption');

const SCOPE_GRANT = `openid https://www.googleapis.com/auth/userinfo.email ${YOUTUBE_UPLOAD_SCOPE} ${YOUTUBE_READONLY_SCOPE}`;

const originals = {
  fetch: global.fetch,
  transactionFind: OAuthTransaction.findOneAndDelete,
  transactionCreate: OAuthTransaction.create,
  integrationFindOne: Integration.findOne,
  integrationFindOneAndUpdate: Integration.findOneAndUpdate,
  integrationUpdateOne: Integration.updateOne,
  companyFindOne: Company.findOne,
  userFindById: User.findById,
  auditCreate: AuditLog.create,
  postFindOneAndUpdate: SocialPost.findOneAndUpdate,
  postUpdateOne: SocialPost.updateOne,
  readSocialMediaAsset: socialMedia.readSocialMediaAsset,
  createNotification: channelController.createNotification,
};

function restore() {
  global.fetch = originals.fetch;
  OAuthTransaction.findOneAndDelete = originals.transactionFind;
  OAuthTransaction.create = originals.transactionCreate;
  Integration.findOne = originals.integrationFindOne;
  Integration.findOneAndUpdate = originals.integrationFindOneAndUpdate;
  Integration.updateOne = originals.integrationUpdateOne;
  Company.findOne = originals.companyFindOne;
  User.findById = originals.userFindById;
  AuditLog.create = originals.auditCreate;
  SocialPost.findOneAndUpdate = originals.postFindOneAndUpdate;
  SocialPost.updateOne = originals.postUpdateOne;
  socialMedia.readSocialMediaAsset = originals.readSocialMediaAsset;
  channelController.createNotification = originals.createNotification;
}

function configureGoogle() {
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://backend.example.test/api/auth/oauth/google/callback';
  process.env.CLIENT_URL = 'https://frontend.example.test';
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

function callbackRequest() {
  const state = randomBytes(32).toString('base64url');
  return {
    params: { provider: 'google' },
    query: { state, code: 'google-authorization-code' },
    body: {},
    headers: { cookie: `wg_oauth_google_state_${state}=${state}` },
    ip: '127.0.0.1',
  };
}

function publishingTransaction() {
  return {
    correlationId: '5b8a4d21-7d10-4bd9-9d0e-1a2b3c4d5e6f',
    returnTo: '/social-publishing?oauth_provider=youtube',
    intent: 'publishing',
    audience: 'user',
    userId: { toString: () => 'publisher-id' },
    codeVerifier: 'google-verifier',
    nonce: 'youtube-nonce',
  };
}

/** Mocks Google token/JWKS and YouTube channel endpoints for the consent callback. */
function mockGoogle(context, { scope = SCOPE_GRANT, refreshToken = 'google-refresh-token', channels } = {}) {
  const keyId = `google-${randomBytes(6).toString('hex')}`;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: 'test-google-client',
    sub: 'google-subject',
    exp: now + 300,
    iat: now,
    nonce: 'youtube-nonce',
    email: 'Creator@Example.test',
    email_verified: true,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const idToken = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  const calls = [];
  global.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({
        id_token: idToken,
        access_token: 'google-access-token',
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        expires_in: 3599,
        scope,
      }), { status: 200 });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
      return new Response(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: keyId, use: 'sig', alg: 'RS256' }] }), { status: 200 });
    }
    if (url.startsWith('https://www.googleapis.com/youtube/v3/channels')) {
      return new Response(JSON.stringify({ items: channels ?? [{ id: 'UC-test-channel', snippet: { title: 'WorkGrind Studio' } }] }), { status: 200 });
    }
    throw new Error(`Unexpected endpoint ${url}`);
  };
  context.after(restore);
  return calls;
}

function mockPublisherWorkspace() {
  User.findById = async () => ({
    _id: new mongoose.Types.ObjectId(),
    isActive: true, isDeleted: false, isVerified: true,
    role: 'owner',
    companyId: new mongoose.Types.ObjectId(),
  });
  Company.findOne = () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(), accountType: 'company', organizationType: 'business' }) });
  AuditLog.create = async () => ({});
}

test('Google publishing consent requests YouTube scopes, offline access, and consent', () => {
  configureGoogle();
  const configuration = getOAuthConfiguration('google');
  const url = new URL(buildAuthorizationUrl('google', configuration, 'state-value', 'nonce-value', 'verifier-value', true));
  const scopes = url.searchParams.get('scope').split(' ');
  assert.ok(scopes.includes(YOUTUBE_UPLOAD_SCOPE));
  assert.ok(scopes.includes(YOUTUBE_READONLY_SCOPE));
  assert.ok(!scopes.includes('https://www.googleapis.com/auth/youtube'), 'full-access YouTube scope must not be requested');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.match(url.searchParams.get('prompt'), /consent/);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://backend.example.test/api/auth/oauth/google/callback');

  const login = new URL(buildAuthorizationUrl('google', configuration, 'state-value', 'nonce-value', 'verifier-value', false));
  assert.equal(login.searchParams.get('scope'), 'openid profile email');
  assert.equal(login.searchParams.get('access_type'), null);
  assert.equal(login.searchParams.get('prompt'), 'select_account');
});

test('YouTube connect start tags the return URL and is limited to publishing managers', async (context) => {
  configureGoogle();
  context.after(restore);
  let saved;
  OAuthTransaction.create = async (transaction) => { saved = transaction; return transaction; };
  const request = (role) => ({
    params: { provider: 'google' },
    query: { intent: 'publishing', returnTo: '/social-publishing' },
    headers: {},
    accepts: () => false,
    user: { userId: new mongoose.Types.ObjectId().toString(), companyId: 'company-id', role, accountType: 'company', organizationType: 'business' },
  });

  const allowed = responseMock();
  await startOAuth(request('owner'), allowed);
  assert.equal(allowed.body.success, true);
  assert.equal(saved.intent, 'publishing');
  assert.equal(saved.returnTo, '/social-publishing?oauth_provider=youtube');
  assert.match(new URL(allowed.body.authUrl).searchParams.get('scope'), /youtube\.upload/);

  const denied = responseMock();
  await startOAuth(request('employee'), denied);
  assert.equal(denied.statusCode, 400);
});

test('YouTube consent callback stores encrypted tokens and the channel identity', async (context) => {
  configureGoogle();
  const calls = mockGoogle(context);
  mockPublisherWorkspace();
  OAuthTransaction.findOneAndDelete = async () => publishingTransaction();
  Integration.findOne = () => ({ select: async () => null });
  let update;
  Integration.findOneAndUpdate = async (filter, mutation) => {
    update = { filter, mutation };
    return { _id: new mongoose.Types.ObjectId(), companyId: filter.companyId, createdBy: mutation.$set.createdBy, config: mutation.$set.config };
  };

  const response = responseMock();
  await completeOAuthCallback(callbackRequest(), response);

  const destination = new URL(response.redirects[0].url);
  assert.equal(destination.pathname, '/social-publishing');
  assert.equal(destination.searchParams.get('oauth'), 'connected');
  assert.equal(destination.searchParams.get('oauth_provider'), 'youtube');
  assert.equal(update.filter.provider, 'youtube');
  const set = update.mutation.$set;
  assert.notEqual(set.accessToken, 'google-access-token');
  assert.notEqual(set.refreshToken, 'google-refresh-token');
  assert.equal(decryptProviderToken(set.accessToken), 'google-access-token');
  assert.equal(decryptProviderToken(set.refreshToken), 'google-refresh-token');
  assert.equal(set.config.channelId, 'UC-test-channel');
  assert.equal(set.config.identityName, 'WorkGrind Studio');
  assert.equal(set.config.identityEmail, 'creator@example.test');
  assert.deepEqual(set.config.grantedScopes.sort(), [YOUTUBE_READONLY_SCOPE, YOUTUBE_UPLOAD_SCOPE].sort());
  const channelCall = calls.find(({ url }) => url.includes('/youtube/v3/channels'));
  assert.equal(channelCall.init.headers.Authorization, 'Bearer google-access-token');
});

test('YouTube consent without the upload scope or a refresh token is refused without storing tokens', async (context) => {
  configureGoogle();
  for (const options of [{ scope: `openid ${YOUTUBE_READONLY_SCOPE}` }, { refreshToken: null }]) {
    mockGoogle(context, options);
    mockPublisherWorkspace();
    OAuthTransaction.findOneAndDelete = async () => publishingTransaction();
    let stored = false;
    Integration.findOneAndUpdate = async () => { stored = true; return null; };
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args);
    const response = responseMock();
    try {
      await completeOAuthCallback(callbackRequest(), response);
    } finally {
      console.error = originalError;
    }
    const destination = new URL(response.redirects[0].url);
    assert.equal(destination.pathname, '/social-publishing');
    assert.equal(destination.searchParams.get('oauth_error'), 'publishing_permission_denied');
    assert.equal(destination.searchParams.get('oauth_provider'), 'youtube');
    assert.equal(stored, false);
    assert.equal(JSON.stringify(errors).includes('google-refresh-token'), false);
  }
});

test('Google accounts without a YouTube channel get a specific error', async (context) => {
  configureGoogle();
  mockGoogle(context, { channels: [] });
  mockPublisherWorkspace();
  OAuthTransaction.findOneAndDelete = async () => publishingTransaction();
  Integration.findOneAndUpdate = async () => { throw new Error('must not store'); };
  const originalError = console.error;
  console.error = () => {};
  const response = responseMock();
  try {
    await completeOAuthCallback(callbackRequest(), response);
  } finally {
    console.error = originalError;
  }
  assert.equal(new URL(response.redirects[0].url).searchParams.get('oauth_error'), 'youtube_channel_required');
});

test('expired YouTube access tokens refresh and persist; revoked grants require reconnection', async (context) => {
  configureGoogle();
  context.after(restore);
  const bodies = [];
  global.fetch = async (input, init) => {
    assert.equal(String(input), 'https://oauth2.googleapis.com/token');
    bodies.push(new URLSearchParams(init.body));
    return new Response(JSON.stringify({ access_token: 'refreshed-access-token', expires_in: 3600 }), { status: 200 });
  };
  let saved = 0;
  const connection = {
    accessToken: encryptProviderToken('stale-access-token'),
    refreshToken: encryptProviderToken('stored-refresh-token'),
    tokenExpiresAt: new Date(Date.now() - 1000),
    async save() { saved += 1; },
  };
  assert.equal(await getYouTubeAccessToken(connection), 'refreshed-access-token');
  assert.equal(bodies[0].get('grant_type'), 'refresh_token');
  assert.equal(bodies[0].get('refresh_token'), 'stored-refresh-token');
  assert.equal(bodies[0].get('client_secret'), 'test-google-secret');
  assert.equal(decryptProviderToken(connection.accessToken), 'refreshed-access-token');
  assert.ok(connection.tokenExpiresAt.getTime() > Date.now() + 3_000_000);
  assert.equal(saved, 1);

  // A still-valid token is reused without a network call.
  global.fetch = async () => { throw new Error('no refresh expected'); };
  assert.equal(await getYouTubeAccessToken(connection), 'refreshed-access-token');

  global.fetch = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  connection.tokenExpiresAt = new Date(Date.now() - 1000);
  await assert.rejects(getYouTubeAccessToken(connection), (error) =>
    error instanceof YouTubeApiError && error.status === 401 && error.reason === 'invalid_grant');
});

test('YouTube uploads use a resumable session with metadata, then send the video bytes', async (context) => {
  context.after(restore);
  const calls = [];
  global.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (calls.length === 1) {
      return new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc' } });
    }
    return new Response(JSON.stringify({ id: 'dQw4w9WgXcQ', status: { privacyStatus: 'unlisted' } }), { status: 200 });
  };
  const video = Buffer.from('fake-mp4-bytes');
  const result = await uploadYouTubeVideo('access-token', { buffer: video, mimeType: 'video/mp4' }, {
    title: '  Launch video ', description: 'Our product launch.', privacyStatus: 'unlisted',
  });
  assert.equal(result.videoId, 'dQw4w9WgXcQ');
  assert.equal(result.videoUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.match(calls[0].url, /^https:\/\/www\.googleapis\.com\/upload\/youtube\/v3\/videos\?uploadType=resumable&part=snippet,status$/);
  assert.equal(calls[0].init.headers['X-Upload-Content-Type'], 'video/mp4');
  assert.equal(calls[0].init.headers['X-Upload-Content-Length'], String(video.length));
  const metadata = JSON.parse(calls[0].init.body);
  assert.equal(metadata.snippet.title, 'Launch video');
  assert.equal(metadata.status.privacyStatus, 'unlisted');
  assert.equal(metadata.status.selfDeclaredMadeForKids, false);
  assert.equal(calls[1].init.method, 'PUT');
  assert.equal(calls[1].url, 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc');

  global.fetch = async () => new Response(null, { status: 200, headers: { Location: 'https://attacker.example.test/upload' } });
  await assert.rejects(uploadYouTubeVideo('access-token', { buffer: video, mimeType: 'video/mp4' }, {
    title: 'T', description: 'D', privacyStatus: 'private',
  }), (error) => error instanceof YouTubeApiError && error.reason === 'upload_session_invalid');

  global.fetch = async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded', message: 'secret detail' }] } }), { status: 403 });
  await assert.rejects(uploadYouTubeVideo('access-token', { buffer: video, mimeType: 'video/mp4' }, {
    title: 'T', description: 'D', privacyStatus: 'private',
  }), (error) => error instanceof YouTubeApiError && error.status === 403 && error.reason === 'quotaExceeded');
});

test('YouTube metadata validation enforces title, description, and forbidden characters', () => {
  assert.equal(validateYouTubeMetadata('Title', 'Description'), null);
  assert.match(validateYouTubeMetadata('', 'Description'), /title/);
  assert.match(validateYouTubeMetadata('x'.repeat(101), 'Description'), /title/);
  assert.match(validateYouTubeMetadata('Title', ''), /description/);
  assert.match(validateYouTubeMetadata('Bad <title>', 'Description'), /< or >/);
});

function youtubePost(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
    authorId: new mongoose.Types.ObjectId(),
    platform: 'youtube',
    text: 'Launch description',
    platformData: { title: 'Launch video', privacyStatus: 'private' },
    media: [{ fileId: new mongoose.Types.ObjectId(), mimeType: 'video/mp4' }],
    toObject() { return { _id: this._id, platform: 'youtube', text: this.text }; },
    ...overrides,
  };
}

function youtubeConnection() {
  return {
    _id: new mongoose.Types.ObjectId(),
    accessToken: encryptProviderToken('valid-access-token'),
    refreshToken: encryptProviderToken('stored-refresh-token'),
    tokenExpiresAt: new Date(Date.now() + 30 * 60_000),
    config: { grantedScopes: [YOUTUBE_UPLOAD_SCOPE, YOUTUBE_READONLY_SCOPE], channelId: 'UC-test-channel' },
    async save() {},
  };
}

function publishRequest(role = 'owner', organizationType = 'business') {
  return {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: { platform: 'youtube' },
    user: { companyId: new mongoose.Types.ObjectId().toString(), userId: new mongoose.Types.ObjectId().toString(), role, organizationType },
    ip: '127.0.0.1',
  };
}

test('publishing a YouTube draft uploads the video and records the watch URL', async (context) => {
  configureGoogle();
  context.after(restore);
  const connection = youtubeConnection();
  Integration.findOne = (filter) => {
    assert.equal(filter.provider, 'youtube');
    return { select: async () => connection };
  };
  let claim;
  const post = youtubePost();
  SocialPost.findOneAndUpdate = async (filter, mutation) => { claim = { filter, mutation }; return post; };
  let persisted;
  SocialPost.updateOne = async (filter, mutation) => { persisted = mutation; return { matchedCount: 1 }; };
  socialMedia.readSocialMediaAsset = async (_fileId, _companyId, _access, rules) => {
    assert.equal(rules, 'youtube');
    return { buffer: Buffer.from('video'), mimeType: 'video/mp4', title: 'launch.mp4', size: 5 };
  };
  AuditLog.create = async () => ({});
  channelController.createNotification = async () => ({});
  global.fetch = async (input) => String(input).includes('uploadType=resumable')
    ? new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=1' } })
    : new Response(JSON.stringify({ id: 'abcDEF12345', status: { privacyStatus: 'private' } }), { status: 200 });

  const res = responseMock();
  await publishSocialPost(publishRequest(), res);

  assert.equal(res.body.success, true);
  assert.equal(claim.filter.platform, 'youtube');
  assert.equal(persisted.$set.status, 'published');
  assert.equal(persisted.$set.destinations[0].externalPostUrl, 'https://www.youtube.com/watch?v=abcDEF12345');
  assert.equal(persisted.$set.platformData.youtubeVideoId, 'abcDEF12345');
});

test('a revoked YouTube grant fails the post and marks the connection for reconnection', async (context) => {
  configureGoogle();
  context.after(restore);
  const connection = youtubeConnection();
  connection.tokenExpiresAt = new Date(Date.now() - 1000);
  Integration.findOne = () => ({ select: async () => connection });
  let connectionUpdate;
  Integration.updateOne = async (_filter, mutation) => { connectionUpdate = mutation; return {}; };
  SocialPost.findOneAndUpdate = async () => youtubePost();
  let failure;
  SocialPost.updateOne = async (_filter, mutation, options) => { failure = { mutation, options }; return { matchedCount: 1 }; };
  socialMedia.readSocialMediaAsset = async () => ({ buffer: Buffer.from('video'), mimeType: 'video/mp4', title: 'v', size: 5 });
  AuditLog.create = async () => ({});
  channelController.createNotification = async () => ({});
  global.fetch = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);

  const res = responseMock();
  try {
    await publishSocialPost(publishRequest(), res);
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'authorization_revoked');
  assert.equal(failure.mutation.$set.failureCode, 'authorization_revoked');
  assert.deepEqual(failure.options.arrayFilters, [{ 'destination.provider': 'youtube', 'destination.status': 'publishing' }]);
  assert.deepEqual(connectionUpdate.$set, { status: 'error', errorMessage: 'authorization_revoked' });
  assert.equal(JSON.stringify(errors).includes('stored-refresh-token'), false);
});

// In business workspaces `manager` satisfies `admin` (shared with LinkedIn); a school
// manager can publish but cannot review, so only approved posts are claimable.
test('YouTube publishing requires an approved post for non-reviewers and a connected channel', async (context) => {
  configureGoogle();
  context.after(restore);
  Integration.findOne = () => ({ select: async () => null });
  const missing = responseMock();
  await publishSocialPost(publishRequest(), missing);
  assert.equal(missing.statusCode, 409);
  assert.equal(missing.body.code, 'YOUTUBE_RECONNECT_REQUIRED');

  Integration.findOne = () => ({ select: async () => youtubeConnection() });
  let claimFilter;
  SocialPost.findOneAndUpdate = async (filter) => { claimFilter = filter; return null; };
  const manager = responseMock();
  await publishSocialPost(publishRequest('manager', 'school'), manager);
  assert.equal(manager.statusCode, 409);
  assert.deepEqual(claimFilter.$or, [{ status: { $in: ['approved'] } }]);
});

test('the YouTube destination is available only when Google OAuth is configured', () => {
  configureGoogle();
  const configured = getSocialProviderCatalog().find((provider) => provider.id === 'youtube');
  assert.equal(configured.availability, 'available');
  assert.equal(configured.capabilities.connect, true);
  assert.equal(configured.capabilities.publishMedia, true);
  assert.equal(configured.capabilities.schedule, false);

  const secret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_SECRET;
  try {
    const unconfigured = getSocialProviderCatalog().find((provider) => provider.id === 'youtube');
    assert.equal(unconfigured.availability, 'setup_required');
    assert.equal(unconfigured.capabilities.connect, false);
  } finally {
    process.env.GOOGLE_CLIENT_SECRET = secret;
  }
  assert.equal(getSocialProviderCatalog().find((provider) => provider.id === 'linkedin').availability, 'available');
});
