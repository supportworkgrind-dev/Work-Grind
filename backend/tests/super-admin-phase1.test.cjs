const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const User = require('../dist/models/User').default;
const Company = require('../dist/models/Company').default;
const Project = require('../dist/models/Project').default;
const Task = require('../dist/models/Task').default;
const SupportTicket = require('../dist/models/SupportTicket').default;
const AuditLog = require('../dist/models/AuditLog').default;
const email = require('../dist/utils/email');
const {
  getTicketCounts,
  getTickets,
  getUserDetails,
  getUsers,
  resetUserPassword,
} = require('../dist/controllers/superAdmin.controller');

const originals = {
  userFind: User.find,
  userFindById: User.findById,
  userUpdateOne: User.updateOne,
  companyFind: Company.find,
  taskCountDocuments: Task.countDocuments,
  projectCountDocuments: Project.countDocuments,
  ticketFind: SupportTicket.find,
  ticketCountDocuments: SupportTicket.countDocuments,
  auditCreate: AuditLog.create,
  sendPasswordResetEmail: email.sendPasswordResetEmail,
};

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function query(value) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

test.afterEach(() => {
  User.find = originals.userFind;
  User.findById = originals.userFindById;
  User.updateOne = originals.userUpdateOne;
  Company.find = originals.companyFind;
  Task.countDocuments = originals.taskCountDocuments;
  Project.countDocuments = originals.projectCountDocuments;
  SupportTicket.find = originals.ticketFind;
  SupportTicket.countDocuments = originals.ticketCountDocuments;
  AuditLog.create = originals.auditCreate;
  email.sendPasswordResetEmail = originals.sendPasswordResetEmail;
});

test('admin user list and detail responses contain only required fields', async () => {
  let listedProjection = '';
  const company = {
    _id: 'company-a',
    name: 'Acme',
    industry: 'Technology',
    plan: 'pro',
    country: 'US',
    accountType: 'company',
    subscriptionPlan: 'pro',
    subscriptionStatus: 'active',
    trialStartDate: new Date('2026-01-01'),
    trialEndDate: new Date('2026-01-08'),
    subscriptionEndDate: new Date('2027-01-01'),
    inviteCode: 'invite-secret',
    pendingInvites: [{ token: 'invite-token-secret' }],
  };
  const user = {
    _id: 'user-a',
    fullName: 'A User',
    email: 'user@example.test',
    avatar: 'avatar-url',
    role: 'owner',
    accountType: 'company',
    isActive: true,
    isVerified: true,
    createdAt: new Date('2026-01-01'),
    lastSeen: new Date('2026-02-01'),
    lastLogin: new Date('2026-02-01'),
    subscriptionStatus: 'active',
    subscriptionPlan: 'pro',
    trialEndDate: undefined,
    jobTitle: 'Owner',
    department: 'Operations',
    country: 'US',
    trialStartDate: new Date('2026-01-01'),
    subscriptionStartDate: new Date('2026-01-08'),
    subscriptionEndDate: new Date('2027-01-08'),
    polarSubscriptionId: 'polar-subscription-id',
    polarCustomerId: 'polar-customer-id',
    cancelAtPeriodEnd: false,
    companyId: company,
    password: 'password-hash-secret',
    resetPasswordToken: 'reset-token-secret',
    verificationToken: 'verification-token-secret',
    mfaSecretEncrypted: 'mfa-secret',
    recoveryCodesHashed: ['recovery-secret'],
    refreshTokens: ['refresh-secret'],
  };

  User.countDocuments = async () => 1;
  User.find = () => {
    const result = query([user]);
    result.select = (projection) => { listedProjection = projection; return result; };
    return result;
  };

  const listResponse = response();
  await getUsers({ query: {}, user: { userId: 'admin-a' } }, listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.match(listedProjection, /fullName/);
  assert.doesNotMatch(listedProjection, /password|Token|mfa|refresh/i);
  const listedUser = listResponse.body.users[0];
  assert.deepEqual(Object.keys(listedUser).sort(), [
    '_id', 'accountType', 'avatar', 'companyId', 'createdAt', 'email', 'fullName',
    'isActive', 'isVerified', 'lastLogin', 'lastSeen', 'role', 'subscriptionPlan',
    'subscriptionStatus',
  ].sort());
  assert.deepEqual(Object.keys(listedUser.companyId).sort(), [
    '_id', 'accountType', 'name', 'plan', 'subscriptionEndDate', 'subscriptionPlan',
    'subscriptionStatus', 'trialEndDate', 'trialStartDate',
  ].sort());
  assert.equal(JSON.stringify(listResponse.body).includes('secret'), false);

  User.findById = () => query(user);
  Task.countDocuments = async () => 2;
  Project.countDocuments = async () => 3;
  const detailResponse = response();
  await getUserDetails({ params: { id: 'user-a' }, user: { userId: 'admin-a' } }, detailResponse);

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.body.user.fullName, 'A User');
  assert.deepEqual(Object.keys(detailResponse.body.user.companyId).sort(), [
    '_id', 'country', 'industry', 'name', 'plan',
  ].sort());
  assert.equal(JSON.stringify(detailResponse.body).includes('secret'), false);
  assert.deepEqual(detailResponse.body.stats, {
    assignedTasks: 2,
    completedTasks: 2,
    createdProjects: 3,
  });
});

