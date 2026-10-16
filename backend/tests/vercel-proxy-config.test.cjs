const assert = require('node:assert/strict');
const test = require('node:test');

process.env.VERCEL = '1';
const app = require('../dist/index').default;

test('Vercel trusts only the nearest proxy hop for rate-limit client IPs', () => {
  const trustProxy = app.get('trust proxy');

  assert.equal(trustProxy, 1);
  assert.notEqual(trustProxy, true);
});
