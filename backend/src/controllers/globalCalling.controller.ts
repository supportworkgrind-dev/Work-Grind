import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { CallActivity } from '../models/CallHistory';
import CallSession from '../models/CallSession';
import { CrmContact } from '../models/CrmContact';
import Conversation from '../models/Conversation';
import User from '../models/User';
import { createCallSessionToken } from '../services/callSessionToken';
import { ensureUserCallingId, isValidCallingId, normalizeCallingId } from '../services/callingId';
import { refreshAvatarUrls } from '../services/avatarUrls';
import { emitToUser, getOnlineUsers, hasCallSessionSockets, publishUserPresence, terminateGlobalCall } from '../utils/socket';

const RING_TIMEOUT_MS = 45_000;
const callExpiryTimers = new Map<string, NodeJS.Timeout>();

function clearCallExpiryTimer(sessionId: string): void {
  const timer = callExpiryTimers.get(sessionId);
  if (timer) clearTimeout(timer);
  callExpiryTimers.delete(sessionId);
}

function scheduleCallExpiry(sessionId: string, expiresAt: Date): void {
  clearCallExpiryTimer(sessionId);
  const timer = setTimeout(() => {
    callExpiryTimers.delete(sessionId);
    void CallSession.exists({ sessionId, status: 'ringing', expiresAt: { $lte: new Date() } })
      .then((expired) => expired ? terminateGlobalCall(sessionId, 'missed') : false)
      .catch((error: unknown) => console.error('[Calling] Failed to finalize expired call:', error));
  }, Math.max(0, expiresAt.getTime() - Date.now()));
  timer.unref?.();
  callExpiryTimers.set(sessionId, timer);
}

function auth(req: Request) {
  return (req as AuthRequest).user!;
}

async function publicIdentity(user: { callingId?: string; fullName: string; avatar?: string; avatarStorageKey?: string }) {
  const identity = await refreshAvatarUrls({
    callingId: user.callingId,
    displayName: user.fullName,
    avatar: user.avatar || null,
    avatarStorageKey: user.avatarStorageKey,
  });
  return { callingId: identity.callingId, displayName: identity.displayName, avatar: identity.avatar || null };
}

async function callerMayReachReceiver(caller: any, receiver: any) {
  const privacy = receiver.incomingCallPrivacy || 'everyone';
  if (privacy === 'nobody') return false;
  if (privacy === 'everyone') return true;
  if (privacy !== 'contacts') return false;
  const callerId = caller._id.toString();
  const receiverId = receiver._id.toString();
  const callerContacts = Array.isArray(caller.contacts) ? caller.contacts.map((id: any) => id.toString()) : [];
  const receiverContacts = Array.isArray(receiver.contacts) ? receiver.contacts.map((id: any) => id.toString()) : [];
  const isMutual = callerContacts.includes(receiverId) || receiverContacts.includes(callerId);
  return isMutual;
}

async function eligibleUser(userId: string) {
  const user = await User.findOne({ _id: userId, isActive: true, isDeleted: { $ne: true } })
    .select('_id callingId fullName avatar avatarStorageKey companyId incomingCallPrivacy contacts blockedUsers');
  if (user && !user.callingId) {
    user.callingId = await ensureUserCallingId(user._id);
  }
  return user;
}

function usersHaveBlockedEachOther(first: any, second: any): boolean {
  const firstId = first._id.toString();
  const secondId = second._id.toString();
  const firstBlocked = Array.isArray(first.blockedUsers) && first.blockedUsers.some((id: any) => id.toString() === secondId);
  const secondBlocked = Array.isArray(second.blockedUsers) && second.blockedUsers.some((id: any) => id.toString() === firstId);
  return firstBlocked || secondBlocked;
}

function genericUnavailable(res: Response) {
  res.status(404).json({ success: false, code: 'CALL_UNAVAILABLE', message: 'This WorkGrind ID is unavailable for calls.' });
}

