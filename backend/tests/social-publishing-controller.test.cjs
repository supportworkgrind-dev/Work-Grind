const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Integration = require('../dist/models/Integration').default;
const SocialPost = require('../dist/models/SocialPost').default;
const { publishSocialPost } = require('../dist/controllers/socialPublishing.controller');

const originalIntegrationFindOne = Integration.findOne;
const originalSocialPostFindOneAndUpdate = SocialPost.findOneAndUpdate;

test.afterEach(() => {
  Integration.findOne = originalIntegrationFindOne;
  SocialPost.findOneAndUpdate = originalSocialPostFindOneAndUpdate;
});

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('concurrent publish requests cannot claim an already-processing post', async () => {
  const companyId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const connection = {
    _id: new mongoose.Types.ObjectId(),
    accessToken: 'encrypted-access-token',
    config: { grantedScopes: ['w_member_social'], linkedinSubject: 'member-123' },
    tokenExpiresAt: new Date(Date.now() + 60_000),
  };
  let atomicFilter;
  let update;

  Integration.findOne = (filter) => ({
    select: async () => {
      assert.equal(filter.companyId.toString(), companyId.toString());
      return connection;
    },
  });
  SocialPost.findOneAndUpdate = async (filter, mutation) => {
    atomicFilter = filter;
    update = mutation;
    return null;
  };

  const res = response();
  await publishSocialPost({
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: {},
    user: {
      companyId: companyId.toString(),
      userId: userId.toString(),
      role: 'owner',
      organizationType: 'business',
    },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(atomicFilter.$or, [
    { status: { $in: ['draft', 'approved'] } },
    { status: 'failed', failureCode: 'rate_limited' },
  ]);
  assert.equal(update.$set.status, 'publishing');
  assert.equal(update.$set.destinations[0].status, 'publishing');
});
