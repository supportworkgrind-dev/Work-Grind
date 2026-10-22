const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Meeting = require('../dist/models/Meeting').default;
const MeetingAccessGrant = require('../dist/models/MeetingAccessGrant').default;
const User = require('../dist/models/User').default;
const socket = require('../dist/utils/socket');
const {
  createMeeting,
  getActiveMeetings,
  getMeetingByLink,
  joinMeeting,
  startMeeting,
} = require('../dist/controllers/meeting.controller');
const {
  isMeetingInactive,
  isScheduledMeetingLinkExpired,
  MEETING_DISCONNECT_GRACE_MS,
  MEETING_LINK_TTL_MS,
} = require('../dist/utils/meetingLifecycle');

const companyId = new mongoose.Types.ObjectId();
const hostId = new mongoose.Types.ObjectId();

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    set() { return this; },
  };
}

function replace(target, key, implementation) {
  const original = target[key];
  target[key] = implementation;
  return () => { target[key] = original; };
}

function fakeMeeting(overrides = {}) {
  const now = Date.now();
  const meeting = {
    _id: new mongoose.Types.ObjectId(),
    companyId,
    hostId: { _id: hostId, fullName: 'Host' },
    title: 'Workspace meeting',
    description: '',
    participants: [],
    meetingLink: `meeting-link-${new mongoose.Types.ObjectId()}`,
    status: 'active',
    startedAt: new Date(now),
    lastActivityAt: new Date(now),
    scheduledAt: new Date(now),
    createdAt: new Date(now),
    async populate() { return this; },
    async save() { return this; },
    toObject() {
      return {
        ...this,
        hostId: this.hostId,
        participants: this.participants.map((participant) => ({
          ...participant,
          userId: participant.userId && typeof participant.userId === 'object' && '_id' in participant.userId
            ? participant.userId
            : { _id: participant.userId, fullName: 'Member' },
        })),
      };
    },
    ...overrides,
  };
  return meeting;
}

function request(link = 'meeting-link', user = {}) {
  return {
    params: { link },
    query: {},
    body: {},
    headers: {},
    get(name) { return this.headers[name.toLowerCase()]; },
    user: {
      userId: hostId.toString(),
      companyId: companyId.toString(),
      ...user,
    },
  };
}

function mockMeetingUser(userId = hostId, company = companyId) {
  return replace(User, 'findOne', () => ({
    select() {
      return { lean: async () => ({ _id: userId, companyId: company, fullName: 'Host' }) };
    },
  }));
}

