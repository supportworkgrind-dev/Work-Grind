const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Channel = require('../dist/models/Channel').default;
const Message = require('../dist/models/Message').default;
const File = require('../dist/models/File').default;
const Integration = require('../dist/models/Integration').default;
const { getChannel, getMessages } = require('../dist/controllers/channel.controller');
const { deleteFile, downloadFile } = require('../dist/controllers/file.controller');
const { receiveWebhook } = require('../dist/controllers/integration.controller');
const { encryptProviderToken } = require('../dist/utils/providerTokenEncryption');
const { fileContentMatches } = require('../dist/middleware/upload');
const { RedisRateLimitStore } = require('../dist/middleware/rateLimiter');
const { capturePolarWebhookRawBody } = require('../dist/middleware/capturePolarWebhookBody');

const companyId = new mongoose.Types.ObjectId().toString();
const otherCompanyId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId().toString();
const privateChannelId = new mongoose.Types.ObjectId().toString();
const fileId = new mongoose.Types.ObjectId().toString();
const foreignChannel = { id: new mongoose.Types.ObjectId().toString(), companyId: otherCompanyId };
const foreignFile = { id: new mongoose.Types.ObjectId().toString(), companyId: otherCompanyId };

const originalChannelFindOne = Channel.findOne;
const originalMessageCountDocuments = Message.countDocuments;
const originalMessageFind = Message.find;
const originalFileFindOne = File.findOne;
const originalIntegrationFindOne = Integration.findOne;
const originalIntegrationUpdateOne = Integration.updateOne;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test.afterEach(() => {
  Channel.findOne = originalChannelFindOne;
  Message.countDocuments = originalMessageCountDocuments;
  Message.find = originalMessageFind;
  File.findOne = originalFileFindOne;
  Integration.findOne = originalIntegrationFindOne;
  Integration.updateOne = originalIntegrationUpdateOne;
});

