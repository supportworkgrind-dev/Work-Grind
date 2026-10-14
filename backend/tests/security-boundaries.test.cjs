const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Channel = require('../dist/models/Channel').default;
const Message = require('../dist/models/Message').default;
const File = require('../dist/models/File').default;
const { getChannel, getMessages } = require('../dist/controllers/channel.controller');
const { deleteFile, downloadFile } = require('../dist/controllers/file.controller');

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