test('admin password reset emails a hashed single-use token and audits the initiating admin', async () => {
  const userId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const user = {
    _id: userId,
    companyId,
    email: 'user@example.test',
    fullName: 'A User',
    password: 'unchanged-password-hash',
    refreshTokens: ['existing-refresh-token'],
    async save() {},
  };
  let auditRecord;
  let rawEmailToken;

  User.findById = async () => user;
  AuditLog.create = async (entry) => { auditRecord = entry; };
  email.sendPasswordResetEmail = async (_address, _name, token) => {
    rawEmailToken = token;
    return { success: true };
  };

  const res = response();
  await resetUserPassword({
    params: { id: userId.toString() },
    body: {},
    user: { userId: 'initiating-admin' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal('temporaryPassword' in res.body, false);
  assert.equal('password' in res.body, false);
  assert.equal(rawEmailToken.length, 64);
  assert.match(rawEmailToken, /^[a-f0-9]{64}$/);
  assert.equal(user.resetPasswordToken.length, 64);
  assert.notEqual(user.resetPasswordToken, rawEmailToken);
  assert.equal(auditRecord.userId, 'initiating-admin');
  assert.equal(auditRecord.action, 'USER_PASSWORD_RESET_REQUESTED_BY_SUPERADMIN');
  assert.equal(auditRecord.resourceId, userId.toString());
  assert.equal(JSON.stringify(auditRecord).includes(rawEmailToken), false);
  assert.equal(user.password, 'unchanged-password-hash');
  assert.deepEqual(user.refreshTokens, ['existing-refresh-token']);
});

test('failed admin reset email clears the pending token and leaves password unchanged', async () => {
  const user = {
    _id: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
    email: 'user@example.test',
    fullName: 'A User',
    password: 'unchanged-password-hash',
    async save() {},
  };
  let cleanupFilter;

  User.findById = async () => user;
  User.updateOne = async (filter) => { cleanupFilter = filter; };
  AuditLog.create = async () => {};
  email.sendPasswordResetEmail = async () => ({ success: false });

  const res = response();
  await resetUserPassword({
    params: { id: user._id.toString() },
    body: {},
    user: { userId: 'initiating-admin' },
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal('temporaryPassword' in res.body, false);
  assert.equal(cleanupFilter._id, user._id);
  assert.equal(cleanupFilter.resetPasswordToken, user.resetPasswordToken);
  assert.equal(user.password, 'unchanged-password-hash');
});

test('support ticket listing applies filters, stable pagination, and a minimal response DTO', async () => {
  let queryFilter;
  let querySkip;
  let queryLimit;
  const record = {
    _id: 'ticket-a',
    type: 'demo',
    name: 'A Person',
    email: 'person@example.test',
    company: 'Acme',
    subject: 'Demo',
    message: 'Please schedule',
    status: 'new',
    priority: 'medium',
    isRead: false,
    adminNotes: 'follow-up',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    replies: [{ _id: 'reply-a', replyText: 'Thanks', sentBy: 'Admin', sentAt: new Date(), emailMessageId: 'internal-mail-id' }],
    internalToken: 'ticket-internal-secret',
  };
  SupportTicket.find = (filter) => {
    queryFilter = filter;
    const result = query([record]);
    result.skip = (value) => { querySkip = value; return result; };
    result.limit = (value) => { queryLimit = value; return result; };
    result.sort = (value) => { result.sortValue = value; return result; };
    return result;
  };
  SupportTicket.countDocuments = async (filter = {}) => {
    if (filter.isRead === false) return 4;
    if (filter.type === 'demo') return 2;
    if (filter.type?.$ne === 'demo') return 3;
    if (filter.status === 'new' && filter.type === 'demo') return 61;
    return 5;
  };

  const res = response();
  await getTickets({
    query: { page: '3', limit: '2', type: 'demo', status: 'new', q: 'a.*' },
    user: { userId: 'admin-a' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(querySkip, 4);
  assert.equal(queryLimit, 2);
  assert.equal(queryFilter.type, 'demo');
  assert.equal(queryFilter.status, 'new');
  assert.equal(queryFilter.$or[0].name.$regex, 'a\\.\\*');
  assert.deepEqual(res.body.pagination, { page: 3, limit: 2, total: 61, totalPages: 31 });
  assert.deepEqual(res.body.counts, { total: 5, unread: 4, demo: 2, contact: 3 });
  assert.equal(res.body.tickets[0].internalToken, undefined);
  assert.equal(res.body.tickets[0].replies[0].emailMessageId, undefined);
});

test('support ticket pagination caps oversized page sizes at 100', async () => {
  let queryLimit;
  SupportTicket.find = () => {
    const result = query([]);
    result.limit = (value) => { queryLimit = value; return result; };
    return result;
  };
  SupportTicket.countDocuments = async () => 250;

  const res = response();
  await getTickets({ query: { limit: '5000' }, user: { userId: 'admin-a' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(queryLimit, 100);
  assert.deepEqual(res.body.pagination, { page: 1, limit: 100, total: 250, totalPages: 3 });
});

test('support unread-count endpoint returns aggregate counts without fetching ticket records', async () => {
  let listQueried = false;
  SupportTicket.find = () => { listQueried = true; throw new Error('must not read tickets'); };
  SupportTicket.countDocuments = async (filter = {}) => {
    if (filter.isRead === false) return 7;
    if (filter.type === 'demo') return 2;
    if (filter.type?.$ne === 'demo') return 5;
    return 7;
  };

  const res = response();
  await getTicketCounts({ user: { userId: 'admin-a' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, counts: { total: 7, unread: 7, demo: 2, contact: 5 } });
  assert.equal(listQueried, false);
});
