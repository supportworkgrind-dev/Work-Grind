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
const {
  completeOnboarding,
  createCompany,
  saveOnboardingProgress,
  saveWorkspaceSelection,
} = require('../dist/controllers/auth.controller');
const authRouter = require('../dist/routes/auth').default;

const originalMethods = {
  userFindById: User.findById,
  userFindOneAndUpdate: User.findOneAndUpdate,
  userUpdateOne: User.updateOne,
  companyCreate: Company.create,
  companyFindById: Company.findById,
  companyFindOne: Company.findOne,
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
  User.findOneAndUpdate = originalMethods.userFindOneAndUpdate;
  User.updateOne = originalMethods.userUpdateOne;
  Company.create = originalMethods.companyCreate;
  Company.findById = originalMethods.companyFindById;
  Company.findOne = originalMethods.companyFindOne;
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

test('workspace selection and onboarding routes require authentication', () => {
  for (const path of ['/workspace-selection', '/onboarding/progress', '/onboarding/complete']) {
    const routeLayer = authRouter.stack.find((layer) => layer.route?.path === path);
    assert.ok(routeLayer, `${path} route should exist`);
    assert.equal(routeLayer.route.stack[0].handle, authenticate);
  }
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
  User.findOneAndUpdate = async (filter, update) => {
    assert.equal(String(filter._id), userId.toString());
    assert.deepEqual(filter.companyId, { $in: [null] });
    assert.ok(update.$set.workspaceCreationLock);
    return authenticatedOwner;
  };
  User.updateOne = async (filter, update) => {
    assert.equal(String(filter._id), userId.toString());
    assert.ok(filter.workspaceCreationLock);
    assert.ok(update.$unset.workspaceCreationLock);
    return { acknowledged: true };
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
      organizationDetails: { schoolType: 'combined', gradeRange: 'mixed' },
    },
    ip: '127.0.0.1',
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdCompany.ownerId, userId.toString());
  assert.equal(authenticatedOwner.companyId, companyId);
  assert.equal(authenticatedOwner.role, 'owner');
  assert.equal(authenticatedOwner.onboardingStatus, 'pending');
  assert.equal(authenticatedOwner.onboardingStep, 1);
  assert.equal(res.body.user._id, userId);
  assert.equal(res.body.company.ownerId, userId.toString());
  assert.deepEqual(createdCompany.organizationDetails, { schoolType: 'combined', gradeRange: 'mixed' });
  assert.ok(res.body.accessToken);
  assert.equal(res.cookies.length, 1);
});

test('workspace selection persists only valid account choices for the authenticated user', async (context) => {
  const userId = new mongoose.Types.ObjectId();
  const savedUser = { accountType: 'company', signupOrganizationType: 'university' };
  let filter;
  let update;
  User.findOneAndUpdate = (query, updateDoc) => {
    filter = query;
    update = updateDoc;
    return { select: async () => savedUser };
  };
  context.after(() => {
    User.findOneAndUpdate = originalMethods.userFindOneAndUpdate;
  });

  const response = makeResponse();
  await saveWorkspaceSelection({
    user: { userId: userId.toString(), companyId: '' },
    body: { accountType: 'company', organizationType: 'university' },
  }, response);

  assert.equal(String(filter._id), userId.toString());
  assert.deepEqual(filter.companyId, { $in: [null] });
  assert.deepEqual(update.$set, { accountType: 'company', signupOrganizationType: 'university' });
  assert.equal(response.body.success, true);
  assert.equal(response.body.organizationType, 'university');
});

test('workspace selection rejects unsupported account and organization combinations', async () => {
  let updates = 0;
  User.findOneAndUpdate = () => { updates += 1; };
  const response = makeResponse();

  await saveWorkspaceSelection({
    user: { userId: new mongoose.Types.ObjectId().toString(), companyId: '' },
    body: { accountType: 'individual', organizationType: 'school' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(updates, 0);
});

test('workspace setup claim prevents concurrent duplicate workspace creation', async () => {
  const userId = new mongoose.Types.ObjectId();
  const user = {
    _id: userId,
    fullName: 'Workspace Owner',
    accountType: 'company',
    signupOrganizationType: 'business',
    companyId: null,
    save: async () => {},
  };
  let workspaceCreations = 0;
  User.findById = async () => user;
  User.findOneAndUpdate = async () => null;
  Company.create = async () => {
    workspaceCreations += 1;
    return {};
  };

  const response = makeResponse();
  await createCompany({
    user: { userId: userId.toString(), companyId: '', role: 'owner' },
    body: { name: 'Acme', accountType: 'company', organizationType: 'business' },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'WORKSPACE_SETUP_IN_PROGRESS');
  assert.equal(workspaceCreations, 0);
});

test('repeated create-company submission returns the existing authenticated workspace', async () => {
  const userId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const user = {
    _id: userId,
    companyId,
    role: 'owner',
    accountType: 'company',
    refreshTokens: [],
    save: async () => {},
  };
  const company = { _id: companyId, ownerId: userId, accountType: 'company', organizationType: 'business' };
  let workspaceCreations = 0;
  User.findById = async () => user;
  Company.findById = async (id) => String(id) === companyId.toString() ? company : null;
  Company.create = async () => {
    workspaceCreations += 1;
    return company;
  };

  const response = makeResponse();
  await createCompany({
    user: { userId: userId.toString(), companyId: companyId.toString(), role: 'owner' },
    body: { name: 'Acme', accountType: 'company', organizationType: 'business' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.company, company);
  assert.equal(workspaceCreations, 0);
});

test('only the verified workspace owner may persist onboarding progress or completion', async () => {
  const userId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  Company.findOne = () => ({ select: async () => null });
  let updates = 0;
  User.findOneAndUpdate = () => { updates += 1; };
  User.updateOne = () => { updates += 1; };

  const progressResponse = makeResponse();
  await saveOnboardingProgress({
    user: { userId: userId.toString(), companyId: companyId.toString() },
    body: { step: 2 },
  }, progressResponse);
  const completionResponse = makeResponse();
  await completeOnboarding({
    user: { userId: userId.toString(), companyId: companyId.toString() },
    body: {},
  }, completionResponse);

  assert.equal(progressResponse.statusCode, 403);
  assert.equal(completionResponse.statusCode, 403);
  assert.equal(updates, 0);
});
