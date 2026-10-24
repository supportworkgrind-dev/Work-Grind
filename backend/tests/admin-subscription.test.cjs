const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const AuditLog = require('../dist/models/AuditLog').default;
const { getCompanySubscription } = require('../dist/services/companySubscription');
const { applyAdminSubscriptionChange } = require('../dist/services/adminSubscription');
const { isStalePolarEvent } = require('../dist/controllers/subscription.controller');
const superAdminRouter = require('../dist/routes/superAdmin').default;
const { requireSuperAdmin } = require('../dist/middleware/auth');

/**
 * Super-admin subscription changes must reach the member's effective
 * subscription (the one /subscription/status and every feature check use),
 * survive Polar events, and never turn genuinely expired access active.
 * Workspace records are in-memory fixtures; nothing touches a database.
 */

const original = {
  companyFindById: Company.findById,
  userFindById: User.findById,
  auditCreate: AuditLog.create,
};
let audits = [];

test.beforeEach(() => {
  audits = [];
  AuditLog.create = async (record) => { audits.push(record); return record; };
});

test.afterEach(() => {
  Company.findById = original.companyFindById;
  User.findById = original.userFindById;
  AuditLog.create = original.auditCreate;
});

const DAY = 86_400_000;

/** A hydrated-looking workspace document that getCompanySubscription can read and save. */
function workspace(overrides = {}) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Fixture Workspace',
    organizationType: 'business',
    accountType: 'company',
    ownerId: new mongoose.Types.ObjectId(),
    subscriptionStatus: 'expired',
    subscriptionPlan: 'starter',
    plan: 'free',
    subscriptionStartDate: new Date(Date.now() - 60 * DAY),
    subscriptionEndDate: new Date(Date.now() - DAY),
    cancelAtPeriodEnd: false,
    isLifetime: false,
    storage: { used: 0, limit: 0 },
    createdAt: new Date(Date.now() - 90 * DAY),
    saves: 0,
    async save() { this.saves += 1; return this; },
    ...overrides,
  };
  Company.findById = () => {
    const query = Promise.resolve(doc);
    query.select = () => Promise.resolve(doc);
    return query;
  };
  return doc;
}

const actorId = new mongoose.Types.ObjectId().toString();

test('an expired business workspace given Pro by an admin has active Pro access for its members', async () => {
  const company = workspace();
  const before = await getCompanySubscription(company._id.toString());
  assert.equal(before.hasActiveAccess, false);

  const result = await applyAdminSubscriptionChange(company._id.toString(), { plan: 'pro', reason: 'Support credit' }, actorId, { ip: '127.0.0.1' });

  assert.equal(result.previous.hasActiveAccess, false);
  assert.equal(result.subscription.hasActiveAccess, true);
  assert.equal(result.subscription.plan, 'pro');
  assert.equal(result.subscription.accessSource, 'manual_grant');
  const after = await getCompanySubscription(company._id.toString());
  assert.equal(after.hasActiveAccess, true);
  assert.equal(after.planConfig.id, 'pro');
  assert.equal(after.planConfig.entitlements.advancedAnalytics, true, 'Pro entitlements apply');
  assert.notEqual(after.planConfig.limits.members, 0, 'expired workspaces get zero seats; granted ones do not');
  assert.equal(before.planConfig.entitlements.advancedAnalytics, false);
  // The billing record is untouched: no fabricated Polar data.
  assert.equal(company.polarSubscriptionId, undefined);
  assert.equal(company.subscriptionStatus, 'expired');
});

test('the change is audited with the actor, previous state, new state, and reason', async () => {
  const company = workspace();
  await applyAdminSubscriptionChange(company._id.toString(), { plan: 'starter', reason: 'Pilot' }, actorId, { ip: '127.0.0.1' });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'ADMIN_SUBSCRIPTION_CHANGED');
  assert.equal(String(audits[0].userId), actorId);
  assert.equal(audits[0].details.previous.hasActiveAccess, false);
  assert.equal(audits[0].details.next.plan, 'starter');
  assert.equal(audits[0].details.reason, 'Pilot');
});

test('an education workspace can be granted its own plan and becomes active despite no Polar subscription', async () => {
  const company = workspace({ organizationType: 'university', subscriptionPlan: 'free' });
  const result = await applyAdminSubscriptionChange(company._id.toString(), { plan: 'university' }, actorId, { ip: '127.0.0.1' });
  assert.equal(result.subscription.hasActiveAccess, true);
  assert.equal(result.subscription.plan, 'university');
  assert.equal((await getCompanySubscription(company._id.toString())).subscriptionMismatch, false);
});

