const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLinkedInApiVersion,
  LinkedInApiError,
  LINKEDIN_MAX_IMAGE_BYTES,
  LINKEDIN_MAX_VIDEO_BYTES,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  publishLinkedInPost,
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

test('LinkedIn image publishing initializes, uploads, verifies processing, then creates a post', async (context) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/images?action=initializeUpload')) {
      return Response.json({ value: { uploadUrl: 'https://www.linkedin.com/dms-uploads/upload-image', image: 'urn:li:image:img123' } }, { status: 200 });
    }
    if (url === 'https://www.linkedin.com/dms-uploads/upload-image') return new Response(null, { status: 201 });
    if (url.includes('/images/')) return Response.json({ status: 'AVAILABLE' }, { status: 200 });
    return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:image-post-1' } });
  };
  context.after(() => { global.fetch = originalFetch; });

  const result = await publishLinkedInPost(
    'access-token',
    'member-42',
    'Image post',
    { buffer: Buffer.from('image'), mimeType: 'image/png', title: 'Campaign image' },
  );

  assert.deepEqual(result, { postUrn: 'urn:li:share:image-post-1' });
  assert.equal(requests.length, 4);
  const initialization = JSON.parse(requests[0].options.body);
  assert.deepEqual(initialization.initializeUploadRequest, { owner: 'urn:li:person:member-42' });
  assert.equal(requests[1].options.method, 'PUT');
  assert.equal(requests[1].options.headers.Authorization, undefined);
  assert.equal(requests[2].options.method, undefined);
  const postBody = JSON.parse(requests[3].options.body);
  assert.deepEqual(postBody.content, { media: { title: 'Campaign image', id: 'urn:li:image:img123' } });
  assert.equal(postBody.author, 'urn:li:person:member-42');
  assert.equal(LINKEDIN_MAX_IMAGE_BYTES, 36 * 1024 * 1024);
});

test('LinkedIn video publishing uploads verified byte ranges and finalizes before post creation', async (context) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/videos?action=initializeUpload')) {
      return Response.json({
        value: {
          video: 'urn:li:video:video123',
          uploadToken: '',
          uploadInstructions: [{ firstByte: 0, lastByte: 3, uploadUrl: 'https://www.linkedin.com/dms-uploads/video-part' }],
        },
      }, { status: 200 });
    }
    if (url === 'https://www.linkedin.com/dms-uploads/video-part') {
      return new Response(null, { status: 200, headers: { etag: '"part-etag"' } });
    }
    if (url.endsWith('/videos?action=finalizeUpload')) return new Response(null, { status: 200 });
    if (url.includes('/videos/')) return Response.json({ status: 'AVAILABLE' }, { status: 200 });
    return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:video-post-1' } });
  };
  context.after(() => { global.fetch = originalFetch; });

  const result = await publishLinkedInPost(
    'access-token',
    'member-42',
    'Video post',
    { buffer: Buffer.from('data'), mimeType: 'video/mp4', title: 'Product video' },
  );

  assert.deepEqual(result, { postUrn: 'urn:li:share:video-post-1' });
  assert.equal(requests.length, 5);
  const initialize = JSON.parse(requests[0].options.body);
  assert.deepEqual(initialize.initializeUploadRequest, {
    owner: 'urn:li:person:member-42',
    fileSizeBytes: 4,
    uploadCaptions: false,
    uploadThumbnail: false,
  });
  assert.equal(requests[1].options.headers['Content-Range'], 'bytes 0-3/4');
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    finalizeUploadRequest: {
      video: 'urn:li:video:video123',
      uploadToken: '',
      uploadedPartIds: ['part-etag'],
    },
  });
  const postBody = JSON.parse(requests[4].options.body);
  assert.deepEqual(postBody.content, { media: { title: 'Product video', id: 'urn:li:video:video123' } });
  assert.equal(LINKEDIN_MAX_VIDEO_BYTES, 50 * 1024 * 1024);
});

test('LinkedIn publishing refuses untrusted upload destinations and missing post identifiers', async (context) => {
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({
    value: { uploadUrl: 'https://attacker.invalid/upload', image: 'urn:li:image:img123' },
  }, { status: 200 });
  context.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    publishLinkedInPost('access-token', 'member-42', 'Image post', {
      buffer: Buffer.from('image'),
      mimeType: 'image/png',
      title: 'Image',
    }),
    /untrusted upload destination/,
  );

  global.fetch = async () => new Response(null, { status: 201 });
  await assert.rejects(
    publishLinkedInPost('access-token', 'member-42', 'Text post'),
    /valid post identifier/,
  );
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
    publishMedia: true,
    schedule: true,
    analytics: false,
    organizationPublishing: false,
  });
  const unavailable = getSocialProviderCatalog().filter((provider) => provider.id !== 'linkedin');
  // Instagram and Facebook have no adapter (coming soon); YouTube needs its Google client configured.
  assert.deepEqual(
    Object.fromEntries(unavailable.map((provider) => [provider.id, provider.availability])),
    { instagram: 'coming_soon', facebook: 'coming_soon', youtube: 'setup_required' },
  );
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
