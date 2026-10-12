const assert = require('node:assert/strict');
const test = require('node:test');

process.env.GEMINI_MODEL = 'gemini-3.8-flash';

const { GEMINI_MODEL } = require('../dist/services/geminiService');
const { executeToolCallBatch } = require('../dist/ai/agentRuntime');
const { getTool } = require('../dist/ai/tools');

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
