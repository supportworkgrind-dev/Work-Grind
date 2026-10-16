const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateKeyPairSync,
  sign,
} = require('node:crypto');
const {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  getOAuthConfiguration,
  getOAuthConfigurationIssue,
  introspectLinkedInAccessToken,
  OAuthServiceError,
} = require('../dist/services/oauth');

function configureLinkedIn() {
  process.env.NODE_ENV = 'production';
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client';
  process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-secret';
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/oauth/linkedin/callback';
}

function createIdToken(privateKey, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'linkedin-test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://www.linkedin.com',
    aud: 'test-linkedin-client',
    sub: 'linkedin-subject-1',
    exp: now + 300,
    iat: now,
    nonce: 'test-nonce',
    email: 'person@example.test',
    email_verified: true,
    name: 'Example Person',
    given_name: 'Example',
    family_name: 'Person',
    picture: 'https://media.licdn.com/dms/image/example',
    ...overrides,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

test('LinkedIn configuration requires credentials and the implemented callback route', () => {
  configureLinkedIn();
  delete process.env.LINKEDIN_CLIENT_SECRET;
  assert.equal(getOAuthConfigurationIssue('linkedin')?.includes('LINKEDIN_CLIENT_SECRET'), true);
  assert.equal(getOAuthConfiguration('linkedin'), null);

  configureLinkedIn();
  process.env.LINKEDIN_CALLBACK_URL = 'https://backend.example.test/api/auth/other';
  assert.notEqual(getOAuthConfigurationIssue('linkedin'), null);
  configureLinkedIn();
  assert.equal(getOAuthConfigurationIssue('linkedin'), null);

  const configuration = getOAuthConfiguration('linkedin');
  assert.equal(configuration.clientId, 'test-linkedin-client');
  assert.equal(configuration.callbackUrl, process.env.LINKEDIN_CALLBACK_URL);
});

test('LinkedIn configuration requires the production backend callback origin', () => {
  configureLinkedIn();
  process.env.LINKEDIN_CALLBACK_URL = 'https://frontend.example.test/api/auth/oauth/linkedin/callback';

  assert.match(getOAuthConfigurationIssue('linkedin'), /LINKEDIN_CALLBACK_URL must use the configured BACKEND_URL origin/);
  assert.equal(getOAuthConfiguration('linkedin'), null);
});

test('LinkedIn authorization requests ask only for OIDC profile/email and use state, nonce, and PKCE', () => {
  configureLinkedIn();
  const configuration = getOAuthConfiguration('linkedin');
  const url = new URL(buildAuthorizationUrl(
    'linkedin',
    configuration,
    'opaque-state',
    'opaque-nonce',
    'opaque-verifier',
  ));

  assert.equal(url.origin, 'https://www.linkedin.com');
  assert.equal(url.pathname, '/oauth/v2/authorization');
  assert.equal(url.searchParams.get('scope'), 'openid profile email');
  assert.equal(url.searchParams.get('state'), 'opaque-state');
  assert.equal(url.searchParams.get('nonce'), 'opaque-nonce');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.equal(url.searchParams.has('client_secret'), false);
});

test('LinkedIn publishing consent keeps OIDC scopes and adds only member-post permission', () => {
  configureLinkedIn();
  const configuration = getOAuthConfiguration('linkedin');
  const url = new URL(buildAuthorizationUrl(
    'linkedin',
    configuration,
    'publishing-state',
    'publishing-nonce',
    'publishing-verifier',
    true,
  ));

  assert.equal(url.searchParams.get('scope'), 'openid profile email w_member_social');
  assert.equal(url.searchParams.get('state'), 'publishing-state');
  assert.equal(url.searchParams.get('nonce'), 'publishing-nonce');
  assert.ok(url.searchParams.get('code_challenge'));
});

test('LinkedIn publishing consent stores only scopes confirmed by token introspection', async (context) => {
  configureLinkedIn();
  const configuration = getOAuthConfiguration('linkedin');
  const originalFetch = global.fetch;
  let submittedForm;
  global.fetch = async (input, init = {}) => {
    assert.equal(String(input), 'https://www.linkedin.com/oauth/v2/introspectToken');
    submittedForm = new URLSearchParams(init.body);
    return new Response(JSON.stringify({
      active: true,
      client_id: configuration.clientId,
      auth_type: '3L',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: 'openid,profile,email,w_member_social',
    }), { status: 200 });
  };
  context.after(() => { global.fetch = originalFetch; });

  const result = await introspectLinkedInAccessToken(configuration, 'provider-access-token');
  assert.equal(submittedForm.get('client_id'), configuration.clientId);
  assert.equal(submittedForm.get('client_secret'), configuration.clientSecret);
  assert.equal(submittedForm.get('token'), 'provider-access-token');
  assert.deepEqual(result.scopes, ['openid', 'profile', 'email', 'w_member_social']);
  assert.ok(result.expiresAt.getTime() > Date.now());
});

test('LinkedIn code exchange validates the signed ID token and nonce and sends PKCE', async (context) => {
  configureLinkedIn();
  const configuration = getOAuthConfiguration('linkedin');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: 'linkedin-test-key',
    use: 'sig',
    kty: 'RSA',
    alg: 'RS256',
  };
  const originalFetch = global.fetch;
  let submittedForm;
  global.fetch = async (input, init = {}) => {
    if (String(input) === 'https://www.linkedin.com/oauth/v2/accessToken') {
      submittedForm = new URLSearchParams(init.body);
      return new Response(JSON.stringify({
        id_token: createIdToken(privateKey),
        access_token: 'server-only-access-token',
        expires_in: 5184000,
        scope: 'openid profile email w_member_social',
      }), { status: 200 });
    }
    if (String(input) === 'https://www.linkedin.com/oauth/openid/jwks') {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }
    throw new Error('Unexpected OAuth endpoint');
  };
  context.after(() => { global.fetch = originalFetch; });

  const result = await exchangeAuthorizationCode(
    'linkedin',
    configuration,
    'authorization-code',
    'test-verifier',
    'test-nonce',
  );
  assert.equal(result.claims.sub, 'linkedin-subject-1');
  assert.equal(result.claims.email_verified, true);
  assert.equal(result.claims.given_name, 'Example');
  assert.equal(result.claims.family_name, 'Person');
  assert.equal(result.accessToken, 'server-only-access-token');
  assert.equal(result.expiresIn, 5184000);
  assert.deepEqual(result.scopes, ['openid', 'profile', 'email', 'w_member_social']);
  assert.equal(submittedForm.get('client_id'), 'test-linkedin-client');
  assert.equal(submittedForm.get('client_secret'), 'test-linkedin-secret');
  assert.equal(submittedForm.get('code_verifier'), 'test-verifier');

  await assert.rejects(
    exchangeAuthorizationCode(
      'linkedin',
      configuration,
      'authorization-code',
      'test-verifier',
      'different-nonce',
    ),
    /nonce was invalid/,
  );
});

test('LinkedIn token rejection exposes only a safe provider error code and HTTP status', async (context) => {
  configureLinkedIn();
  const configuration = getOAuthConfiguration('linkedin');
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    error: 'invalid_client',
    error_description: 'Do not expose this provider response.',
  }), { status: 401 });
  context.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    exchangeAuthorizationCode(
      'linkedin',
      configuration,
      'test-authorization-code',
      'test-verifier',
      'test-nonce',
    ),
    (error) => {
      assert.ok(error instanceof OAuthServiceError);
      assert.equal(error.diagnosticCode, 'token_endpoint_rejected');
      assert.equal(error.httpStatus, 401);
      assert.equal(error.providerErrorCode, 'invalid_client');
      assert.equal(error.message.includes('Do not expose'), false);
      return true;
    },
  );
});
