const assert = require('node:assert/strict');
const test = require('node:test');

test('Tavro publishes ready state only through the awaited LiveKit participant update', async () => {
  const { publishTavroReady } = await import('../dist/readiness.js');
  const updates = [];
  let completeUpdate;
  const publisher = {
    setAttributes(attributes) {
      updates.push(attributes);
      return new Promise((resolve) => {
        completeUpdate = resolve;
      });
    },
  };

  let readySignalPublished = false;
  const publication = publishTavroReady(publisher).then(() => {
    readySignalPublished = true;
  });

  assert.deepEqual(updates, [{
    'lk.agent.state': 'listening',
    'workgrind.tavro.ready': 'true',
  }]);
  assert.equal(readySignalPublished, false);
  completeUpdate();
  await publication;
  assert.equal(readySignalPublished, true);
});

test('a failed LiveKit readiness update rejects startup instead of reporting ready', async () => {
  const { publishTavroReady } = await import('../dist/readiness.js');
  const error = new Error('LiveKit rejected participant attributes');
  const publisher = {
    async setAttributes() {
      throw error;
    },
  };

  await assert.rejects(publishTavroReady(publisher), error);
});