export async function createGlobalCall(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const caller = await eligibleUser(current.userId);
  if (!caller) { res.status(403).json({ success: false, message: 'Your account cannot start calls.' }); return; }

  const callingId = typeof req.body?.callingId === 'string' ? normalizeCallingId(req.body.callingId) : '';
  if (!isValidCallingId(callingId)) {
    res.status(400).json({ success: false, code: 'INVALID_CALLING_ID', message: 'Enter a valid WorkGrind Calling ID.' });
    return;
  }
  const receiver = await User.findOne({ callingId, isActive: true, isDeleted: { $ne: true } })
    .select('_id callingId fullName avatar companyId incomingCallPrivacy contacts blockedUsers');
  if (!receiver || receiver._id.toString() === caller._id.toString() || !(await callerMayReachReceiver(caller, receiver))) {
    genericUnavailable(res);
    return;
  }
  if (usersHaveBlockedEachOther(caller, receiver)) {
    res.status(403).json({ success: false, code: 'CALL_BLOCKED', message: 'This call cannot be placed.' });
    return;
  }
  if (!getOnlineUsers().includes(receiver._id.toString())) {
    res.status(409).json({ success: false, code: 'CALL_RECIPIENT_OFFLINE', message: 'This WorkGrind user is not available right now.' });
    return;
  }

  const crmContactId = typeof req.body?.crmContactId === 'string' ? req.body.crmContactId : '';
  if (crmContactId && (!mongoose.isValidObjectId(crmContactId) || !caller.companyId || !await CrmContact.exists({ _id: crmContactId, companyId: caller.companyId }))) {
    res.status(400).json({ success: false, code: 'INVALID_CRM_CONTACT', message: 'The selected CRM contact is unavailable in your workspace.' });
    return;
  }

  const now = new Date();
  const expiredCalls = await CallSession.find({ status: 'ringing', expiresAt: { $lte: now } }).select('sessionId').lean();
  await Promise.all(expiredCalls.map((call) => {
    clearCallExpiryTimer(call.sessionId);
    return terminateGlobalCall(call.sessionId, 'missed');
  }));
  const expiredAcceptedCalls = await CallSession.find({
    status: 'accepted',
    expiresAt: { $lte: now },
    $or: [
      { callerId: caller._id }, { calleeId: caller._id },
      { callerId: receiver._id }, { calleeId: receiver._id },
    ],
  }).select('sessionId').lean();
  for (const call of expiredAcceptedCalls) {
    if (!await hasCallSessionSockets(call.sessionId)) {
      await terminateGlobalCall(call.sessionId, 'completed');
    }
  }
  const activeCall = await CallSession.exists({
    status: { $in: ['ringing', 'accepted'] },
    $or: [
      { callerId: caller._id }, { calleeId: caller._id },
      { callerId: receiver._id }, { calleeId: receiver._id },
    ],
  });
  if (activeCall) { res.status(409).json({ success: false, code: 'CALL_ALREADY_ACTIVE', message: 'One of these users is already in a call.' }); return; }

  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + RING_TIMEOUT_MS);
  const session = await CallSession.create({
    sessionId,
    callerId: caller._id,
    calleeId: receiver._id,
    status: 'ringing',
    expiresAt,
    startedAt: now,
    crmContactId: crmContactId || undefined,
  });
  scheduleCallExpiry(session.sessionId, expiresAt);
  const callerToken = createCallSessionToken(session.sessionId, caller._id.toString());
  const callerIdentity = await publicIdentity(caller);
  const recipientIdentity = await publicIdentity(receiver);
  emitToUser(receiver._id.toString(), 'call:incoming', {
    sessionId,
    caller: callerIdentity,
    expiresAt,
  });
  await Promise.all([
    publishUserPresence(caller._id.toString()),
    publishUserPresence(receiver._id.toString()),
  ]);
  res.status(201).json({
    success: true,
    sessionId,
    sessionToken: callerToken,
    recipient: recipientIdentity,
    status: session.status,
    expiresAt,
  });
}

