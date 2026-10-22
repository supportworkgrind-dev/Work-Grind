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

test('scheduled posts from an education workspace are failed instead of published', async (context) => {
  const Company = require('../dist/models/Company').default;
  const User = require('../dist/models/User').default;
  const Notification = require('../dist/models/Notification').default;
  const { dispatchScheduledSocialPosts } = require('../dist/controllers/socialPublishing.controller');
  const saved = {
    secret: process.env.CRON_SECRET,
    find: SocialPost.find,
    updateOne: SocialPost.updateOne,
    companyFindOne: Company.findOne,
    userFindOne: User.findOne,
    notificationCreate: Notification.create,
  };
  context.after(() => {
    if (saved.secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.secret;
    SocialPost.find = saved.find;
    SocialPost.updateOne = saved.updateOne;
    Company.findOne = saved.companyFindOne;
    User.findOne = saved.userFindOne;
    Notification.create = saved.notificationCreate;
  });
  process.env.CRON_SECRET = 'test-cron-secret';
  const postId = new mongoose.Types.ObjectId();
  const post = { _id: postId, companyId: new mongoose.Types.ObjectId(), authorId: new mongoose.Types.ObjectId() };
  SocialPost.find = () => ({ sort() { return this; }, limit() { return this; }, select() { return this; }, lean: async () => [{ _id: postId }] });
  SocialPost.findOneAndUpdate = async () => post;
  Company.findOne = () => ({ select: async () => ({ organizationType: 'school', accountType: 'company' }) });
  User.findOne = () => ({ select: async () => ({ _id: post.authorId, role: 'principal' }) });
  Notification.create = async (data) => data;
  let failure;
  SocialPost.updateOne = async (filter, update) => { failure = update.$set; return { modifiedCount: 1 }; };
  let integrationLookups = 0;
  Integration.findOne = () => { integrationLookups += 1; throw new Error('provider must not be reached'); };

  const res = response();
  await dispatchScheduledSocialPosts({ get: (name) => (name === 'authorization' ? 'Bearer test-cron-secret' : undefined) }, res);

  assert.equal(res.body.failed, 1);
  assert.equal(res.body.published, 0);
  assert.equal(failure.status, 'failed');
  assert.equal(failure.failureCode, 'workspace_or_publisher_unavailable');
  assert.equal(integrationLookups, 0);
});
