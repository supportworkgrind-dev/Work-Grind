const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLinkedInApiVersion,
  LinkedInApiError,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  publishLinkedInTextPost,
} = require('../dist/services/linkedinPublishing');

test('LinkedIn text publisher sends only supported member-post fields and API headers', async (context) => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, {
      status: 201,
      headers: { 'x-restli-id': 'urn:li:share:123456' },
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
