const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  getOAuthConfiguration,
  getOAuthConfigurationIssue,
} = require('../dist/services/oauth');

function configureGoogle() {
  process.env.NODE_ENV = 'production';
  process.env.BACKEND_URL = 'https://backend.example.test';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://backend.example.test/api/auth/oauth/google/callback';
}

function createGoogleIdToken(privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'google-test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: 'test-google-client',
    sub: 'google-subject-1',
    exp: now + 300,
    iat: now,
    nonce: 'google-test-nonce',
    email: 'person@example.test',
    email_verified: true,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

test('Google configuration and authorization use the configured callback and PKCE', () => {
  configureGoogle();
  assert.equal(getOAuthConfigurationIssue('google'), null);
  const configuration = getOAuthConfiguration('google');
  const url = new URL(buildAuthorizationUrl(
    'google',
    configuration,
    'google-state',
    'google-nonce',
    'google-verifier',
  ));

  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'test-google-client');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI);
  assert.equal(url.searchParams.get('scope'), 'openid profile email');
  assert.equal(url.searchParams.get('state'), 'google-state');
  assert.equal(url.searchParams.get('nonce'), 'google-nonce');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.equal(url.searchParams.has('client_secret'), false);
});

test('Google configuration requires both credentials and the production backend callback origin', () => {
  configureGoogle();
  delete process.env.GOOGLE_CLIENT_ID;
  assert.match(getOAuthConfigurationIssue('google'), /GOOGLE_CLIENT_ID/);
  assert.equal(getOAuthConfiguration('google'), null);

  configureGoogle();
  process.env.GOOGLE_REDIRECT_URI = 'https://frontend.example.test/api/auth/oauth/google/callback';
  assert.match(getOAuthConfigurationIssue('google'), /GOOGLE_REDIRECT_URI must use the configured BACKEND_URL origin/);
  assert.equal(getOAuthConfiguration('google'), null);
});

test('Google code exchange validates the signed identity token and nonce', async (context) => {
  configureGoogle();
  const configuration = getOAuthConfiguration('google');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: 'google-test-key',
    use: 'sig',
    kty: 'RSA',
    alg: 'RS256',
  };
  const originalFetch = global.fetch;
  let submittedForm;
  global.fetch = async (input, init = {}) => {
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      submittedForm = new URLSearchParams(init.body);
      return new Response(JSON.stringify({
        id_token: createGoogleIdToken(privateKey),
        access_token: 'server-only-access-token',
        scope: 'openid profile email',
      }), { status: 200 });
    }
    if (String(input) === 'https://www.googleapis.com/oauth2/v3/certs') {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }
    throw new Error('Unexpected OAuth endpoint');
  };
  context.after(() => { global.fetch = originalFetch; });

  const result = await exchangeAuthorizationCode(
    'google',
    configuration,
    'authorization-code',
    'google-verifier',
    'google-test-nonce',
  );
  assert.equal(result.claims.sub, 'google-subject-1');
  assert.equal(result.claims.email_verified, true);
  assert.equal(result.accessToken, 'server-only-access-token');
  assert.equal(submittedForm.get('client_id'), 'test-google-client');
  assert.equal(submittedForm.get('client_secret'), 'test-google-secret');
  assert.equal(submittedForm.get('code_verifier'), 'google-verifier');
});