export async function acceptGlobalCall(req: Request, res: Response): Promise<void> {
  const userId = auth(req).userId;
  const now = new Date();
  const current = await eligibleUser(userId);
  if (!current) { res.status(403).json({ success: false, message: 'Your account cannot receive calls.' }); return; }
  const pending = await CallSession.findOne({ sessionId: req.params.sessionId, calleeId: userId, status: 'ringing', expiresAt: { $gt: now } });
  if (!pending) { res.status(404).json({ success: false, code: 'CALL_UNAVAILABLE', message: 'This call is no longer available.' }); return; }
  const caller = await eligibleUser(pending.callerId.toString());
  if (!caller || !(await callerMayReachReceiver(caller, current)) || usersHaveBlockedEachOther(caller, current)) {
    clearCallExpiryTimer(pending.sessionId);
    await terminateGlobalCall(pending.sessionId, 'cancelled');
    genericUnavailable(res);
    return;
  }
  const accepted = await CallSession.findOneAndUpdate(
    { _id: pending._id, status: 'ringing', expiresAt: { $gt: now } },
    { $set: { status: 'accepted', acceptedAt: now, answeredAt: now, expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000) } },
    { new: true },
  );
  if (!accepted) { res.status(409).json({ success: false, code: 'CALL_ALREADY_ANSWERED', message: 'This call is no longer available.' }); return; }
  clearCallExpiryTimer(accepted.sessionId);
  const sessionToken = createCallSessionToken(accepted.sessionId, userId);
  const callerIdentity = await publicIdentity(caller);
  emitToUser(caller._id.toString(), 'call:accepted', { sessionId: accepted.sessionId });
  await Promise.all([
    publishUserPresence(caller._id.toString()),
    publishUserPresence(userId),
  ]);
  res.json({ success: true, sessionId: accepted.sessionId, sessionToken, caller: callerIdentity, status: accepted.status });
}

async function closeCall(req: Request, res: Response, nextStatus: 'rejected' | 'cancelled' | 'completed'): Promise<void> {
  const userId = auth(req).userId;
  const now = new Date();
  const session = await CallSession.findOne({ sessionId: req.params.sessionId, $or: [{ callerId: userId }, { calleeId: userId }] });
  if (!session) { res.status(404).json({ success: false, message: 'Call session not found.' }); return; }
  if (['completed', 'missed', 'rejected', 'cancelled', 'declined', 'ended'].includes(session.status)) {
    res.json({ success: true, sessionId: session.sessionId, status: session.status === 'ended' ? 'completed' : session.status === 'declined' ? 'rejected' : session.status });
    return;
  }
  const validTransition = nextStatus === 'rejected'
    ? session.calleeId.toString() === userId && session.status === 'ringing'
    : nextStatus === 'cancelled'
      ? session.callerId.toString() === userId && session.status === 'ringing'
      : session.status === 'accepted';
  if (!validTransition) { res.status(409).json({ success: false, message: 'This call can no longer be changed.' }); return; }

  clearCallExpiryTimer(session.sessionId);
  const transitioned = await terminateGlobalCall(session.sessionId, nextStatus);
  let finalStatus: string = nextStatus;
  if (!transitioned) {
    const latest = await CallSession.findById(session._id).select('status');
    if (!latest || !['completed', 'missed', 'rejected', 'cancelled', 'declined', 'ended'].includes(latest.status)) {
    res.status(409).json({ success: false, message: 'This call can no longer be changed.' });
    return;
    }
    finalStatus = latest.status === 'ended' ? 'completed' : latest.status === 'declined' ? 'rejected' : latest.status;
  }
  res.json({ success: true, sessionId: session.sessionId, status: finalStatus });
}

export async function declineGlobalCall(req: Request, res: Response): Promise<void> { await closeCall(req, res, 'rejected'); }
export async function cancelGlobalCall(req: Request, res: Response): Promise<void> { await closeCall(req, res, 'cancelled'); }
export async function endGlobalCall(req: Request, res: Response): Promise<void> { await closeCall(req, res, 'completed'); }

export async function refreshCallSessionToken(req: Request, res: Response): Promise<void> {
  const userId = auth(req).userId;
  const user = await eligibleUser(userId);
  const session = await CallSession.findOne({
    sessionId: req.params.sessionId,
    status: 'accepted',
    $or: [{ callerId: userId }, { calleeId: userId }],
  });
  if (!user || !session) { res.status(404).json({ success: false, message: 'Active call session not found.' }); return; }
  res.json({ success: true, sessionId: session.sessionId, sessionToken: createCallSessionToken(session.sessionId, userId) });
}

