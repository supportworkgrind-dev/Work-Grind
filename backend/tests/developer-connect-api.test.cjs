const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { CrmContact } = require('../dist/models/CrmContact');
const { DeveloperApiRequestLog } = require('../dist/models/DeveloperAccess');
const { listConnectResource, serializeConnectResource } = require('../dist/controllers/connectApi.controller');
const { listApiRequestLogs } = require('../dist/controllers/developer.controller');

const originals = {
  contactFind: CrmContact.find,
  contactCountDocuments: CrmContact.countDocuments,
  logFind: DeveloperApiRequestLog.find,
  logCountDocuments: DeveloperApiRequestLog.countDocuments,
};

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function query(value) {
  return {
    sortValue: undefined,
    skipValue: undefined,
    limitValue: undefined,
    sort(sort) { this.sortValue = sort; return this; },
    skip(skip) { this.skipValue = skip; return this; },
    limit(limit) { this.limitValue = limit; return this; },
    populate() { return this; },
    lean: async () => value,
  };
}

test.afterEach(() => {
  CrmContact.find = originals.contactFind;
  CrmContact.countDocuments = originals.contactCountDocuments;
  DeveloperApiRequestLog.find = originals.logFind;
  DeveloperApiRequestLog.countDocuments = originals.logCountDocuments;
});

test('Connect API response DTOs omit unrelated and sensitive stored fields', () => {
  const result = serializeConnectResource('tasks', {
    _id: 'task-id',
    companyId: 'workspace-id',
    title: 'Prepare release',
    comments: [{ content: 'private comment' }],
    timeEntries: [{ userId: 'employee-id' }],
    attachments: [{ url: 'private-file-url' }],
    customFields: [{ key: 'internal', value: 'private' }],
    dependencyIds: ['private-dependency-id'],
    password: 'password-hash',
    refreshTokens: ['refresh-token'],
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });

  assert.equal(result.id, 'task-id');
  assert.equal(result._id, 'task-id');
  assert.equal(result.companyId, 'workspace-id');
  assert.equal(result.title, 'Prepare release');
  for (const excluded of ['comments', 'timeEntries', 'attachments', 'customFields', 'dependencyIds', 'password', 'refreshTokens']) {
    assert.equal(Object.hasOwn(result, excluded), false, `${excluded} should not be exposed`);
  }
});

test('team Connect API DTO does not return authentication or recovery data', () => {
  const result = serializeConnectResource('team', {
    _id: 'user-id',
    fullName: 'Team Member',
    email: 'member@example.test',
    role: 'member',
    password: 'password-hash',
    resetPasswordToken: 'reset-token',
    emailVerificationToken: 'verification-token',
    mfaSecret: 'mfa-secret',
    recoveryCodes: ['recovery-code'],
    refreshTokens: ['refresh-token'],
  });

  assert.equal(result.id, 'user-id');
  assert.equal(result.fullName, 'Team Member');
  for (const excluded of ['password', 'resetPasswordToken', 'emailVerificationToken', 'mfaSecret', 'recoveryCodes', 'refreshTokens']) {
    assert.equal(Object.hasOwn(result, excluded), false, `${excluded} should not be exposed`);
  }
});

test('Connect API list caps page size, sorts stably, filters by workspace, and returns safe fields', async () => {
  const companyId = new mongoose.Types.ObjectId();
  let findFilter;
  let findProjection;
  let listQuery;
  CrmContact.find = (filter, projection) => {
    findFilter = filter;
    findProjection = projection;
    listQuery = query([{
      _id: 'contact-id',
      companyId,
      firstName: 'Alex',
      lastName: 'Example',
      password: 'not-public',
      ownerId: 'owner-id',
      dealIds: ['deal-id'],
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    }]);
    return listQuery;
  };
  CrmContact.countDocuments = async () => 250;

  const res = response();
  await listConnectResource({
    params: { resource: 'contacts' },
    query: { page: '3', limit: '1000', q: 'Alex' },
    connectApiKey: { companyId, scopes: ['contacts:read'] },
  }, res);

  assert.equal(findFilter.companyId, companyId);
  assert.ok(findFilter.$or.some((item) => item.firstName));
  assert.ok(!findProjection.includes('password'));
  assert.deepEqual(listQuery.sortValue, { createdAt: -1, _id: -1 });
  assert.equal(listQuery.skipValue, 200);
  assert.equal(listQuery.limitValue, 100);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.pagination, { page: 3, limit: 100, total: 250, pages: 3, totalPages: 3 });
  assert.equal(res.body.data[0].firstName, 'Alex');
  assert.equal(Object.hasOwn(res.body.data[0], 'ownerId'), false);
  assert.equal(Object.hasOwn(res.body.data[0], 'dealIds'), false);
  assert.equal(Object.hasOwn(res.body.data[0], 'password'), false);
});

