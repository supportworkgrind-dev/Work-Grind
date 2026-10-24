const assert = require('node:assert/strict');
const test = require('node:test');
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const PendingRegistration = require('../dist/models/PendingRegistration').default;
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const AuditLog = require('../dist/models/AuditLog').default;
const ProcessedPolarWebhook = require('../dist/models/ProcessedPolarWebhook').default;
const { restoreWorkspaceCreatorRole } = require('../dist/controllers/auth.controller');
const {
  isOrganizationType,
  isOrganizationRoleEligible,
  canAssignOrganizationRole,
  ORGANIZATION_TYPES,
} = require('../dist/config/organization');
const {
  getEducationPlanPricing,
  getEducationPolarProductId,
  getEducationPlanConfig,
  educationPlanForOrganization,
  hasActiveAccess,
} = require('../dist/config/subscription');
const {
  enforceEducationSubscriptionTruth,
  hasVerifiedEducationSubscription,
} = require('../dist/services/companySubscription');
const { withCompanyCapacityLock } = require('../dist/utils/planLimits');
const {
  matchesPolarProductPrice,
  resolveWebhookPlan,
  isCheckoutPlanAllowedForOrganization,
  claimPolarWebhookDelivery,
  releasePolarWebhookDelivery,
  isCurrentPolarSubscription,
} = require('../dist/controllers/subscription.controller');
const mongoose = require('mongoose');

test('new and legacy-shaped companies default to a business organization without changing account type', () => {
  const company = new Company({
    name: 'Example Workspace',
    ownerId: new mongoose.Types.ObjectId(),
    inviteCode: 'TEST-CODE',
  });

  assert.equal(company.organizationType, 'business');
  assert.equal(company.accountType, 'company');
  assert.equal(new Company({
    name: 'Personal Workspace',
    ownerId: new mongoose.Types.ObjectId(),
    inviteCode: 'PERSONAL-CODE',
    accountType: 'individual',
  }).accountType, 'individual');
});

test('organization classification only accepts supported organization types', () => {
  assert.deepEqual(ORGANIZATION_TYPES, ['business', 'school', 'college', 'university']);
  for (const type of ORGANIZATION_TYPES) assert.equal(isOrganizationType(type), true);
  for (const type of ['individual', 'University', '', null, undefined, 1]) {
    assert.equal(isOrganizationType(type), false);
  }
});

test('education roles are limited to compatible institution types and assignment authority', () => {
  for (const role of ['principal', 'teacher', 'student', 'parent']) {
    assert.equal(isOrganizationRoleEligible(role, 'school'), true);
    assert.equal(isOrganizationRoleEligible(role, 'college'), true);
    assert.equal(isOrganizationRoleEligible(role, 'university'), true);
  }
  assert.equal(isOrganizationRoleEligible('dean', 'university'), true);
  assert.equal(isOrganizationRoleEligible('hod', 'university'), true);
  assert.equal(isOrganizationRoleEligible('dean', 'school'), false);
  // Colleges have department heads; schools do not.
  assert.equal(isOrganizationRoleEligible('hod', 'college'), true);
  assert.equal(isOrganizationRoleEligible('hod', 'school'), false);
  assert.equal(isOrganizationRoleEligible('student', 'business'), false);

  assert.equal(canAssignOrganizationRole('owner', 'dean', 'university', true), true);
  assert.equal(canAssignOrganizationRole('principal', 'teacher', 'school', false), true);
  assert.equal(canAssignOrganizationRole('principal', 'admin', 'school', false), false);
  assert.equal(canAssignOrganizationRole('admin', 'owner', 'business', false), false);
});

test('education monthly prices are backend-defined without placeholder Polar IDs', () => {
  const envKeys = [
    'POLAR_SCHOOL_PRODUCT_ID',
    'POLAR_COLLEGE_PRODUCT_ID',
    'POLAR_UNIVERSITY_PRODUCT_ID',
  ];
  const previousValues = envKeys.map((key) => process.env[key]);
  try {
    for (const key of envKeys) delete process.env[key];
    assert.deepEqual(
      getEducationPlanPricing().map(({ id, priceMonthly, billingInterval }) => ({ id, priceMonthly, billingInterval })),
      [
        { id: 'school', priceMonthly: 1900, billingInterval: 'month' },
        { id: 'college', priceMonthly: 4900, billingInterval: 'month' },
        { id: 'university', priceMonthly: 9900, billingInterval: 'month' },
      ],
    );
    assert.equal(getEducationPolarProductId('school'), undefined);
    assert.equal(getEducationPolarProductId('college'), undefined);
    assert.equal(getEducationPolarProductId('university'), undefined);
    assert.ok(getEducationPlanPricing().every((plan) => plan.checkoutAvailable === false));
  } finally {
    envKeys.forEach((key, index) => {
      if (previousValues[index] === undefined) delete process.env[key];
      else process.env[key] = previousValues[index];
    });
  }
});

