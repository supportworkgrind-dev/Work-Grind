const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLinkedInApiVersion,
  LinkedInApiError,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  publishLinkedInTextPost,
} = require('../dist/services/linkedinPublishing');
const {
  getSocialProviderAdapter,
  getSocialProviderCatalog,
} = require('../dist/services/socialProviders');

test('LinkedIn text publisher sends only supported member-post fields and API headers', async (context) => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, {
      status: 201,
      headers: {
        'x-restli-id': 'urn:li:share:123456',
        'content-type': 'application/json',
      },
    });
  };
  context.after(() => { global.fetch = originalFetch; });

  const result = await publishLinkedInTextPost('access-token', 'person-123', 'A professional update.');
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://api.linkedin.com/rest/posts');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer access-token');
  assert.equal(request.options.headers['LinkedIn-Version'], getLinkedInApiVersion());
  assert.equal(request.options.headers['X-Restli-Protocol-Version'], '2.0.0');
  assert.equal(body.author, 'urn:li:person:person-123');
  assert.equal(body.commentary, 'A professional update.');
  assert.equal(body.visibility, 'PUBLIC');
  assert.equal(body.lifecycleState, 'PUBLISHED');
  assert.deepEqual(result, { postUrn: 'urn:li:share:123456' });
  assert.equal(LINKEDIN_TEXT_POST_MAX_LENGTH, 3000);
});

test('LinkedIn post failures are surfaced without treating non-201 as published', async (context) => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('denied', { status: 403 });
  context.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    publishLinkedInTextPost('access-token', 'person-123', 'A post.'),
    (error) => error instanceof LinkedInApiError && error.status === 403,
  );
});

test('LinkedIn API version configuration accepts YYYYMM and rejects malformed values', () => {
  const previous = process.env.LINKEDIN_API_VERSION;
  process.env.LINKEDIN_API_VERSION = '202610';
  assert.equal(getLinkedInApiVersion(), '202610');
  process.env.LINKEDIN_API_VERSION = 'bad';
  assert.throws(() => getLinkedInApiVersion(), /YYYYMM/);
  if (previous === undefined) delete process.env.LINKEDIN_API_VERSION;
  else process.env.LINKEDIN_API_VERSION = previous;
});

test('provider catalog exposes only verified capabilities and leaves unconfigured platforms disabled', async (context) => {
  const linkedin = getSocialProviderCatalog().find((provider) => provider.id === 'linkedin');
  assert.equal(linkedin.availability, 'available');
  assert.deepEqual(linkedin.capabilities, {
    connect: true,
    publishText: true,
    publishMedia: false,
    schedule: true,
    analytics: false,
    organizationPublishing: false,
  });
  const unavailable = getSocialProviderCatalog().filter((provider) => provider.id !== 'linkedin');
  assert.deepEqual(unavailable.map((provider) => provider.availability), [
    'setup_required',
    'setup_required',
    'setup_required',
  ]);
  assert.ok(unavailable.every((provider) =>
    Object.values(provider.capabilities).every((supported) => supported === false)));

  const adapter = getSocialProviderAdapter('linkedin');
  assert.ok(adapter);
  assert.equal(adapter.validateText('  A post.  '), null);
  assert.match(adapter.validateText('  '), /1–3000/);
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(null, {
    status: 201,
    headers: { 'x-restli-id': 'urn:li:share:adapter-test' },
  });
  context.after(() => { global.fetch = originalFetch; });
  assert.deepEqual(
    await adapter.publishText('access-token', 'person-123', 'Adapter test.'),
    { externalPostId: 'urn:li:share:adapter-test' },
  );
  assert.equal(getSocialProviderAdapter('instagram'), null);
});
