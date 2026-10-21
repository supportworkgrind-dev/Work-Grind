const assert = require('node:assert/strict');
const test = require('node:test');
const Company = require('../dist/models/Company').default;
const { normalizeOrganizationType } = require('../dist/config/organization');
const { educationPlanForOrganization, getPurchasablePlanIds } = require('../dist/config/subscription');
const {
  createCheckout,
  isCheckoutPlanAllowedForOrganization,
  resolveWebhookPlan,
} = require('../dist/controllers/subscription.controller');

const PRODUCT_ENV = [
  ['POLAR_STARTER_PRODUCT_ID', 'starter-product'],
  ['POLAR_PRO_PRODUCT_ID', 'pro-product'],
  ['POLAR_SCHOOL_PRODUCT_ID', 'school-product'],
  ['POLAR_COLLEGE_PRODUCT_ID', 'college-product'],
  ['POLAR_UNIVERSITY_PRODUCT_ID', 'university-product'],
];

function withProductEnv(fn) {
  const previous = PRODUCT_ENV.map(([key]) => process.env[key]);
  PRODUCT_ENV.forEach(([key, value]) => { process.env[key] = value; });
  const restore = () => PRODUCT_ENV.forEach(([key], index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
  return Promise.resolve().then(fn).finally(restore);
}

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function stubCompany(organizationType) {
  const original = Company.findById;
  Company.findById = () => ({
    select: async () => ({
      _id: 'company-1',
      name: 'testinguni',
      organizationType,
      subscriptionStatus: 'expired',
      subscriptionPlan: 'free',
      isLifetime: false,
    }),
  });
  return () => { Company.findById = original; };
}

test('organization type normalization handles casing, whitespace, missing and unknown values', () => {
  assert.equal(normalizeOrganizationType('University'), 'university');
  assert.equal(normalizeOrganizationType('  COLLEGE '), 'college');
  assert.equal(normalizeOrganizationType('school'), 'school');
  assert.equal(normalizeOrganizationType('Business'), 'business');
  assert.equal(normalizeOrganizationType(undefined), 'business');
  assert.equal(normalizeOrganizationType(''), 'business');
  assert.equal(normalizeOrganizationType('academy'), undefined);
  assert.equal(normalizeOrganizationType(42), undefined);
  assert.equal(educationPlanForOrganization('University'), 'university');
});

test('each organization type can only purchase its own plans', () => {
  assert.deepEqual(getPurchasablePlanIds('business'), ['starter', 'pro']);
  assert.deepEqual(getPurchasablePlanIds('school'), ['school']);
  assert.deepEqual(getPurchasablePlanIds('college'), ['college']);
  assert.deepEqual(getPurchasablePlanIds('University'), ['university']);
  assert.deepEqual(getPurchasablePlanIds('academy'), []);

  for (const plan of ['starter', 'pro', 'school', 'college', 'free']) {
    assert.equal(isCheckoutPlanAllowedForOrganization('University', plan), false, plan);
  }
  assert.equal(isCheckoutPlanAllowedForOrganization('University', 'university'), true);
  for (const plan of ['starter', 'pro', 'school', 'college', 'university']) {
    assert.equal(isCheckoutPlanAllowedForOrganization('academy', plan), false, plan);
  }
});

test('webhooks never activate a plan for an unrecognized organization type', () => withProductEnv(() => {
  assert.equal(resolveWebhookPlan({ organizationType: 'University' }, 'university-product', undefined), 'university');
  assert.equal(resolveWebhookPlan({ organizationType: 'academy' }, 'pro-product', 'pro'), undefined);
}));

test('checkout refuses business and other education plans for a University workspace before calling Polar', () =>
  withProductEnv(async () => {
    const restore = stubCompany('university');
    try {
      for (const planId of ['starter', 'pro', 'school', 'college']) {
        const res = mockResponse();
        await createCheckout({ body: { planId }, user: { userId: 'user-1', companyId: 'company-1', role: 'owner' } }, res);
        assert.equal(res.statusCode, 403, planId);
        assert.match(res.body.message, /can only subscribe to the university plan/);
      }
    } finally {
      restore();
    }
  }));

test('checkout refuses education plans for a business workspace', () => withProductEnv(async () => {
  const restore = stubCompany('business');
  try {
    for (const planId of ['school', 'college', 'university']) {
      const res = mockResponse();
      await createCheckout({ body: { planId }, user: { userId: 'user-1', companyId: 'company-1', role: 'owner' } }, res);
      assert.equal(res.statusCode, 403, planId);
    }
  } finally {
    restore();
  }
}));

test('checkout reports a clear error when the organization type cannot be mapped', () => withProductEnv(async () => {
  const restore = stubCompany('academy');
  try {
    const res = mockResponse();
    await createCheckout({ body: { planId: 'starter' }, user: { userId: 'user-1', companyId: 'company-1', role: 'owner' } }, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /organization type is not recognized/);
  } finally {
    restore();
  }
}));