test('a plan the workspace type cannot hold is rejected', async () => {
  const university = workspace({ organizationType: 'university' });
  await assert.rejects(
    applyAdminSubscriptionChange(university._id.toString(), { plan: 'pro' }, actorId, { ip: '127.0.0.1' }),
    (error) => error.code === 'PLAN_NOT_ALLOWED' && error.status === 400,
  );
  const business = workspace();
  await assert.rejects(
    applyAdminSubscriptionChange(business._id.toString(), { plan: 'university' }, actorId, { ip: '127.0.0.1' }),
    (error) => error.code === 'PLAN_NOT_ALLOWED',
  );
  assert.equal(audits.length, 0);
});

test('expiry dates are validated', async () => {
  const company = workspace();
  for (const expiresAt of ['not-a-date', new Date(Date.now() - DAY).toISOString(), new Date(Date.now() + 6 * 366 * DAY).toISOString()]) {
    await assert.rejects(
      applyAdminSubscriptionChange(company._id.toString(), { plan: 'pro', expiresAt }, actorId, { ip: '127.0.0.1' }),
      (error) => error.code === 'INVALID_EXPIRY',
    );
  }
  const ok = await applyAdminSubscriptionChange(company._id.toString(), { plan: 'pro', expiresAt: new Date(Date.now() + 30 * DAY).toISOString() }, actorId, { ip: '127.0.0.1' });
  assert.ok(ok.subscription.expiresAt);
});

test('a grant that has expired leaves a genuinely expired workspace expired', async () => {
  const company = workspace({
    manualGrant: { plan: 'pro', grantedBy: new mongoose.Types.ObjectId(), grantedAt: new Date(Date.now() - 40 * DAY), expiresAt: new Date(Date.now() - DAY) },
  });
  const subscription = await getCompanySubscription(company._id.toString());
  assert.equal(subscription.hasActiveAccess, false);
  assert.equal(subscription.accessSource, 'none');
});

test('Polar marking the old paid subscription expired does not undo an active admin grant', async () => {
  // State after a subscription.revoked webhook for the workspace's Polar subscription.
  const company = workspace({
    polarSubscriptionId: 'sub_old', polarProductId: 'prod_old', subscriptionStatus: 'expired',
    manualGrant: { plan: 'starter', grantedBy: new mongoose.Types.ObjectId(), grantedAt: new Date() },
  });
  const subscription = await getCompanySubscription(company._id.toString());
  assert.equal(subscription.hasActiveAccess, true);
  assert.equal(subscription.plan, 'starter');
});

test('removing access clears the grant and expires a legacy admin "active" with no payment behind it', async () => {
  const legacy = workspace({ subscriptionStatus: 'active', subscriptionEndDate: undefined, subscriptionPlan: 'pro', plan: 'pro' });
  const result = await applyAdminSubscriptionChange(legacy._id.toString(), { plan: 'free' }, actorId, { ip: '127.0.0.1' });
  assert.equal(result.subscription.hasActiveAccess, false);
  assert.equal(legacy.manualGrant, undefined);

  // A real Polar subscription is left to Polar.
  const paying = workspace({ subscriptionStatus: 'active', subscriptionEndDate: new Date(Date.now() + 20 * DAY), polarSubscriptionId: 'sub_live', polarProductId: 'prod_live' });
  const kept = await applyAdminSubscriptionChange(paying._id.toString(), { plan: 'free' }, actorId, { ip: '127.0.0.1' });
  assert.equal(kept.subscription.hasActiveAccess, true);
  assert.equal(paying.subscriptionStatus, 'active');
});

test('Polar events older than the last applied update are recognised as stale', () => {
  const company = { polarSubscriptionModifiedAt: new Date('2026-10-20T10:00:00Z') };
  assert.equal(isStalePolarEvent(company, { modifiedAt: '2026-10-19T09:00:00Z' }), true);
  assert.equal(isStalePolarEvent(company, { modified_at: '2026-10-19T09:00:00Z' }), true);
  assert.equal(isStalePolarEvent(company, { modifiedAt: '2026-10-20T10:00:00Z' }), false, 'a redelivery of the same event is not stale');
  assert.equal(isStalePolarEvent(company, { modifiedAt: '2026-10-21T00:00:00Z' }), false);
  assert.equal(isStalePolarEvent({}, { modifiedAt: '2026-10-19T09:00:00Z' }), false, 'first event is always applied');
});

test('subscription changes are only reachable behind the super-admin guard', () => {
  const guardIndex = superAdminRouter.stack.findIndex((layer) => !layer.route && layer.handle === requireSuperAdmin);
  assert.ok(guardIndex >= 0, 'requireSuperAdmin is mounted');
  for (const routePath of ['/users/:id/plan', '/workspaces/:id/plan', '/workspaces/:id/plans']) {
    const index = superAdminRouter.stack.findIndex((layer) => layer.route?.path === routePath);
    assert.ok(index > guardIndex, `${routePath} is registered after the guard`);
  }
});
