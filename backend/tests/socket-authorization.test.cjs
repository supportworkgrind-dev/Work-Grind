const assert = require('node:assert/strict');
const test = require('node:test');
const {
  canSocketAccessFeature,
  socketEventFeature,
  socketUserEventFeature,
} = require('../dist/utils/socketAuthorization');

const allEntitlements = {
  teamChat: true,
  meetingsCalendar: true,
  advancedAnalytics: true,
};

test('socket events use the organization feature policies and persisted role', () => {
  assert.equal(socketEventFeature('channel:join'), 'educationCommunication');
  assert.equal(socketEventFeature('call:join'), 'globalCalling');
  assert.equal(socketEventFeature('meeting:join'), 'educationMeetings');
  assert.equal(socketEventFeature('board:join'), 'workspaceContent');
  assert.equal(socketEventFeature('channel:leave'), undefined);

  assert.equal(canSocketAccessFeature({
    organizationType: 'business', accountType: 'company', role: 'employee',
  }, 'educationCommunication', allEntitlements), true);
  assert.equal(canSocketAccessFeature({
    organizationType: 'business', accountType: 'company', role: 'employee',
  }, 'globalCalling', allEntitlements), true);
  assert.equal(canSocketAccessFeature({
    organizationType: 'business', accountType: 'individual', role: 'owner',
  }, 'educationCommunication', allEntitlements), false);
  assert.equal(canSocketAccessFeature({
    organizationType: 'school', accountType: 'company', role: 'teacher',
  }, 'educationCommunication', allEntitlements), true);
  assert.equal(canSocketAccessFeature({
    organizationType: 'school', accountType: 'company', role: 'teacher',
  }, 'globalCalling', allEntitlements), false);
  assert.equal(canSocketAccessFeature({
    organizationType: 'business', accountType: 'company', role: 'guest',
  }, 'globalCalling', allEntitlements), false);
  assert.equal(canSocketAccessFeature({
    organizationType: 'business', accountType: 'company', role: 'employee',
  }, 'educationCommunication', { teamChat: false }), false);
  assert.equal(canSocketAccessFeature({}, 'educationCommunication', allEntitlements), false);
});

test('user-targeted realtime events are delivered only to sockets with matching features', () => {
  assert.equal(socketUserEventFeature('call:incoming'), 'globalCalling');
  assert.equal(socketUserEventFeature('dm:notification'), 'educationCommunication');
  assert.equal(socketUserEventFeature('meeting:started'), 'educationMeetings');
  assert.equal(socketUserEventFeature('user:presence'), 'educationCommunication');
  assert.equal(socketUserEventFeature('security:notice'), undefined);
});
