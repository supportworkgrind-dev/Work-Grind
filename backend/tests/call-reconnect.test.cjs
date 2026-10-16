const assert = require('node:assert/strict');
const test = require('node:test');
const {
  clearCallReconnectCleanup,
  scheduleCallReconnectCleanup,
} = require('../dist/utils/callReconnect');

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

test('call disconnect cleanup can be cancelled when a participant reconnects', async (t) => {
  const key = `reconnect:${Date.now()}`;
  let cleaned = false;
  t.after(() => clearCallReconnectCleanup(key));

  scheduleCallReconnectCleanup(key, () => { cleaned = true; }, 25);
  clearCallReconnectCleanup(key);
  await wait(40);

  assert.equal(cleaned, false);
});

test('a later disconnect restarts the cleanup grace period', async (t) => {
  const key = `reschedule:${Date.now()}`;
  let cleanups = 0;
  t.after(() => clearCallReconnectCleanup(key));

  scheduleCallReconnectCleanup(key, () => { cleanups += 1; }, 35);
  await wait(20);
  scheduleCallReconnectCleanup(key, () => { cleanups += 1; }, 35);
  await wait(20);
  assert.equal(cleanups, 0);
  await wait(25);

  assert.equal(cleanups, 1);
});
