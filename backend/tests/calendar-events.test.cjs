const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const CalendarEvent = require('../dist/models/CalendarEvent').default;
const Task = require('../dist/models/Task').default;
const Meeting = require('../dist/models/Meeting').default;
const calendarController = require('../dist/controllers/calendar.controller');

const companyId = new mongoose.Types.ObjectId().toString();

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function query(rows, calls) {
  const chain = {
    populate(...args) { calls.push(['populate', ...args]); return chain; },
    select(fields) { calls.push(['select', fields]); return chain; },
    sort() { return chain; },
    lean() { calls.push(['lean']); return Promise.resolve(rows); },
  };
  return chain;
}

function replace(model, name, implementation) {
  const original = model[name];
  model[name] = implementation;
  return () => { model[name] = original; };
}

const user = { userId: new mongoose.Types.ObjectId().toString(), companyId, role: 'owner', organizationType: 'business', accountType: 'company' };

test('calendar limits tasks and meetings to the requested range and reads lean, projected documents', async () => {
  const filters = {};
  const calls = { events: [], tasks: [], meetings: [] };
  const due = new Date('2026-10-15T00:00:00.000Z');
  const restore = [
    replace(CalendarEvent, 'find', (filter) => { filters.events = filter; return query([{ _id: 'e1', title: 'Planning', startDate: new Date('2026-10-02T09:00:00Z') }], calls.events); }),
    replace(Task, 'find', (filter) => { filters.tasks = filter; return query([{ _id: 't1', companyId, title: 'Ship', priority: 'urgent', status: 'todo', dueDate: due }], calls.tasks); }),
    replace(Meeting, 'find', (filter) => { filters.meetings = filter; return query([{ _id: 'm1', companyId, title: 'Sync', scheduledAt: new Date('2026-10-20T10:00:00Z'), duration: 30, participants: [{ userId: 'u1' }] }], calls.meetings); }),
  ];
  try {
    const res = makeResponse();
    await calendarController.getEvents({ user, query: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' } }, res);
    assert.equal(res.statusCode, 200);
    const range = { $gte: new Date('2026-10-01T00:00:00.000Z'), $lte: new Date('2026-10-31T23:59:59.999Z') };
    assert.deepEqual(filters.events.startDate, range);
    assert.deepEqual(filters.tasks.dueDate, range, 'tasks outside the visible range are not loaded');
    assert.deepEqual(filters.meetings.scheduledAt, range, 'meetings outside the visible range are not loaded');
    assert.equal(filters.tasks.companyId, companyId);
    assert.equal(filters.meetings.companyId, companyId);
    for (const list of Object.values(calls)) assert.ok(list.some(([name]) => name === 'lean'));
    assert.ok(calls.tasks.some(([name, fields]) => name === 'select' && !fields.includes('comments')), 'task comments and subtasks are not read');
    assert.deepEqual(res.body.events.map((event) => event._id), ['e1', 'task-t1', 'meeting-m1']);
    assert.equal(res.body.events[1].color, '#e11d48');
    assert.deepEqual(res.body.events[2].attendees, ['u1']);
    assert.equal(new Date(res.body.events[2].endDate).toISOString(), '2026-10-20T10:30:00.000Z');
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test('calendar rejects invalid range dates instead of querying with them', async () => {
  let queried = false;
  const restore = [replace(CalendarEvent, 'find', () => { queried = true; return query([], []); })];
  try {
    const res = makeResponse();
    await calendarController.getEvents({ user, query: { start: 'not-a-date', end: '2026-10-31' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(queried, false);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});
