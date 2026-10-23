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
  // The workspace and role qualify, so the refusal names the plan, not the role.
  assert.equal(res.body.code, 'PLAN_UPGRADE_REQUIRED');
  assert.equal(res.body.message, 'Your workspace plan does not include this feature.');
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

test('a workspace saved before organization and account types existed keeps its features', async () => {
  // Lean reads skip schema defaults; the record must resolve as business/company.
  const calls = mockWorkspace({ company: { organizationType: undefined, accountType: undefined } });
  const req = makeRequest();
  const res = makeResponse();
  const passed = await runChain(req, res, [authenticate, requireOrganizationFeature('educationMeetings'), requireEntitlement('meetingsCalendar')]);
  assert.equal(passed, true, JSON.stringify(res.body));
  assert.equal(req.user.organizationType, 'business');
  assert.equal(req.user.accountType, 'company');
  assert.equal(calls.subscription, 1);
});

test('legacy casing of the organization type is normalized, not refused', async () => {
  mockWorkspace({ company: { organizationType: '  Business ', accountType: 'Company' } });
  const req = makeRequest();
  const passed = await runChain(req, makeResponse(), [authenticate, requireOrganizationFeature('educationMeetings')]);
  assert.equal(passed, true);
  assert.equal(req.user.organizationType, 'business');
});

test('an unknown workspace type is refused rather than guessed', async () => {
  mockWorkspace({ company: { organizationType: 'enterprise' } });
  const res = makeResponse();
  const passed = await runChain(makeRequest(), res, [authenticate, requireOrganizationFeature('educationMeetings')]);
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'ORGANIZATION_FEATURE_FORBIDDEN');
});

test('a role outside the feature policy is still refused for its role', async () => {
  // Guests are not Social Publishing contributors in business workspaces.
  mockWorkspace({ user: { role: 'guest' } });
  const res = makeResponse();
  const passed = await runChain(makeRequest(), res, [authenticate, requireOrganizationFeature('socialPublishing')]);
  assert.equal(passed, false);
  assert.equal(res.body.code, 'ORGANIZATION_FEATURE_FORBIDDEN');
});

test('an inactive subscription is reported as a subscription problem', async () => {
  mockWorkspace({ subscription: { hasActiveAccess: false } });
  const req = makeRequest();
  req.originalUrl = '/api/subscription/status'; // exempt from the authenticate subscription gate
  const res = makeResponse();
  const passed = await runChain(req, res, [authenticate, requireOrganizationFeature('educationMeetings')]);
  assert.equal(passed, false);
  assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED');
});

test('invitation, member, and audit routes admit the owner of a workspace saved before organization types existed', async () => {
  // Workspaces created before organizationType was added rely on the schema
  // default; lean reads must not turn that into "not available for your role".
  const companiesRouter = require('../dist/routes/companies').default;
  const adminRouter = require('../dist/routes/admin').default;
  const gateChain = (router, method, routePath) => {
    const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
    assert.ok(layer, `${method.toUpperCase()} ${routePath}`);
    const routerLevel = router.stack.filter((entry) => !entry.route).map((entry) => entry.handle);
    const routeLevel = layer.route.stack.map((entry) => entry.handle);
    // Everything except the controller at the end of the chain.
    return [...routerLevel, ...routeLevel.slice(0, -1)];
  };
  for (const [router, method, routePath, url] of [
    [companiesRouter, 'get', '/invites', '/api/companies/invites'],
    [companiesRouter, 'post', '/regenerate-invite-code', '/api/companies/regenerate-invite-code'],
    [adminRouter, 'get', '/members', '/api/admin/members'],
    [adminRouter, 'get', '/audit-logs', '/api/admin/audit-logs'],
  ]) {
    mockWorkspace({ user: { role: 'owner' }, company: { organizationType: undefined } });
    const req = makeRequest();
    req.originalUrl = url;
    const res = makeResponse();
    const passed = await runChain(req, res, gateChain(router, method, routePath));
    assert.equal(passed, true, `${url}: ${JSON.stringify(res.body)}`);
  }
});

test('those routes still refuse an employee of the same legacy workspace', async () => {
  const adminRouter = require('../dist/routes/admin').default;
  const layer = adminRouter.stack.find((entry) => entry.route?.path === '/audit-logs');
  const chain = [...adminRouter.stack.filter((entry) => !entry.route).map((entry) => entry.handle), ...layer.route.stack.slice(0, -1).map((entry) => entry.handle)];
  mockWorkspace({ user: { role: 'employee' }, company: { organizationType: undefined } });
  const req = makeRequest();
  req.originalUrl = '/api/admin/audit-logs';
  const res = makeResponse();
  assert.equal(await runChain(req, res, chain), false);
  assert.equal(res.statusCode, 403);
});