test('Connect API rejects malformed and excessively deep pagination before querying', async () => {
  let queried = false;
  CrmContact.find = () => { queried = true; throw new Error('unexpected query'); };
  CrmContact.countDocuments = async () => { queried = true; return 0; };

  const res = response();
  await listConnectResource({
    params: { resource: 'contacts' },
    query: { page: '2000', limit: '100' },
    connectApiKey: { companyId: new mongoose.Types.ObjectId(), scopes: ['contacts:read'] },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_PAGINATION');
  assert.equal(queried, false);
});

test('developer request logs support tenant-scoped key/status filters and bounded pagination', async () => {
  const companyId = new mongoose.Types.ObjectId().toString();
  const keyId = new mongoose.Types.ObjectId().toString();
  let logFilter;
  let logQuery;
  DeveloperApiRequestLog.find = (filter) => {
    logFilter = filter;
    logQuery = query([{
      _id: 'log-id',
      apiKeyId: { name: 'Production key' },
      method: 'GET',
      path: 'contacts',
      statusCode: 403,
      durationMs: 12,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    }]);
    return logQuery;
  };
  DeveloperApiRequestLog.countDocuments = async () => 101;

  const res = response();
  await listApiRequestLogs({
    query: { page: '2', limit: '500', status: 'errors', keyId },
    user: { companyId, userId: new mongoose.Types.ObjectId().toString() },
  }, res);

  assert.equal(logFilter.companyId.toString(), companyId);
  assert.deepEqual(logFilter.statusCode, { $gte: 400 });
  assert.equal(logFilter.apiKeyId, keyId);
  assert.equal(logQuery.skipValue, 100);
  assert.equal(logQuery.limitValue, 100);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 100, total: 101, pages: 2, totalPages: 2 });
  assert.equal(res.body.data[0].keyName, 'Production key');
});

test('developer request logs reject malformed filters and deep pages without querying', async () => {
  let queried = false;
  DeveloperApiRequestLog.find = () => { queried = true; throw new Error('unexpected query'); };
  DeveloperApiRequestLog.countDocuments = async () => { queried = true; return 0; };

  const res = response();
  await listApiRequestLogs({
    query: { page: '3000', limit: '50', status: 'unknown' },
    user: { companyId: new mongoose.Types.ObjectId().toString(), userId: new mongoose.Types.ObjectId().toString() },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(queried, false);
});

test('developer request logs reject unsupported status and malformed key filters', async () => {
  let queried = false;
  DeveloperApiRequestLog.find = () => { queried = true; throw new Error('unexpected query'); };
  DeveloperApiRequestLog.countDocuments = async () => { queried = true; return 0; };
  const user = { companyId: new mongoose.Types.ObjectId().toString(), userId: new mongoose.Types.ObjectId().toString() };

  const invalidStatus = response();
  await listApiRequestLogs({ query: { status: 'pending' }, user }, invalidStatus);
  assert.equal(invalidStatus.statusCode, 400);
  assert.equal(queried, false);

  const invalidKeyId = response();
  await listApiRequestLogs({ query: { keyId: 'not-an-object-id' }, user }, invalidKeyId);
  assert.equal(invalidKeyId.statusCode, 400);
  assert.equal(queried, false);
});