test('active meeting links do not expire solely because they ran longer than 24 hours', async () => {
  const meeting = fakeMeeting({
    startedAt: new Date(Date.now() - MEETING_LINK_TTL_MS - 60_000),
    lastActivityAt: new Date(),
  });
  const restore = [
    mockMeetingUser(),
    replace(Meeting, 'findOne', async () => meeting),
  ];
  try {
    const res = response();
    await getMeetingByLink(request(meeting.meetingLink), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.meeting.status, 'active');
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('scheduled, expired, ended, cancelled, and invalid links have distinct outcomes', async () => {
  const cases = [
    {
      meeting: fakeMeeting({ status: 'scheduled', scheduledAt: new Date(Date.now() - MEETING_LINK_TTL_MS - 1) }),
      code: 410,
      message: 'This meeting link has expired.',
    },
    { meeting: fakeMeeting({ status: 'ended' }), code: 410, message: 'This meeting has ended.' },
    { meeting: fakeMeeting({ status: 'cancelled' }), code: 410, message: 'This meeting was cancelled.' },
    { meeting: null, code: 404, message: 'Meeting not found' },
  ];

  for (const expected of cases) {
    const restore = [
      mockMeetingUser(),
      replace(Meeting, 'findOne', async () => expected.meeting),
    ];
    try {
      const res = response();
      await getMeetingByLink(request(expected.meeting?.meetingLink), res);
      assert.equal(res.statusCode, expected.code);
      assert.equal(res.body.message, expected.message);
    } finally {
      restore.reverse().forEach((undo) => undo());
    }
  }
});

test('joining a copied active link creates a grant and refreshes the meeting activity timestamp', async () => {
  const meeting = fakeMeeting({ participants: [] });
  const originalGrantCreate = MeetingAccessGrant.create;
  let grantRecord;
  MeetingAccessGrant.create = async (record) => { grantRecord = record; };
  const restore = [
    mockMeetingUser(),
    replace(Meeting, 'findOne', async () => meeting),
    replace(socket, 'emitToUser', () => undefined),
  ];
  const before = Date.now();
  try {
    const res = response();
    await joinMeeting(request(meeting.meetingLink), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.meetingGrant, 'string');
    assert.equal(meeting.participants.length, 1);
    assert.equal(meeting.participants[0].userId.toString(), hostId.toString());
    assert.ok(meeting.lastActivityAt.getTime() >= before);
    assert.equal(grantRecord.userId, hostId.toString());
  } finally {
    MeetingAccessGrant.create = originalGrantCreate;
    restore.reverse().forEach((undo) => undo());
  }
});

test('a participant cannot join a meeting link from another workspace', async () => {
  const otherCompanyId = new mongoose.Types.ObjectId();
  let lookupFilter;
  const restore = [
    replace(User, 'findOne', () => ({
      select() {
        return {
          lean: async () => ({ _id: hostId, companyId: otherCompanyId, fullName: 'Host' }),
        };
      },
    })),
    replace(Meeting, 'findOne', async (filter) => {
      lookupFilter = filter;
      return null;
    }),
  ];
  try {
    const res = response();
    await joinMeeting(request('foreign-meeting-link', { companyId: otherCompanyId.toString() }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(lookupFilter.companyId.toString(), otherCompanyId.toString());
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('only the meeting host in the owning workspace can start it', async () => {
  const otherUserId = new mongoose.Types.ObjectId();
  const meeting = fakeMeeting();
  const restore = [
    replace(Meeting, 'findOne', async () => meeting),
  ];
  try {
    const res = response();
    await startMeeting(request(meeting.meetingLink, { userId: otherUserId.toString() }), res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Only the meeting host/);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('meeting creation is idempotent for a request key and rejects reuse for another payload', async () => {
  const meeting = fakeMeeting({
    status: 'active',
    idempotencyKeyHash: undefined,
    idempotencyPayloadHash: undefined,
  });
  const originalGrantCreate = MeetingAccessGrant.create;
  let createCount = 0;
  let lookupCount = 0;
  MeetingAccessGrant.create = async () => ({});
  const restore = [
    replace(Meeting, 'findOne', async () => (++lookupCount === 1 ? null : meeting)),
    replace(Meeting, 'create', async (record) => {
      createCount += 1;
      meeting.idempotencyKeyHash = record.idempotencyKeyHash;
      meeting.idempotencyPayloadHash = record.idempotencyPayloadHash;
      return meeting;
    }),
    replace(socket, 'emitToUser', () => undefined),
  ];
  const makeRequest = (title = 'Instant meeting') => ({
    ...request(),
    body: { title, isInstant: true },
    headers: { 'idempotency-key': 'meeting-request-key-0001' },
  });
  try {
    const first = response();
    await createMeeting(makeRequest(), first);
    assert.equal(first.statusCode, 201);
    const retry = response();
    await createMeeting(makeRequest(), retry);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body.meeting.meetingLink, meeting.meetingLink);
    assert.equal(createCount, 1);

    const conflicting = response();
    await createMeeting(makeRequest('Different meeting'), conflicting);
    assert.equal(conflicting.statusCode, 409);
    assert.equal(createCount, 1);
  } finally {
    MeetingAccessGrant.create = originalGrantCreate;
    restore.reverse().forEach((undo) => undo());
  }
});

test('active meeting counts require a live room and count users rather than sockets', async () => {
  const live = fakeMeeting();
  const stale = fakeMeeting({
    lastActivityAt: new Date(Date.now() - MEETING_DISCONNECT_GRACE_MS - 1),
  });
  let updateCalls = 0;
  let activeFilter;
  const restore = [
    replace(socket, 'getIO', () => ({ to: () => ({ emit() {} }) })),
    replace(socket, 'getMeetingParticipants', async (link) =>
      link === live.meetingLink
        ? [{ userId: hostId.toString() }, { userId: hostId.toString() }]
        : []),
    replace(Meeting, 'find', (filter) => {
      activeFilter = filter;
      return {
      sort() { return this; },
      limit() { return this; },
      populate() { return this; },
      exec: async () => [live, stale],
      };
    }),
    replace(Meeting, 'findOneAndUpdate', async (filter, update) => {
      updateCalls += 1;
      stale.status = update.$set.status;
      stale.endedAt = update.$set.endedAt;
      stale.duration = update.$set.duration;
      return stale;
    }),
    replace(socket, 'emitToUser', () => undefined),
  ];
  try {
    const res = response();
    await getActiveMeetings(request(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.meetings.length, 1);
    assert.equal(res.body.meetings[0]._id.toString(), live._id.toString());
    assert.equal(res.body.meetings[0].activeParticipantCount, 1);
    assert.equal(activeFilter.companyId, companyId.toString());
    assert.equal(stale.status, 'ended');
    assert.equal(updateCalls, 1);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('stale active meetings are reconciled even when no Socket.IO instance is available', async () => {
  const stale = fakeMeeting({
    lastActivityAt: new Date(Date.now() - MEETING_DISCONNECT_GRACE_MS - 1),
  });
  const restore = [
    replace(socket, 'getIO', () => undefined),
    replace(socket, 'getMeetingParticipants', async () => []),
    replace(Meeting, 'find', () => ({
      sort() { return this; },
      limit() { return this; },
      populate() { return this; },
      exec: async () => [stale],
    })),
    replace(Meeting, 'findOneAndUpdate', async (_filter, update) => {
      stale.status = update.$set.status;
      stale.endedAt = update.$set.endedAt;
      return stale;
    }),
    replace(socket, 'emitToUser', () => undefined),
  ];
  try {
    const res = response();
    await getActiveMeetings(request(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.meetings, []);
    assert.equal(stale.status, 'ended');
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('meeting activity and scheduled link expiration use separate clocks', () => {
  const now = Date.now();
  assert.equal(isScheduledMeetingLinkExpired({
    status: 'scheduled',
    scheduledAt: new Date(now - MEETING_LINK_TTL_MS - 1),
  }, now), true);
  assert.equal(isScheduledMeetingLinkExpired({
    status: 'active',
    scheduledAt: new Date(now - MEETING_LINK_TTL_MS - 1),
  }, now), false);
  assert.equal(isMeetingInactive({
    lastActivityAt: new Date(now - MEETING_DISCONNECT_GRACE_MS - 1),
  }, now), true);
  assert.equal(isMeetingInactive({ lastActivityAt: new Date(now) }, now), false);
});

test('idempotency key index is unique only for requests that provide a key', () => {
  const idempotencyIndex = Meeting.schema.indexes().find(([keys]) => keys.idempotencyKeyHash === 1);
  assert.ok(idempotencyIndex);
  assert.equal(idempotencyIndex[1].unique, true);
  assert.deepEqual(idempotencyIndex[1].partialFilterExpression, {
    idempotencyKeyHash: { $type: 'string' },
  });
});
