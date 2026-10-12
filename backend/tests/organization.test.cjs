const assert = require('node:assert/strict');
const test = require('node:test');
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const PendingRegistration = require('../dist/models/PendingRegistration').default;
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const AuditLog = require('../dist/models/AuditLog').default;
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
} = require('../dist/config/subscription');
const { withCompanyCapacityLock } = require('../dist/utils/planLimits');
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
  assert.equal(isOrganizationRoleEligible('hod', 'college'), false);
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
