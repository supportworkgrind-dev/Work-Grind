const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const test = require('node:test');

process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');

const User = require('../dist/models/User').default;
const Company = require('../dist/models/Company').default;
const companySubscription = require('../dist/services/companySubscription');
const { authenticate, requireEntitlement } = require('../dist/middleware/auth');
const { requireOrganizationFeature } = require('../dist/middleware/organizationAccess');
const { generateAccessToken } = require('../dist/utils/jwt');

const original = {
  userFindById: User.findById,
  companyFindOne: Company.findOne,
  getEffectiveSubscription: companySubscription.getEffectiveSubscription,
};

const userId = new mongoose.Types.ObjectId().toString();
const companyId = new mongoose.Types.ObjectId().toString();

function query(result) {
  return { select() { return this; }, lean: async () => result };
}

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeRequest() {
  const token = generateAccessToken({ userId, companyId, role: 'employee' });
  return {
    method: 'GET',
    path: '/active',
    originalUrl: '/api/meetings/active',
    headers: { authorization: `Bearer ${token}` },
  };
}

function mockWorkspace({ user = {}, company = {}, subscription = {} } = {}) {
  const calls = { user: 0, company: 0, subscription: 0 };
  User.findById = () => {
    calls.user += 1;
    return query({ _id: userId, companyId, role: 'employee', isVerified: true, isActive: true, isDeleted: false, accountType: 'company', ...user });
  };
  Company.findOne = () => {
    calls.company += 1;
    return query(company === null ? null : { _id: companyId, organizationType: 'business', accountType: 'company', ...company });
  };
  companySubscription.getEffectiveSubscription = async () => {
    calls.subscription += 1;
    return {
      source: 'company',
      status: 'active',
      plan: 'pro',
      companyId,
      hasActiveAccess: true,
      isLifetime: false,
      planConfig: { name: 'Pro', entitlements: { meetingsCalendar: true } },
      ...subscription,
    };
  };
  return calls;
}

async function runChain(req, res, middlewares) {
  for (const middleware of middlewares) {
    let advanced = false;
    await middleware(req, res, () => { advanced = true; });
    if (!advanced) return false;
  }
  return true;
}

test.afterEach(() => {
  User.findById = original.userFindById;
  Company.findOne = original.companyFindOne;
  companySubscription.getEffectiveSubscription = original.getEffectiveSubscription;
});

test('stacked meeting guards read the user, company and subscription once per request', async () => {
  const calls = mockWorkspace();
  const req = makeRequest();
  const res = makeResponse();

  const passed = await runChain(req, res, [
    authenticate,
    requireOrganizationFeature('educationMeetings'),
    requireEntitlement('meetingsCalendar'),
  ]);

  assert.equal(passed, true);
  assert.deepEqual(calls, { user: 1, company: 1, subscription: 1 });
  assert.equal(req.user.companyId, companyId);
  assert.equal(req.user.organizationType, 'business');
});

test('the request cache is not shared between requests', async () => {
  const calls = mockWorkspace();
  for (let i = 0; i < 2; i += 1) {
    await runChain(makeRequest(), makeResponse(), [authenticate, requireEntitlement('meetingsCalendar')]);
  }
  assert.deepEqual(calls, { user: 2, company: 2, subscription: 2 });
});

test('authenticate still rejects an unverified user before reading the subscription', async () => {
  const calls = mockWorkspace({ user: { isVerified: false } });
  const res = makeResponse();
  const passed = await runChain(makeRequest(), res, [authenticate]);
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.subscription, 0);
});

test('authenticate still rejects an inactive workspace', async () => {
  mockWorkspace({ company: null });
  const res = makeResponse();
  const passed = await runChain(makeRequest(), res, [authenticate]);
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Your workspace is unavailable.');
});

test('a token whose workspace no longer matches the user is rejected', async () => {
  mockWorkspace({ user: { companyId: new mongoose.Types.ObjectId().toString() } });
  const res = makeResponse();
  const passed = await runChain(makeRequest(), res, [authenticate]);
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
});

test('the organization guard still enforces the plan entitlement from the shared subscription', async () => {
  mockWorkspace({ subscription: { planConfig: { name: 'Starter', entitlements: { meetingsCalendar: false } } } });
  const res = makeResponse();
  const passed = await runChain(makeRequest(), res, [authenticate, requireOrganizationFeature('educationMeetings')]);
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'ORGANIZATION_FEATURE_FORBIDDEN');
});

test('a failed subscription lookup is retried by the next guard instead of being replayed', async () => {
  const calls = mockWorkspace();
  let failNext = true;
  const succeed = companySubscription.getEffectiveSubscription;
  companySubscription.getEffectiveSubscription = async (...args) => {
    if (failNext) {
      failNext = false;
      calls.subscription += 1;
      throw new Error('transient');
    }
    return succeed(...args);
  };
  const req = makeRequest();
  const first = makeResponse();
  assert.equal(await runChain(req, first, [authenticate]), false);
  assert.equal(first.statusCode, 503);

  const second = makeResponse();
  assert.equal(await runChain(req, second, [requireEntitlement('meetingsCalendar')]), true);
  assert.equal(calls.subscription, 2);
});