test('education subscription configs map workspace types to the specified monthly prices and limits', () => {
  const expected = {
    school: { priceMonthly: 1900, members: 25, students: 200, pendingInvites: 50 },
    college: { priceMonthly: 4900, members: 75, students: 750, pendingInvites: 150 },
    university: { priceMonthly: 9900, members: 200, students: 2000, pendingInvites: 500 },
  };
  for (const [organizationType, values] of Object.entries(expected)) {
    assert.equal(educationPlanForOrganization(organizationType), organizationType);
    const plan = getEducationPlanConfig(organizationType);
    assert.equal(plan.priceMonthly, values.priceMonthly);
    assert.equal(plan.limits.members, values.members);
    assert.equal(plan.limits.students, values.students);
    assert.equal(plan.limits.pendingInvites, values.pendingInvites);
  }
  assert.equal(educationPlanForOrganization('business'), undefined);
  assert.equal(educationPlanForOrganization('individual'), undefined);
});

test('new education workspaces keep the free subscription default and organization selection is not payment', () => {
  for (const organizationType of ['school', 'college', 'university']) {
    const company = new Company({
      name: `${organizationType} workspace`,
      ownerId: new mongoose.Types.ObjectId(),
      inviteCode: `${organizationType}-test`,
      organizationType,
    });
    assert.equal(company.subscriptionStatus, 'none');
    assert.equal(company.subscriptionPlan, 'free');
    assert.equal(hasVerifiedEducationSubscription(company), false);
    assert.equal(hasActiveAccess(company.subscriptionStatus), false);

    const unverifiedActiveClaim = enforceEducationSubscriptionTruth('active', company);
    assert.deepEqual(unverifiedActiveClaim, { status: 'expired', subscriptionMismatch: true });
    assert.equal(hasActiveAccess(unverifiedActiveClaim.status), false);
  }
});

test('verified Polar subscription activates its matching education plan only', () => {
  const previousProductId = process.env.POLAR_UNIVERSITY_PRODUCT_ID;
  try {
    process.env.POLAR_UNIVERSITY_PRODUCT_ID = 'university-product';
    const company = {
      organizationType: 'university',
      subscriptionPlan: 'university',
      polarSubscriptionId: 'polar-subscription-1',
      polarProductId: 'university-product',
    };
    assert.equal(hasVerifiedEducationSubscription(company), true);
    assert.deepEqual(enforceEducationSubscriptionTruth('active', company), {
      status: 'active',
      subscriptionMismatch: false,
    });
    assert.equal(hasVerifiedEducationSubscription({ ...company, polarProductId: 'other-product' }), false);
    assert.equal(hasVerifiedEducationSubscription({ ...company, organizationType: 'school' }), false);
    delete process.env.POLAR_UNIVERSITY_PRODUCT_ID;
    assert.equal(hasVerifiedEducationSubscription(company), true);
    assert.deepEqual(enforceEducationSubscriptionTruth('active', {
      organizationType: 'business',
      subscriptionPlan: 'free',
    }), { status: 'active', subscriptionMismatch: false });
  } finally {
    if (previousProductId === undefined) delete process.env.POLAR_UNIVERSITY_PRODUCT_ID;
    else process.env.POLAR_UNIVERSITY_PRODUCT_ID = previousProductId;
  }
});

test('valid trials stay trials and expired or cancelled education subscriptions do not keep access', () => {
  const company = {
    organizationType: 'school',
    subscriptionPlan: 'free',
  };
  assert.deepEqual(enforceEducationSubscriptionTruth('trialing', company), {
    status: 'trialing',
    subscriptionMismatch: false,
  });
  assert.equal(hasActiveAccess('trialing', undefined, new Date(Date.now() + 60_000)), true);
  assert.equal(hasActiveAccess('trialing', undefined, new Date(Date.now() - 60_000)), false);
  assert.equal(hasActiveAccess('cancelled', new Date(Date.now() - 60_000)), false);
  assert.equal(hasActiveAccess('expired'), false);
  assert.equal(hasActiveAccess('incomplete'), false);
});

