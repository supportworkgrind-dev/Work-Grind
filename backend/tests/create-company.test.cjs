const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const test = require('node:test');

process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const User = require('../dist/models/User').default;
const Company = require('../dist/models/Company').default;
const Channel = require('../dist/models/Channel').default;
const Project = require('../dist/models/Project').default;
const Task = require('../dist/models/Task').default;
const Message = require('../dist/models/Message').default;
const AuditLog = require('../dist/models/AuditLog').default;
const { authenticate } = require('../dist/middleware/auth');
const { createCompany } = require('../dist/controllers/auth.controller');
const authRouter = require('../dist/routes/auth').default;

const originalMethods = {
  userFindById: User.findById,
  companyCreate: Company.create,
  channelInsertMany: Channel.insertMany,
  projectCreate: Project.create,
  taskCreate: Task.create,
  messageCreate: Message.create,
  auditLogCreate: AuditLog.create,
};

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); },
  };
}

test.afterEach(() => {
  User.findById = originalMethods.userFindById;
  Company.create = originalMethods.companyCreate;
  Channel.insertMany = originalMethods.channelInsertMany;
  Project.create = originalMethods.projectCreate;
  Task.create = originalMethods.taskCreate;
  Message.create = originalMethods.messageCreate;
  AuditLog.create = originalMethods.auditLogCreate;
});

test('create-company route is protected by the standard authentication middleware', () => {
  const routeLayer = authRouter.stack.find((layer) => layer.route?.path === '/create-company');
  assert.ok(routeLayer);
  assert.equal(routeLayer.route.stack[0].handle, authenticate);
});

test('create-company rejects requests without a bearer token', async () => {
  const res = makeResponse();
  let nextCalled = false;

  await authenticate({
    method: 'POST',
    path: '/create-company',
    originalUrl: '/api/auth/create-company',
    headers: {},
  }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'No token provided');
  assert.equal(nextCalled, false);
});

test('create-company rejects invalid access tokens', async () => {
  const res = makeResponse();
  let nextCalled = false;

  await authenticate({
    method: 'POST',
    path: '/create-company',
    originalUrl: '/api/auth/create-company',
    headers: { authorization: 'Bearer invalid-access-token' },
  }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid or expired token');
  assert.equal(nextCalled, false);
});

test('created workspace ownership and membership belong only to the authenticated user', async () => {
  const userId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const authenticatedOwner = {
    _id: userId,
    fullName: 'School Owner',
    email: 'school-owner@example.test',
    role: 'owner',
    accountType: 'company',
    signupOrganizationType: 'school',
    companyId: null,
    refreshTokens: [],
    createdAt: new Date(),
    trialStartDate: new Date(),
    trialEndDate: new Date(Date.now() + 7 * 86400000),
    save: async () => {},
  };
  let createdCompany;
  User.findById = async (id) => {
    assert.equal(String(id), userId.toString());
    return authenticatedOwner;
  };
  Company.create = async (company) => {
    createdCompany = { ...company, _id: companyId };
    return createdCompany;
  };
  Channel.insertMany = async (channels) => channels.map((channel) => ({
    ...channel,
    _id: new mongoose.Types.ObjectId(),
  }));
  Project.create = async (project) => ({ ...project, _id: new mongoose.Types.ObjectId() });
  Task.create = async () => [];
  Message.create = async () => ({});
  AuditLog.create = async () => ({});

  const res = makeResponse();
  await createCompany({
    user: {
      userId: userId.toString(),
      companyId: '',
      role: 'owner',
    },
    body: {
      name: 'North School',
      accountType: 'company',
      organizationType: 'school',
    },
    ip: '127.0.0.1',
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdCompany.ownerId, userId.toString());
  assert.equal(authenticatedOwner.companyId, companyId);
  assert.equal(authenticatedOwner.role, 'owner');
  assert.equal(res.body.user._id, userId);
  assert.equal(res.body.company.ownerId, userId.toString());
  assert.ok(res.body.accessToken);
  assert.equal(res.cookies.length, 1);
});
