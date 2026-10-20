const assert = require('node:assert/strict');
const test = require('node:test');
const File = require('../dist/models/File').default;
const { readLinkedInMediaAsset, SocialMediaValidationError } = require('../dist/services/socialMedia');

const originalFindOne = File.findOne;

test.afterEach(() => {
  File.findOne = originalFindOne;
});

test('social media file lookup is workspace scoped and honors academic file sharing', async () => {
  let filter;
  File.findOne = (query) => {
    filter = query;
    return { select: async () => null };
  };

  await assert.rejects(
    readLinkedInMediaAsset('file-id', 'workspace-id', {
      userId: 'teacher-id',
      role: 'teacher',
      organizationType: 'school',
    }),
    SocialMediaValidationError,
  );
  assert.equal(filter.companyId, 'workspace-id');
  assert.deepEqual(filter.$or, [
    { uploaderId: 'teacher-id' },
    { sharedWith: { $elemMatch: { userId: 'teacher-id', permission: { $in: ['view', 'edit'] } } } },
  ]);
});

test('LinkedIn media asset validation rejects unsupported media before reading storage', async () => {
  File.findOne = () => ({
    select: async () => ({
      name: 'archive.pdf',
      originalName: 'archive.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: '/uploads/archive.pdf',
      storageProvider: 'local',
    }),
  });

  await assert.rejects(
    readLinkedInMediaAsset('file-id', 'workspace-id'),
    /JPEG or PNG images up to 36 MB and MP4 videos up to 50 MB/,
  );
});