test('Polar education product validation requires an active monthly USD fixed price at the configured amount', () => {
  const product = {
    isArchived: false,
    isRecurring: true,
    recurringInterval: 'month',
    recurringIntervalCount: 1,
    prices: [{
      amountType: 'fixed',
      isArchived: false,
      priceCurrency: 'USD',
      priceAmount: 9900,
    }],
  };
  assert.equal(matchesPolarProductPrice(product, 'university'), true);
  assert.equal(matchesPolarProductPrice({ ...product, recurringInterval: 'year' }, 'university'), false);
  assert.equal(matchesPolarProductPrice({
    ...product,
    prices: [{ ...product.prices[0], priceAmount: 1900 }],
  }, 'university'), false);
  assert.equal(matchesPolarProductPrice({
    ...product,
    prices: [{ ...product.prices[0], isArchived: true }],
  }, 'university'), false);
});

test('Polar webhook plan mapping requires product/workspace match and ignores education metadata claims', () => {
  const keys = [
    ['POLAR_SCHOOL_PRODUCT_ID', 'school-product'],
    ['POLAR_COLLEGE_PRODUCT_ID', 'college-product'],
    ['POLAR_UNIVERSITY_PRODUCT_ID', 'university-product'],
  ];
  const previousValues = keys.map(([key]) => process.env[key]);
  try {
    keys.forEach(([key, value]) => { process.env[key] = value; });
    assert.equal(resolveWebhookPlan({ organizationType: 'university' }, 'university-product', 'starter'), 'university');
    assert.equal(resolveWebhookPlan({ organizationType: 'school' }, 'university-product', 'school'), undefined);
    assert.equal(resolveWebhookPlan({ organizationType: 'business' }, 'university-product', 'pro'), undefined);
    assert.equal(resolveWebhookPlan({ organizationType: 'business' }, undefined, 'pro'), 'pro');
  } finally {
    keys.forEach(([key], index) => {
      if (previousValues[index] === undefined) delete process.env[key];
      else process.env[key] = previousValues[index];
    });
  }
});

test('Polar webhook delivery claims reject duplicate IDs and stale subscription IDs', async () => {
  const originalCreate = ProcessedPolarWebhook.create;
  const originalDeleteOne = ProcessedPolarWebhook.deleteOne;
  const claimedIds = new Set();
  ProcessedPolarWebhook.create = async ({ _id }) => {
    if (claimedIds.has(_id)) {
      throw Object.assign(new Error('duplicate event'), { code: 11000 });
    }
    claimedIds.add(_id);
    return { _id };
  };
  ProcessedPolarWebhook.deleteOne = async ({ _id }) => {
    claimedIds.delete(_id);
    return { deletedCount: 1 };
  };
  try {
    assert.equal(await claimPolarWebhookDelivery('polar-event-1'), true);
    assert.equal(await claimPolarWebhookDelivery('polar-event-1'), false);
    assert.equal(isCurrentPolarSubscription({
      polarSubscriptionId: 'current-subscription',
      polarProductId: 'university-product',
    }, {
      id: 'stale-subscription',
      productId: 'university-product',
    }), false);
    assert.equal(isCurrentPolarSubscription({
      polarSubscriptionId: 'current-subscription',
      polarProductId: 'university-product',
    }, {
      id: 'current-subscription',
      productId: 'wrong-product',
    }), false);
    await releasePolarWebhookDelivery('polar-event-1');
    assert.equal(await claimPolarWebhookDelivery('polar-event-1'), true);
  } finally {
    ProcessedPolarWebhook.create = originalCreate;
    ProcessedPolarWebhook.deleteOne = originalDeleteOne;
  }
});

test('checkout plans are selected from persisted organization type for every workspace category', () => {
  for (const type of ['business']) {
    for (const plan of ['free', 'starter', 'pro']) {
      assert.equal(isCheckoutPlanAllowedForOrganization(type, plan), true);
    }
    for (const plan of ['school', 'college', 'university']) {
      assert.equal(isCheckoutPlanAllowedForOrganization(type, plan), false);
    }
  }
  for (const type of ['school', 'college', 'university']) {
    for (const plan of ['free', 'starter', 'pro', 'school', 'college', 'university']) {
      assert.equal(isCheckoutPlanAllowedForOrganization(type, plan), plan === type);
    }
  }
});

