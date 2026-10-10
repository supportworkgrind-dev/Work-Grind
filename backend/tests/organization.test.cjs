const assert = require('node:assert/strict');
const test = require('node:test');
const Company = require('../dist/models/Company').default;
const User = require('../dist/models/User').default;
const PendingRegistration = require('../dist/models/PendingRegistration').default;
const OAuthTransaction = require('../dist/models/OAuthTransaction').default;
const { isOrganizationType, ORGANIZATION_TYPES } = require('../dist/config/organization');
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

  assert.equal(company.validateSync().errors.organizationType.kind, 'enum');
});
