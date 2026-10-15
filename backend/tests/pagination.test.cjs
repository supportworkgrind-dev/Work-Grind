const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Conversation = require('../dist/models/Conversation').default;
const Message = require('../dist/models/Message').default;
const Notification = require('../dist/models/Notification').default;
const Project = require('../dist/models/Project').default;
const { getDMMessages } = require('../dist/controllers/directMessage.controller');
const { deleteNotification, markAsRead } = require('../dist/controllers/notification.controller');
const { getProjects } = require('../dist/controllers/project.controller');
const { parsePagination } = require('../dist/utils/pagination');

const originalProjectFind = Project.find;
const originalConversationFindOne = Conversation.findOne;
const originalMessageCountDocuments = Message.countDocuments;
const originalMessageFind = Message.find;
const originalNotificationFindOneAndUpdate = Notification.findOneAndUpdate;
const originalNotificationFindOneAndDelete = Notification.findOneAndDelete;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test.afterEach(() => {
  Project.find = originalProjectFind;
  Conversation.findOne = originalConversationFindOne;
  Message.countDocuments = originalMessageCountDocuments;
  Message.find = originalMessageFind;
  Notification.findOneAndUpdate = originalNotificationFindOneAndUpdate;
  Notification.findOneAndDelete = originalNotificationFindOneAndDelete;
});

test('pagination rejects malformed, zero, negative, and excessively deep page values', () => {
  const options = { defaultLimit: 50, maxLimit: 100, maxSkip: 1_000 };
  for (const value of ['0', '-1', 'abc', 'all', '1.5', ['2', '3']]) {
    assert.equal(parsePagination({ limit: value }, options), null, `limit ${JSON.stringify(value)}`);
  }
  assert.equal(parsePagination({ page: '0' }, options), null);
  assert.equal(parsePagination({ page: 'abc' }, options), null);
  assert.equal(parsePagination({ page: '1002', limit: '1' }, options), null);
});

test('pagination applies defaults and caps oversized limits', () => {
  assert.deepEqual(parsePagination({}, { defaultLimit: 50, maxLimit: 100 }), {
    page: 1,
    limit: 50,
    skip: 0,
  });
  assert.deepEqual(parsePagination({ page: '3', limit: '5000' }, { defaultLimit: 50, maxLimit: 100 }), {
    page: 3,
    limit: 100,
    skip: 200,
  });
});

test('project listing remains tenant and role scoped and reports a bounded next page', async () => {
  const companyId = 'tenant-a';
  let queryFilter;
  let querySkip;
  let queryLimit;
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

  Project.find = (filter) => {
    queryFilter = filter;
    const query = {
      populate() { return this; },
      sort() { return this; },
      skip(value) { querySkip = value; return this; },
      limit(value) { queryLimit = value; return this; },
      lean: async () => rows,
    };
    return query;
  };

  const res = response();
  await getProjects({
    query: { page: '2', limit: '2' },
    user: { companyId, userId: 'member-a', role: 'employee' },
  }, res);

  assert.equal(queryFilter.companyId, companyId);
  assert.equal(queryFilter.isArchived, false);
  assert.deepEqual(queryFilter.$or, [
    { 'members.userId': 'member-a' },
    { assigneeId: 'member-a' },
    { managerId: 'member-a' },
  ]);
  assert.equal(querySkip, 2);
  assert.equal(queryLimit, 3);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, projects: rows.slice(0, 2), page: 2, hasMore: true });
});

test('project listing rejects limit=all instead of allowing an unbounded query', async () => {
  let queried = false;
  Project.find = () => { queried = true; throw new Error('should not query'); };

  const res = response();
  await getProjects({
    query: { limit: 'all' },
    user: { companyId: 'tenant-a', userId: 'member-a', role: 'owner' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(queried, false);
});

test('direct-message pagination rejects unlimited limits before querying the conversation', async () => {
  let queried = false;
  Conversation.findOne = () => { queried = true; };

  const res = response();
  await getDMMessages({
    params: { conversationId: new mongoose.Types.ObjectId().toString() },
    query: { limit: 'all' },
    user: { companyId: new mongoose.Types.ObjectId().toString(), userId: new mongoose.Types.ObjectId().toString() },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(queried, false);
});

test('direct-message pagination preserves total count and hasMore at page boundaries', async () => {
  const conversationId = new mongoose.Types.ObjectId().toString();
  const companyId = new mongoose.Types.ObjectId().toString();
  let querySkip;
  let queryLimit;
  Conversation.findOne = async () => ({ companyId: new mongoose.Types.ObjectId(companyId) });
  Message.countDocuments = async () => 5;
  Message.find = () => {
    const query = {
      populate() { return this; },
      sort() { return this; },
      skip(value) { querySkip = value; return this; },
      limit(value) {
        queryLimit = value;
        return Promise.resolve([
          { toObject: () => ({ id: 'newest' }) },
          { toObject: () => ({ id: 'middle' }) },
          { toObject: () => ({ id: 'lookahead' }) },
        ]);
      },
    };
    return query;
  };

  const res = response();
  await getDMMessages({
    params: { conversationId },
    query: { page: '2', limit: '2' },
    user: { companyId, userId: new mongoose.Types.ObjectId().toString() },
  }, res);

  assert.equal(querySkip, 2);
  assert.equal(queryLimit, 3);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, 5);
  assert.equal(res.body.page, 2);
  assert.equal(res.body.hasMore, true);
  assert.deepEqual(res.body.messages, [{ id: 'middle' }, { id: 'newest' }]);
});

test('notification mutations retain the authenticated workspace constraint', async () => {
  const companyId = 'tenant-a';
  const userId = 'member-a';
  let updateFilter;
  let deleteFilter;
  Notification.findOneAndUpdate = async (filter) => {
    updateFilter = filter;
    return null;
  };
  Notification.findOneAndDelete = async (filter) => {
    deleteFilter = filter;
    return null;
  };

  const request = {
    params: { id: 'notification-a' },
    user: { companyId, userId },
  };
  await markAsRead(request, response());
  await deleteNotification(request, response());

  assert.deepEqual(updateFilter, { _id: 'notification-a', userId, companyId });
  assert.deepEqual(deleteFilter, { _id: 'notification-a', userId, companyId });
});