test('workspace capacity lock serializes concurrent capacity changes', async () => {
  const originalFindOneAndUpdate = Company.findOneAndUpdate;
  const originalUpdateOne = Company.updateOne;
  const originalExists = Company.exists;
  let lockToken;
  let lockUntil = 0;
  let activeOperations = 0;
  let maximumActiveOperations = 0;

  Company.findOneAndUpdate = (_filter, update) => {
    const now = Date.now();
    const eligible = !lockToken || lockUntil <= now;
    if (eligible) {
      lockToken = update.$set.capacityLockToken;
      lockUntil = update.$set.capacityLockUntil.getTime();
    }
    return { select: async () => eligible ? { _id: 'company' } : null };
  };
  Company.updateOne = async (filter) => {
    if (filter.capacityLockToken === lockToken) {
      lockToken = undefined;
      lockUntil = 0;
    }
    return { matchedCount: 1 };
  };
  Company.exists = async () => ({ _id: 'company' });

  try {
    await Promise.all([
      withCompanyCapacityLock('company', async () => {
        activeOperations += 1;
        maximumActiveOperations = Math.max(maximumActiveOperations, activeOperations);
        await new Promise((resolve) => setTimeout(resolve, 60));
        activeOperations -= 1;
      }),
      withCompanyCapacityLock('company', async () => {
        activeOperations += 1;
        maximumActiveOperations = Math.max(maximumActiveOperations, activeOperations);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeOperations -= 1;
      }),
    ]);
    assert.equal(maximumActiveOperations, 1);
  } finally {
    Company.findOneAndUpdate = originalFindOneAndUpdate;
    Company.updateOne = originalUpdateOne;
    Company.exists = originalExists;
  }
});

test('mongoose organization type enum rejects values outside the supported types', () => {
  const company = new Company({
    name: 'Invalid Organization',
    ownerId: new mongoose.Types.ObjectId(),
    inviteCode: 'INVALID-CODE',
    organizationType: 'academy',
  });

  test('employee remains the legacy user default while workspace creators can be explicitly owners', () => {
    const employee = new User({ fullName: 'Existing Member', email: 'member@example.test' });
    const owner = new User({ fullName: 'New Owner', email: 'owner@example.test', role: 'owner' });

    assert.equal(employee.role, 'employee');
    assert.equal(owner.role, 'owner');
  });

  test('signup and OAuth transaction schemas retain each organization choice', () => {
    const choices = [
      { accountType: 'individual', organizationType: 'business' },
      { accountType: 'company', organizationType: 'business' },
      { accountType: 'company', organizationType: 'school' },
      { accountType: 'company', organizationType: 'college' },
      { accountType: 'company', organizationType: 'university' },
    ];
    for (const [index, choice] of choices.entries()) {
      const pending = new PendingRegistration({
        email: `pending-${index}@example.test`,
        fullName: 'Workspace Owner',
        passwordCiphertext: 'cipher',
        passwordIv: 'iv',
        passwordAuthTag: 'tag',
        verificationCodeHash: 'hash',
        verificationExpiresAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        lastSentAt: new Date(),
        ...choice,
      });
      assert.equal(pending.validateSync(), undefined);
      assert.equal(pending.accountType, choice.accountType);
      assert.equal(pending.organizationType, choice.organizationType);

      const transaction = new OAuthTransaction({
        stateHash: `state-${index}`,
        provider: 'google',
        nonce: `nonce-${index}`,
        codeVerifier: `verifier-${index}`,
        returnTo: `/create-company?organizationType=${choice.organizationType}`,
        intent: 'signup',
        expiresAt: new Date(Date.now() + 60_000),
        ...choice,
      });
      assert.equal(transaction.validateSync(), undefined);
      assert.equal(transaction.accountType, choice.accountType);
      assert.equal(transaction.organizationType, choice.organizationType);
    }
  });

  test('owner-role repair requires matching persisted workspace ownership and is audited', async () => {
    const originalAuditCreate = AuditLog.create;
    const auditEntries = [];
    AuditLog.create = async (entry) => { auditEntries.push(entry); return entry; };
    try {
      const unrelatedEmployee = {
        _id: 'employee-1',
        role: 'employee',
        accountType: 'company',
        save: async () => {},
      };
      await restoreWorkspaceCreatorRole(unrelatedEmployee, {
        _id: 'workspace-1',
        ownerId: 'different-user',
        accountType: 'company',
      }, '127.0.0.1');
      assert.equal(unrelatedEmployee.role, 'employee');
      assert.equal(auditEntries.length, 0);

      const actualCreator = {
        _id: 'creator-1',
        role: 'employee',
        accountType: 'company',
        save: async () => {},
      };
      await restoreWorkspaceCreatorRole(actualCreator, {
        _id: 'workspace-2',
        ownerId: 'creator-1',
        accountType: 'individual',
      }, '127.0.0.1');
      assert.equal(actualCreator.role, 'owner');
      assert.equal(actualCreator.accountType, 'individual');
      assert.equal(auditEntries.length, 1);
      assert.equal(auditEntries[0].action, 'restore_owner_role');
      assert.equal(auditEntries[0].details.reason, 'company_owner_id_match');
    } finally {
      AuditLog.create = originalAuditCreate;
    }
  });

  assert.equal(company.validateSync().errors.organizationType.kind, 'enum');
});