export async function listCallHistory(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
  const skip = (page - 1) * limit;
  const sessionFilter = { $or: [{ callerId: current.userId }, { calleeId: current.userId }] };
  const globalOnly = req.query.source === 'global';
  const activityFilter = !globalOnly && current.companyId ? { companyId: current.companyId } : null;
  const now = new Date();
  const expiredCalls = await CallSession.find({ ...sessionFilter, status: 'ringing', expiresAt: { $lte: now } }).select('sessionId').lean();
  await Promise.all(expiredCalls.map((call) => {
    clearCallExpiryTimer(call.sessionId);
    return terminateGlobalCall(call.sessionId, 'missed');
  }));

  const [sessions, sessionTotal, activities, activityTotal] = await Promise.all([
    CallSession.find(sessionFilter).populate('callerId', 'callingId fullName avatar avatarStorageKey').populate('calleeId', 'callingId fullName avatar avatarStorageKey').populate('crmContactId', 'firstName lastName').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CallSession.countDocuments(sessionFilter),
    activityFilter ? CallActivity.find(activityFilter).populate('contactId', 'firstName lastName').populate('teammateId', 'fullName').populate('createdBy', 'fullName').sort({ calledAt: -1 }).limit(limit).lean() : [],
    activityFilter ? CallActivity.countDocuments(activityFilter) : 0,
  ]);
  const callRows = await Promise.all(sessions.map(async (item: any) => {
    const asCaller = item.callerId?._id?.toString() === current.userId;
    const other = asCaller ? item.calleeId : item.callerId;
    return {
      kind: 'workgrind-call',
      sessionId: item.sessionId,
      direction: asCaller ? 'outgoing' : 'incoming',
      status: item.status === 'ended' ? 'completed' : item.status === 'declined' ? 'rejected' : item.status,
      calledAt: item.createdAt,
      createdAt: item.createdAt,
      startedAt: item.startedAt || item.createdAt,
      answeredAt: item.answeredAt || item.acceptedAt || null,
      endedAt: item.endedAt || null,
      durationSeconds: item.durationSeconds || 0,
      peer: other ? await publicIdentity(other) : null,
      crmContact: asCaller && item.crmContactId ? { name: `${item.crmContactId.firstName} ${item.crmContactId.lastName}`.trim() } : null,
    };
  }));
  const legacyRows = activities.map((item: any) => ({
    kind: 'crm-call-note',
    direction: item.direction,
    status: item.outcome,
    calledAt: item.calledAt,
    durationMinutes: item.durationMinutes || 0,
    notes: item.notes || '',
    contact: item.contactId ? { name: `${item.contactId.firstName} ${item.contactId.lastName}`.trim() } : null,
    teammate: item.teammateId?.fullName || null,
    recordedBy: item.createdBy?.fullName || null,
  }));
  const rows = [...callRows, ...legacyRows].sort((left, right) => new Date(right.calledAt).getTime() - new Date(left.calledAt).getTime());
  res.json({
    success: true,
    data: globalOnly ? callRows : rows.slice(0, limit),
    pagination: { page, limit, total: globalOnly ? sessionTotal : sessionTotal + activityTotal },
  });
}

export async function createCrmCallNote(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthRequest;
  if (!authReq.user?.companyId) { res.status(403).json({ success: false, message: 'Workspace membership is required to link CRM call notes.' }); return; }
  const { direction, outcome, contactId, teammateId, calledAt, durationMinutes, notes } = req.body || {};
  if (!['incoming', 'outgoing'].includes(direction) || !['answered', 'missed', 'outgoing'].includes(outcome) ||
      (direction === 'incoming' && !['answered', 'missed'].includes(outcome)) || (direction === 'outgoing' && outcome !== 'outgoing') ||
      Number.isNaN(Date.parse(calledAt)) || (durationMinutes !== undefined && (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440)) ||
      (notes !== undefined && (typeof notes !== 'string' || notes.length > 3000))) {
    res.status(400).json({ success: false, message: 'Provide a valid manual call direction, outcome, date, and optional notes.' });
    return;
  }
  if (contactId && (!mongoose.isValidObjectId(contactId) || !await CrmContact.exists({ _id: contactId, companyId: authReq.user.companyId }))) {
    res.status(400).json({ success: false, message: 'The selected CRM contact is not available in this workspace.' });
    return;
  }
  if (teammateId && (!mongoose.isValidObjectId(teammateId) || !await User.exists({ _id: teammateId, companyId: authReq.user.companyId, isActive: true }))) {
    res.status(400).json({ success: false, message: 'The selected teammate is not available in this workspace.' });
    return;
  }
  const entry = await CallActivity.create({
    companyId: authReq.user.companyId,
    createdBy: authReq.user.userId,
    direction,
    outcome,
    contactId: contactId || undefined,
    teammateId: teammateId || undefined,
    calledAt: new Date(calledAt),
    durationMinutes,
    notes: notes?.trim() || '',
  });
  res.status(201).json({ success: true, data: { kind: 'crm-call-note', direction: entry.direction, status: entry.outcome, calledAt: entry.calledAt, durationMinutes: entry.durationMinutes || 0, notes: entry.notes } });
}
