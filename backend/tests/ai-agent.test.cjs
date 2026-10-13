const assert = require('node:assert/strict');
const test = require('node:test');

process.env.GEMINI_MODEL = 'gemini-3.8-flash';

const { GEMINI_MODEL } = require('../dist/services/geminiService');
const { buildTavroSystemPrompt, executeToolCallBatch, withProviderRetries } = require('../dist/ai/agentRuntime');
const { getTool, isToolAvailable } = require('../dist/ai/tools');
const { roleMatches } = require('../dist/config/organization');
const Task = require('../dist/models/Task').default;

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

test('Tavro matches Roman Urdu in Latin characters and does not switch it to Devanagari', () => {
  const prompt = buildTavroSystemPrompt({
    userRole: 'owner',
    preferredLanguage: 'hi',
  }, false, 'bhai WorkGrind mein meeting schedule kese karun?');

  assert.match(prompt, /latest message is Roman Urdu; answer in Roman Urdu using Latin letters, not Devanagari/);
  assert.match(prompt, /latest user message takes priority over conversation history/);
  assert.match(prompt, /Roman Urdu is Urdu written in Latin letters: do not translate it into Hindi or Devanagari/);
});

test('Tavro answers Urdu-script messages in Urdu script', () => {
  const prompt = buildTavroSystemPrompt({ userRole: 'owner' }, false, 'ورک گرائنڈ میں میٹنگ کیسے شیڈول کروں؟');
  assert.match(prompt, /latest message is Urdu script; answer in Urdu script/);
});

test('Tavro answers English messages in English and checks saved preference only for ambiguous turns', () => {
  const prompt = buildTavroSystemPrompt({
    userRole: 'owner',
    preferredLanguage: 'ur',
  }, false, 'How can I schedule a meeting in WorkGrind?');
  assert.match(prompt, /latest message is English; answer in English/);
  assert.match(prompt, /saved language preference is Urdu; use it only when the latest message is too short or ambiguous/);
});

test('Tavro answers Hindi in Devanagari and switches language based on each latest turn', () => {
  const ctx = { userRole: 'owner', preferredLanguage: 'ur' };
  const romanUrduPrompt = buildTavroSystemPrompt(ctx, false, 'Bhai mujhe batao meeting kese schedule karun?');
  const hindiPrompt = buildTavroSystemPrompt(ctx, false, 'वर्कग्राइंड में मीटिंग कैसे शेड्यूल करूँ?');

  assert.match(romanUrduPrompt, /latest message is Roman Urdu/);
  assert.match(hindiPrompt, /latest message is Hindi \(Devanagari\); answer in Hindi \(Devanagari\)/);
});

test('voice and text turns share the same per-message language instruction', () => {
  const prompt = buildTavroSystemPrompt({ userRole: 'owner' }, true, 'bhai, task complete kar do');
  assert.match(prompt, /latest message is Roman Urdu; answer in Roman Urdu using Latin letters, not Devanagari/);
  assert.match(prompt, /same language and script as the latest spoken message/);
});

test('Tavro describes both business and education WorkGrind modules without claiming academic AI access', () => {
  const prompt = buildTavroSystemPrompt({ userRole: 'teacher', organizationType: 'school' }, false, 'WorkGrind kya kar sakta hai?');

  for (const capability of [
    'Solo/personal workspaces',
    'companies and teams',
    'schools/academies, colleges, and universities',
    'business CRM contacts, accounts, and deals plus a client portal',
    'meetings, calendar planning, Daily Focus, and WorkGrind calling',
    'classes, guardians, enrollments, teaching assignments, schedules/timetables',
    'attendance, assessments/exams, results, fee charges, and fee payments',
  ]) {
    assert.ok(prompt.includes(capability), `missing capability summary: ${capability}`);
  }
  assert.match(prompt, /Answer the specific question first/);
  assert.match(prompt, /does not currently have academic-record tools/);
  assert.match(prompt, /cannot search private direct messages/);
  assert.match(prompt, /Do not claim calendar synchronization, automatic reminders/);
});

test('workspace read tools always scope queries to the authenticated tenant', async (context) => {
  const originalFind = Task.find;
  let receivedFilter;
  Task.find = (filter) => {
    receivedFilter = filter;
    const query = {
      populate() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean: async () => [],
    };
    return query;
  };
  context.after(() => { Task.find = originalFind; });

  await getTool('searchTasks').execute({}, {
    companyId: '64b000000000000000000001',
    userId: '64b000000000000000000002',
    userRole: 'owner',
  });

  assert.equal(receivedFilter.companyId, '64b000000000000000000001');
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
