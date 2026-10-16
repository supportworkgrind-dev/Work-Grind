const assert = require('node:assert/strict');
const test = require('node:test');
const { isOAuthCallbackRequest } = require('../dist/utils/requestLogging');

test('OAuth provider callback request URLs are excluded from access logs', () => {
  for (const provider of ['google', 'linkedin', 'apple']) {
    assert.equal(
      isOAuthCallbackRequest(`/api/auth/oauth/${provider}/callback?code=one-time&state=opaque`),
      true,
    );
    assert.equal(
      isOAuthCallbackRequest(`/auth/oauth/${provider}/callback?code=one-time&state=opaque`),
      true,
    );
  }
  assert.equal(isOAuthCallbackRequest('/api/auth/oauth/google/start?intent=login'), false);
  assert.equal(isOAuthCallbackRequest('/api/auth/login'), false);
});
