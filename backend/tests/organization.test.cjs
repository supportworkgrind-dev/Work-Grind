const assert = require('node:assert/strict');
const test = require('node:test');
const Company = require('../dist/models/Company').default;
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

  assert.equal(company.validateSync().errors.organizationType.kind, 'enum');
});
