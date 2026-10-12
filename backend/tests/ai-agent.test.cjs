const assert = require('node:assert/strict');
const test = require('node:test');

process.env.GEMINI_MODEL = 'gemini-3.8-flash';

const { GEMINI_MODEL } = require('../dist/services/geminiService');
const { executeToolCallBatch, withProviderRetries } = require('../dist/ai/agentRuntime');
const { getTool, isToolAvailable } = require('../dist/ai/tools');
const { roleMatches } = require('../dist/config/organization');

test('unsupported Gemini 3.8 text model configuration uses the supported Flash default', () => {
  assert.equal(GEMINI_MODEL, 'gemini-2.5-flash');
});

test('independent read-only tools can execute concurrently and keep result order', async () => {
  let active = 0;
  let maximumActive = 0;
  const calls = ['summary', 'tasks'];
  const results = await executeToolCallBatch(
    calls,
    () => true,
    async (call) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return call;
    },
  );

  assert.equal(maximumActive, 2);
  assert.deepEqual(results, calls);
});

test('a tool batch containing a write remains sequential', async () => {
  let active = 0;
  let maximumActive = 0;
  const calls = ['lookup', 'create'];
  const results = await executeToolCallBatch(
    calls,
    (call) => call !== 'create',
    async (call) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return call;
    },
  );

  assert.equal(maximumActive, 1);
  assert.deepEqual(results, calls);
});

test('workspace tool metadata only permits explicitly read-only operations to batch', () => {
  assert.equal(getTool('searchTasks').readOnly, true);
  assert.equal(getTool('getWorkspaceSummary').readOnly, true);
  assert.equal(getTool('createTask').readOnly, undefined);
  assert.equal(getTool('updateDeal').readOnly, undefined);
});

test('CRM tools stay unavailable to Solo and education workspaces even if entitlements are misconfigured', () => {
  const entitledFeatures = ['crm'];
  assert.equal(isToolAvailable('searchDeals', {
    companyId: 'company',
    userId: 'user',
    userRole: 'owner',
    accountType: 'individual',
    organizationType: 'business',
    enabledFeatures: entitledFeatures,
  }), false);
  for (const organizationType of ['school', 'college', 'university']) {
    assert.equal(isToolAvailable('createContact', {
      companyId: 'company',
      userId: 'user',
      userRole: 'owner',
      accountType: 'company',
      organizationType,
      enabledFeatures: entitledFeatures,
    }), false);
  }
  assert.equal(isToolAvailable('createContact', {
    companyId: 'company',
    userId: 'user',
    userRole: 'owner',
    accountType: 'company',
    organizationType: 'business',
    enabledFeatures: entitledFeatures,
  }), true);
});

test('institution leaders retain the admin-level role used for Tavro actions', () => {
  assert.equal(roleMatches('principal', ['admin', 'manager'], 'school'), true);
  assert.equal(roleMatches('dean', ['admin', 'manager'], 'university'), true);
  assert.equal(roleMatches('teacher', ['admin', 'manager'], 'college'), false);
});

test('transient provider failures receive only the configured bounded retry', async () => {
  let attempts = 0;
  let retries = 0;
  const result = await withProviderRetries(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
    return 'recovered';
  }, {
    maxRetries: 1,
    retryDelayMs: 0,
    onRetry: () => { retries += 1; },
  });

  assert.equal(result, 'recovered');
  assert.equal(attempts, 2);
  assert.equal(retries, 1);
});

test('provider retry does not repeat permanent bad requests', async () => {
  let attempts = 0;
  await assert.rejects(
    withProviderRetries(async () => {
      attempts += 1;
      throw Object.assign(new Error('invalid request'), { status: 400 });
    }, { maxRetries: 2, retryDelayMs: 0 }),
    /invalid request/,
  );
  assert.equal(attempts, 1);
});

test('provider retry backoff is cancelled when the request aborts', async () => {
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(
    withProviderRetries(async () => {
      attempts += 1;
      throw Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
    }, {
      signal: controller.signal,
      maxRetries: 1,
      retryDelayMs: 500,
      onRetry: () => controller.abort(),
    }),
  );
  assert.equal(attempts, 1);
});