test('private channel details require workspace membership', async () => {
  let filter;
  Channel.findOne = (query) => {
    filter = query;
    return {
      populate() { return this; },
      then(resolve, reject) { return Promise.resolve(null).then(resolve, reject); },
    };
  };

  const res = response();
  await getChannel({
    params: { id: privateChannelId },
    user: { companyId, userId, role: 'employee' },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(filter.companyId, companyId);
  assert.equal(filter.isArchived, false);
  assert.deepEqual(filter.$or, [{ type: 'public' }, { members: userId }]);
});

test('channel lookup scopes a foreign-workspace ID to the caller workspace', async () => {
  let filter;
  Channel.findOne = (query) => {
    filter = query;
    return {
      populate() { return this; },
      then(resolve, reject) { return Promise.resolve(null).then(resolve, reject); },
    };
  };

  const res = response();
  await getChannel({
    params: { id: foreignChannel.id },
    user: { companyId, userId, role: 'employee' },
  }, res);

  assert.equal(foreignChannel.companyId, otherCompanyId);
  assert.notEqual(companyId, foreignChannel.companyId);
  assert.equal(res.statusCode, 404);
  assert.equal(filter._id, foreignChannel.id);
  assert.equal(filter.companyId, companyId);
});

test('message history requires a visible channel before querying messages', async () => {
  let filter;
  let queriedMessages = false;
  Channel.findOne = (query) => {
    filter = query;
    return { select: () => ({ lean: async () => null }) };
  };
  Message.countDocuments = () => { queriedMessages = true; };
  Message.find = () => { queriedMessages = true; };

  const res = response();
  await getMessages({
    query: { channelId: privateChannelId },
    user: { companyId, userId, role: 'employee' },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(filter.$or, [{ type: 'public' }, { members: userId }]);
  assert.equal(queriedMessages, false);
});

test('message history cannot be listed without a valid channel id', async () => {
  let lookedUpChannel = false;
  Channel.findOne = () => { lookedUpChannel = true; };

  const res = response();
  await getMessages({
    query: {},
    user: { companyId, userId, role: 'employee' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(lookedUpChannel, false);
});

test('academic file deletion checks edit sharing, not view sharing', async () => {
  let filter;
  File.findOne = async (query) => {
    filter = query;
    return null;
  };

  const res = response();
  await deleteFile({
    params: { id: fileId },
    user: { companyId, userId, role: 'student', organizationType: 'school' },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(filter.companyId, companyId);
  assert.equal(filter.$and.length, 1);
  assert.deepEqual(filter.$and[0].$or, [
    { uploaderId: userId },
    { sharedWith: { $elemMatch: { userId, permission: 'edit' } } },
  ]);
});

test('academic file downloads enforce the uploader-or-shared-view scope', async () => {
  let filter;
  File.findOne = async (query) => {
    filter = query;
    return null;
  };

  const res = response();
  await downloadFile({
    params: { id: fileId },
    user: { companyId, userId, role: 'student', organizationType: 'school' },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(filter.$or, [
    { uploaderId: userId },
    {
      sharedWith: {
        $elemMatch: { userId, permission: { $in: ['view', 'edit'] } },
      },
    },
  ]);
});

test('file download scopes a foreign-workspace ID to the caller workspace', async () => {
  let filter;
  File.findOne = async (query) => {
    filter = query;
    return null;
  };

  const res = response();
  await downloadFile({
    params: { id: foreignFile.id },
    user: { companyId, userId, role: 'student', organizationType: 'school' },
  }, res);

  assert.equal(foreignFile.companyId, otherCompanyId);
  assert.notEqual(companyId, foreignFile.companyId);
  assert.equal(res.statusCode, 404);
  assert.equal(filter._id, foreignFile.id);
  assert.equal(filter.companyId, companyId);
});

test('inbound integration webhooks reject missing HMAC signatures', async () => {
  Integration.findOne = () => ({
    select() { return this; },
    lean: async () => ({
      _id: new mongoose.Types.ObjectId(),
      status: 'connected',
      webhookSecret: 'encrypted-secret',
      companyId,
    }),
  });

  const res = response();
  await receiveWebhook({
    params: { token: 'synthetic-webhook-token' },
    headers: {},
    body: { event: 'test' },
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Webhook signature required');
});

test('inbound integration webhooks reject invalid HMAC signatures', async () => {
  const previousEncryptionKey = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = 'security-boundary-test-key';
  Integration.findOne = () => ({
    select() { return this; },
    lean: async () => ({
      _id: new mongoose.Types.ObjectId(),
      status: 'connected',
      webhookSecret: encryptProviderToken('synthetic-webhook-secret'),
      companyId,
    }),
  });

  const res = response();
  try {
    await receiveWebhook({
      params: { token: 'synthetic-webhook-token' },
      headers: { 'x-webhook-signature': 'sha256=invalid' },
      body: { event: 'test' },
    }, res);
  } finally {
    if (previousEncryptionKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previousEncryptionKey;
  }
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid webhook signature');
});

test('file upload content validation rejects mismatched or spoofed file types', () => {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  assert.equal(fileContentMatches(pngSignature, 'image/png', '.png'), true);
  assert.equal(fileContentMatches(pngSignature, 'image/jpeg', '.jpg'), false);
  assert.equal(fileContentMatches(Buffer.from('not a PDF'), 'application/pdf', '.pdf'), false);
  assert.equal(fileContentMatches(Buffer.from('%PDF-1.7'), 'application/pdf', '.pdf'), true);
});

test('Redis rate-limit stores share prefixed counters with an atomic expiry', async () => {
  const calls = [];
  const redis = {
    eval: async (...args) => {
      calls.push(args);
      return [1, 60_000];
    },
  };
  const store = new RedisRateLimitStore(redis, 60_000, 'workgrind:rate-limit:test');

  const result = await store.increment('client-key');

  assert.equal(result.totalHits, 1);
  assert.ok(result.resetTime.getTime() > Date.now());
  assert.match(calls[0][0], /PEXPIRE/);
  assert.deepEqual(calls[0][1], ['workgrind:rate-limit:test:client-key']);
  assert.deepEqual(calls[0][2], ['60000']);
});

test('Polar raw-body capture preserves exact webhook bytes only for its endpoint', () => {
  const rawBody = Buffer.from('{ "type": "subscription.created" }');
  const webhookRequest = { url: '/api/subscription/webhook?source=test' };
  const otherRequest = { url: '/api/subscription/status' };

  capturePolarWebhookRawBody(webhookRequest, {}, rawBody);
  capturePolarWebhookRawBody(otherRequest, {}, rawBody);

  assert.deepEqual(webhookRequest.rawBody, rawBody);
  assert.equal(otherRequest.rawBody, undefined);
});
