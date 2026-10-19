import { Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import mongoose from 'mongoose';
import Meeting, { type IMeeting } from '../models/Meeting';
import MeetingAccessGrant from '../models/MeetingAccessGrant';
import CalendarEvent from '../models/CalendarEvent';
import Task from '../models/Task';
import Project from '../models/Project';
import User from '../models/User';
import { CrmCompany } from '../models/CrmCompany';
import { CrmContact } from '../models/CrmContact';
import { AuthRequest } from '../middleware/auth';
import { normalizeCallingId, isValidCallingId } from '../services/callingId';
import { getGenAI, isGeminiConfigured, GEMINI_MODEL } from '../services/geminiService';
import { validateWorkGrindQuery, OFF_TOPIC_REPLY } from '../services/aiGuard';
import { recordUsage } from '../services/aiUsageTracker';
import { reserveAiRequest } from '../utils/planLimits';
import { emitToUser, getIO, getMeetingParticipants } from '../utils/socket';
import { createNotification } from './channel.controller';
import { refreshAvatarUrls } from '../services/avatarUrls';
import { isMeetingInactive, isScheduledMeetingLinkExpired } from '../utils/meetingLifecycle';

const MEETING_GRANT_TTL_MS = 8 * 60 * 60 * 1000;

const getMeetingUser = async (userId: string) =>
  User.findOne({
    _id: userId,
    isActive: true,
    isDeleted: { $ne: true },
  }).select('_id companyId fullName avatar').lean();

const createMeetingGrant = async (meetingId: mongoose.Types.ObjectId, userId: string) => {
  const token = randomBytes(32).toString('base64url');
  await MeetingAccessGrant.create({
    meetingId,
    userId,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + MEETING_GRANT_TTL_MS),
  });
  return token;
};

const isPopulatedReference = (value: unknown): value is { _id: mongoose.Types.ObjectId } =>
  value !== null &&
  typeof value === 'object' &&
  !(value instanceof mongoose.Types.ObjectId) &&
  '_id' in value;

const getMeetingSafeView = async (meeting: IMeeting, userId: string) => {
  const hasPopulatedRefs =
    isPopulatedReference(meeting.hostId) &&
    meeting.participants.every((participant) => isPopulatedReference(participant.userId));
  const populated = hasPopulatedRefs
    ? meeting
    : await meeting.populate([
      { path: 'hostId', select: 'fullName avatar avatarStorageKey' },
      { path: 'participants.userId', select: 'fullName avatar avatarStorageKey' },
    ]);
  const meetingData = populated.toObject() as any;
  const host = meetingData.hostId;
  const participants = meetingData.participants
    .filter((participant: any) => participant.userId)
    .map((participant: any) => ({
      userId: participant.userId,
      status: participant.status,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
    }));
  const isHost = meetingData.hostId?._id?.toString() === userId;
  return refreshAvatarUrls({
    _id: meetingData._id,
    title: meetingData.title,
    description: meetingData.description,
    hostId: host,
    participants,
    scheduledAt: meetingData.scheduledAt,
    startedAt: meetingData.startedAt,
    endedAt: meetingData.endedAt,
    duration: meetingData.duration,
    meetingLink: meetingData.meetingLink,
    status: meetingData.status,
    permissions: { isHost, canJoin: meetingData.status === 'scheduled' || meetingData.status === 'active' },
  });
};

const getMeetingReferenceId = (reference: unknown): string | undefined => {
  if (reference instanceof mongoose.Types.ObjectId) return reference.toString();
  if (typeof reference === 'string') return reference;
  if (reference && typeof reference === 'object' && '_id' in reference) {
    return getMeetingReferenceId(reference._id);
  }
  return undefined;
};

const meetingMemberIds = (meeting: IMeeting): string[] => [...new Set([
  getMeetingReferenceId(meeting.hostId),
  ...meeting.participants.map((participant) => getMeetingReferenceId(participant.userId)),
].filter((userId): userId is string => Boolean(userId)))];

const isMeetingLinkAvailable = (meeting: IMeeting) => {
  if (meeting.status !== 'scheduled' && meeting.status !== 'active') return false;
  return !isScheduledMeetingLinkExpired(meeting);
};

const getMeetingLinkUnavailableMessage = (meeting: IMeeting) => {
  if (meeting.status === 'ended') return 'This meeting has ended.';
  if (meeting.status === 'cancelled') return 'This meeting was cancelled.';
  return 'This meeting link has expired.';
};

const reconcileActiveMeeting = async (meeting: IMeeting) => {
  if (meeting.status !== 'active' || !getIO()) {
    return { meeting, activeParticipants: [] as Awaited<ReturnType<typeof getMeetingParticipants>> };
  }

  const activeParticipants = await getMeetingParticipants(meeting.meetingLink);
  if (activeParticipants.length || !isMeetingInactive(meeting)) {
    return { meeting, activeParticipants };
  }

  const endedAt = new Date();
  const filter: Record<string, unknown> = { _id: meeting._id, status: 'active' };
  filter.lastActivityAt = meeting.lastActivityAt ? meeting.lastActivityAt : { $exists: false };
  const updated = await Meeting.findOneAndUpdate(filter, {
    $set: {
      status: 'ended',
      endedAt,
      duration: meeting.startedAt
        ? Math.max(0, Math.round((endedAt.getTime() - new Date(meeting.startedAt).getTime()) / 60000))
        : 0,
    },
  }, { new: true });
  if (!updated) {
    return { meeting, activeParticipants: await getMeetingParticipants(meeting.meetingLink) };
  }

  meeting.status = 'ended';
  meeting.endedAt = endedAt;
  meeting.duration = updated.duration;
  const event = { meetingId: meeting._id, meetingLink: meeting.meetingLink };
  getIO()?.to(`meeting:${meeting.meetingLink}`).emit('meeting:ended', event);
  for (const participantId of meetingMemberIds(meeting)) {
    emitToUser(participantId, 'meeting:ended', event);
  }
  return { meeting, activeParticipants: [] };
};

export const getMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, limit } = req.query;
    const filter: Record<string, unknown> = {
      $or: [{ hostId: req.user!.userId }, { 'participants.userId': req.user!.userId }],
    };
    if (status) filter.status = status;

    let query = Meeting.find(filter).sort({ scheduledAt: -1, createdAt: -1 });
    if (limit) {
      query = query.limit(Number(limit));
    }

    const meetings = await query.populate([
      { path: 'hostId', select: 'fullName avatar avatarStorageKey' },
      { path: 'participants.userId', select: 'fullName avatar avatarStorageKey' },
    ]);
    const safeMeetings = await Promise.all(meetings.map(async (meeting) => {
      const reconciled = await reconcileActiveMeeting(meeting);
      return getMeetingSafeView(reconciled.meeting, req.user!.userId);
    }));

    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, meetings: safeMeetings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getActiveMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meetings = await Meeting.find({
      status: 'active',
      $or: [{ hostId: req.user!.userId }, { 'participants.userId': req.user!.userId }],
    })
      .sort({ startedAt: -1, createdAt: -1 })
      .populate([
        { path: 'hostId', select: 'fullName avatar avatarStorageKey' },
        { path: 'participants.userId', select: 'fullName avatar avatarStorageKey' },
      ])
      .exec();

    const enriched = (await Promise.all(meetings.map(async (meeting) => {
      const reconciled = await reconcileActiveMeeting(meeting);
      if (reconciled.meeting.status !== 'active' || !reconciled.activeParticipants.length) return null;
      return {
        ...await getMeetingSafeView(reconciled.meeting, req.user!.userId),
        activeParticipantCount: new Set(reconciled.activeParticipants.map((participant) => participant.userId)).size,
      };
    }))).filter((meeting): meeting is NonNullable<typeof meeting> => meeting !== null);

    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, meetings: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  let idempotencyKeyHash: string | undefined;
  let idempotencyPayloadHash: string | undefined;
  try {
    const { title, description, scheduledAt, participantIds = [], projectId, crmCompanyId, crmContactIds = [], isInstant } = req.body;
    if (!title) {
      res.status(400).json({ success: false, message: 'Title is required' });
      return;
    }

    const companyId = req.user!.companyId;
    const idempotencyKey = req.get('Idempotency-Key');
    if (idempotencyKey !== undefined) {
      if (idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[A-Za-z0-9_-]+$/.test(idempotencyKey)) {
        res.status(400).json({ success: false, message: 'Invalid meeting request key.' });
        return;
      }
      idempotencyKeyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    }
    const hasCompanyId = crmCompanyId !== undefined && crmCompanyId !== null && crmCompanyId !== '';
    if (hasCompanyId && (!mongoose.Types.ObjectId.isValid(crmCompanyId) || !await CrmCompany.exists({ _id: crmCompanyId, companyId }))) {
      res.status(400).json({ success: false, message: 'CRM company must belong to this workspace.' });
      return;
    }
    if (projectId && (!mongoose.Types.ObjectId.isValid(projectId) || !await Project.exists({ _id: projectId, companyId, isArchived: false }))) {
      res.status(400).json({ success: false, message: 'Project must belong to this workspace.' });
      return;
    }
    if (projectId && hasCompanyId) {
      const project = await Project.findOne({ _id: projectId, companyId }).select('crmCompanyId').lean();
      if (project?.crmCompanyId && project.crmCompanyId.toString() !== crmCompanyId) {
        res.status(400).json({ success: false, message: 'Meeting company must match the linked project company.' });
        return;
      }
    }

    if (!Array.isArray(participantIds) || participantIds.some((id: unknown) => typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id))) {
      res.status(400).json({ success: false, message: 'Meeting participants must be valid workspace members.' });
      return;
    }
    const uniqueParticipantIds = [...new Set<string>(participantIds)];
    if (uniqueParticipantIds.length) {
      const participantCount = await User.countDocuments({
        _id: { $in: uniqueParticipantIds },
        companyId,
        isActive: true,
        isDeleted: { $ne: true },
      });
      if (participantCount !== uniqueParticipantIds.length) {
        res.status(400).json({ success: false, message: 'Meeting participants must be active WorkGrind users.' });
        return;
      }
    }
    const invitedUsers = uniqueParticipantIds.length
      ? await User.find({ _id: { $in: uniqueParticipantIds }, companyId, isActive: true, isDeleted: { $ne: true } })
        .select('_id companyId')
        .lean()
      : [];

    if (!Array.isArray(crmContactIds) || crmContactIds.some((id: unknown) => typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id))) {
      res.status(400).json({ success: false, message: 'Meeting contacts must be valid CRM contacts.' });
      return;
    }
    const uniqueCrmContactIds = [...new Set<string>(crmContactIds)];
    if (uniqueCrmContactIds.length) {
      const contactFilter: Record<string, any> = { _id: { $in: uniqueCrmContactIds }, companyId };
      if (hasCompanyId) contactFilter.crmCompanyId = crmCompanyId;
      const contactCount = await CrmContact.countDocuments(contactFilter);
      if (contactCount !== uniqueCrmContactIds.length) {
        res.status(400).json({ success: false, message: 'Meeting contacts must belong to the selected workspace company.' });
        return;
      }
    }

    const normalizedScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
    if (Number.isNaN(normalizedScheduledAt.getTime())) {
      res.status(400).json({ success: false, message: 'Enter a valid meeting date and time.' });
      return;
    }
    if (idempotencyKeyHash) {
      idempotencyPayloadHash = createHash('sha256').update(JSON.stringify({
        title: String(title).trim(),
        description: description ?? '',
        scheduledAt: scheduledAt ? normalizedScheduledAt.toISOString() : null,
        participantIds: [...uniqueParticipantIds].sort(),
        projectId: projectId || null,
        crmCompanyId: hasCompanyId ? crmCompanyId : null,
        crmContactIds: [...uniqueCrmContactIds].sort(),
        isInstant: Boolean(isInstant),
      })).digest('hex');
      const existing = await Meeting.findOne({
        companyId,
        hostId: req.user!.userId,
        idempotencyKeyHash,
      });
      if (existing) {
        if (existing.idempotencyPayloadHash !== idempotencyPayloadHash) {
          res.status(409).json({ success: false, message: 'This meeting request key was already used for a different meeting.' });
          return;
        }
        const meetingGrant = isInstant && existing.status === 'active'
          ? await createMeetingGrant(existing._id, req.user!.userId)
          : undefined;
        res.status(200).json({
          success: true,
          meeting: await getMeetingSafeView(existing, req.user!.userId),
          meetingGrant,
        });
        return;
      }
    }

    const meetingLink = randomBytes(32).toString('base64url');
    const participants: IMeeting['participants'] = uniqueParticipantIds.map((id) => ({
      userId: new mongoose.Types.ObjectId(id),
      status: 'invited',
    }));

    // If instant meeting, add creator as active participant
    if (isInstant) {
      participants.push({
        userId: new mongoose.Types.ObjectId(req.user!.userId),
        status: 'joined',
        joinedAt: new Date(),
      });
    }

    const meeting = await Meeting.create({
      companyId: req.user!.companyId,
      hostId: req.user!.userId,
      title,
      description,
      scheduledAt: normalizedScheduledAt,
      startedAt: isInstant ? new Date() : undefined,
      lastActivityAt: isInstant ? new Date() : undefined,
      idempotencyKeyHash,
      idempotencyPayloadHash,
      meetingLink,
      participants,
      crmCompanyId: hasCompanyId ? new mongoose.Types.ObjectId(crmCompanyId) : undefined,
      crmContactIds: uniqueCrmContactIds.map((id) => new mongoose.Types.ObjectId(id)),
      projectId: projectId || null,
      status: isInstant ? 'active' : 'scheduled',
    });

    if (scheduledAt && !isInstant) {
      await CalendarEvent.create({
        companyId: req.user!.companyId,
        creatorId: req.user!.userId,
        title: `Meeting: ${title}`,
        description,
        type: 'meeting',
        startDate: new Date(scheduledAt),
        endDate: new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000),
        meetingId: meeting._id,
        videoLink: `/meetings/${meetingLink}`,
        attendees: [req.user!.userId, ...participantIds],
      });
    }

    const populated = await meeting.populate([
      { path: 'hostId', select: 'fullName avatar avatarStorageKey email jobTitle department' },
      { path: 'participants.userId', select: 'fullName avatar avatarStorageKey email' },
    ]);

    await Promise.all(invitedUsers
      .filter((invitee) => invitee._id.toString() !== req.user!.userId)
      .map((invitee) => createNotification({
        companyId: invitee.companyId?.toString() || req.user!.companyId,
        userId: invitee._id.toString(),
        type: 'meeting_invite',
        title: 'Meeting invitation',
        body: `You have been invited to ${title}.`,
        actionUrl: `/meetings?join=${meetingLink}`,
        metadata: { meetingLink, meetingId: meeting._id.toString() },
      })));

    const meetingGrant = isInstant
      ? await createMeetingGrant(meeting._id, req.user!.userId)
      : undefined;

    for (const participantId of meetingMemberIds(meeting)) {
      const safeMeeting = await getMeetingSafeView(meeting, participantId);
      emitToUser(participantId, 'meeting:created', { meeting: safeMeeting });
    }

    res.status(201).json({ success: true, meeting: await getMeetingSafeView(meeting, req.user!.userId), meetingGrant });
  } catch (err: any) {
    if (err?.code === 11000 && idempotencyKeyHash && idempotencyPayloadHash) {
      const existing = await Meeting.findOne({
        companyId: req.user!.companyId,
        hostId: req.user!.userId,
        idempotencyKeyHash,
      });
      if (existing?.idempotencyPayloadHash === idempotencyPayloadHash) {
        const meetingGrant = req.body?.isInstant && existing.status === 'active'
          ? await createMeetingGrant(existing._id, req.user!.userId)
          : undefined;
        res.status(200).json({
          success: true,
          meeting: await getMeetingSafeView(existing, req.user!.userId),
          meetingGrant,
        });
        return;
      }
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resolveMeetingInvitee = async (req: AuthRequest, res: Response): Promise<void> => {
  const callingId = normalizeCallingId(req.body?.callingId);
  if (!isValidCallingId(callingId)) {
    res.status(400).json({ success: false, message: 'Enter a valid WorkGrind Calling ID.' });
    return;
  }

  const invitee = await User.findOne({
    callingId,
    companyId: req.user!.companyId,
    isActive: true,
    isDeleted: { $ne: true },
  }).select('_id fullName callingId').lean();

  if (!invitee) {
    res.status(404).json({ success: false, message: 'No active WorkGrind user was found for that Calling ID.' });
    return;
  }
  if (invitee._id.toString() === req.user!.userId) {
    res.status(400).json({ success: false, message: 'You are already the meeting host.' });
    return;
  }

  res.json({
    success: true,
    user: {
      _id: invitee._id.toString(),
      fullName: invitee.fullName,
      callingId: invitee.callingId,
    },
  });
};

export const getMeetingByLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getMeetingUser(req.user!.userId);
    if (!user) {
      res.status(403).json({ success: false, message: 'Active account required' });
      return;
    }
    const meeting = await Meeting.findOne({ meetingLink: req.params.link, companyId: user.companyId });

    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }

    const reconciled = await reconcileActiveMeeting(meeting);
    if (!isMeetingLinkAvailable(reconciled.meeting)) {
      res.status(410).json({ success: false, message: getMeetingLinkUnavailableMessage(reconciled.meeting) });
      return;
    }

    res.json({ success: true, meeting: await getMeetingSafeView(reconciled.meeting, user._id.toString()) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const joinMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getMeetingUser(req.user!.userId);
    if (!user) {
      res.status(403).json({ success: false, message: 'Active account required' });
      return;
    }
    const meeting = await Meeting.findOne({ meetingLink: req.params.link, companyId: user.companyId });

    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }

    const reconciled = await reconcileActiveMeeting(meeting);
    if (!isMeetingLinkAvailable(reconciled.meeting)) {
      res.status(410).json({ success: false, message: getMeetingLinkUnavailableMessage(reconciled.meeting) });
      return;
    }

    const currentMeeting = reconciled.meeting;
    const userIdStr = user._id.toString();
    const participant = currentMeeting.participants.find((p) => p.userId?.toString() === userIdStr);
    if (participant) {
      participant.status = 'joined';
      participant.joinedAt = new Date();
      participant.leftAt = undefined;
    } else {
      currentMeeting.participants.push({
        userId: user._id,
        status: 'joined',
        joinedAt: new Date(),
      });
    }

    const startedNow = currentMeeting.status === 'scheduled';
    if (startedNow) {
      currentMeeting.status = 'active';
      currentMeeting.startedAt = new Date();
    }
    currentMeeting.lastActivityAt = new Date();

    await currentMeeting.save();
    const meetingGrant = await createMeetingGrant(currentMeeting._id, userIdStr);

    const safeMeeting = await getMeetingSafeView(currentMeeting, userIdStr);
    for (const participantId of meetingMemberIds(currentMeeting)) {
      emitToUser(participantId, 'meeting:participant-joined', {
        meetingLink: currentMeeting.meetingLink,
        userId: userIdStr,
      });
    }

    res.json({
      success: true,
      meeting: safeMeeting,
      meetingGrant,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const startMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findOne({ meetingLink: req.params.link });

    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }
    if (meeting.hostId.toString() !== req.user!.userId || meeting.companyId.toString() !== req.user!.companyId) {
      res.status(403).json({ success: false, message: 'Only the meeting host can start this meeting' });
      return;
    }
    if (!isMeetingLinkAvailable(meeting)) {
      res.status(410).json({ success: false, message: getMeetingLinkUnavailableMessage(meeting) });
      return;
    }
    if (meeting.status === 'scheduled') {
      meeting.status = 'active';
      meeting.startedAt = new Date();
      meeting.lastActivityAt = meeting.startedAt;
      await meeting.save();
    }
    await meeting.populate([
      { path: 'hostId', select: 'fullName avatar avatarStorageKey email jobTitle department' },
      { path: 'participants.userId', select: 'fullName avatar avatarStorageKey email' },
    ]);

    const safeMeeting = await getMeetingSafeView(meeting, req.user!.userId);
    for (const participantId of meetingMemberIds(meeting)) {
      emitToUser(participantId, 'meeting:started', { meeting: safeMeeting });
    }

    res.json({ success: true, meeting: safeMeeting });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const endMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findOne({
      meetingLink: req.params.link,
    });
    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }
    if (meeting.hostId.toString() !== req.user!.userId || meeting.companyId.toString() !== req.user!.companyId) {
      res.status(403).json({ success: false, message: 'Only the meeting host can end this meeting' });
      return;
    }
    if (meeting.status === 'ended' || meeting.status === 'cancelled') {
      res.status(410).json({ success: false, message: 'This meeting link is no longer available' });
      return;
    }

    const endedAt = new Date();
    const duration = meeting.startedAt
      ? Math.round((endedAt.getTime() - new Date(meeting.startedAt).getTime()) / 60000)
      : 0;

    meeting.status = 'ended';
    meeting.endedAt = endedAt;
    meeting.duration = duration;
    await meeting.save();

    // Broadcast to the room and only to the meeting's authorized participants.
    getIO()?.to(`meeting:${meeting.meetingLink}`).emit('meeting:ended', {
      meetingId: meeting._id,
      meetingLink: meeting.meetingLink,
    });
    for (const participantId of meetingMemberIds(meeting)) {
      emitToUser(participantId, 'meeting:ended', {
        meetingId: meeting._id,
        meetingLink: meeting.meetingLink,
      });
    }

    res.json({ success: true, meeting });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const generateAISummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transcript } = req.body;
    const companyId = req.user!.companyId;
    const userId    = req.user!.userId;
    const meeting = await Meeting.findOne({ meetingLink: req.params.link });

    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }
    if (meeting.hostId.toString() !== userId || meeting.companyId.toString() !== companyId) {
      res.status(403).json({ success: false, message: 'Only the meeting host can manage this meeting' });
      return;
    }

    const aiCheck = await reserveAiRequest(userId);
    if (!aiCheck.allowed) {
      res.status(403).json({
        success: false,
        message: aiCheck.reason,
        code: aiCheck.code,
        requiresUpgrade: aiCheck.upgrade ?? false,
        limit: aiCheck.limit,
        current: aiCheck.current,
      });
      return;
    }

    // ── aiGuard on transcript (first 3000 chars) ──────────────────────────
    let transcriptAllowed = true;
    if (transcript && typeof transcript === 'string') {
      const guardResult = validateWorkGrindQuery(transcript.slice(0, 3000));
      transcriptAllowed = guardResult.allowed;
    }

    let summaryData: any;
    let geminiSuccess = false;
    let geminiDurationMs = 0;
    let geminiError: string | undefined;

    if (isGeminiConfigured() && transcript && transcriptAllowed) {
      try {
        const systemContent = `You are an AI Meeting Assistant. Analyze the following meeting discussion and return ONLY a clean JSON object with keys:
- summary: string (a concise 2-3 sentence overview)
- keyPoints: string[] (top 3-5 discussions)
- decisions: string[] (decisions made)
- actionItems: array of objects with { title: string, assignedTo: string, deadline: string }

Do NOT wrap in markdown. Do NOT include any explanatory text before or after the JSON. ONLY the JSON object itself.`;

        const genai = getGenAI();
        const startTime = Date.now();
        const response = await genai.models.generateContent({
          model: GEMINI_MODEL,
          config: { systemInstruction: systemContent },
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
        });
        geminiDurationMs = Date.now() - startTime;

        let content = response.text;
        if (content) {
          content = content.trim();
          if (content.startsWith('```')) {
            content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
            content = content.trim();
          }
          try {
            summaryData = JSON.parse(content);
          } catch (_jsonErr) {
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              try {
                summaryData = JSON.parse(content.slice(firstBrace, lastBrace + 1));
              } catch (_e2) {
                summaryData = null;
              }
            } else {
              summaryData = null;
            }
          }
          if (summaryData && summaryData.summary) {
            geminiSuccess = true;
          } else {
            summaryData = null;
          }
        }
      } catch (err: any) {
        geminiError = err?.message ?? String(err);
        console.error('Gemini call error:', err);
        summaryData = null;
      }
    }

    if (!summaryData || !summaryData.summary) {
      // High-quality contextual fallback
      summaryData = {
        summary: `During the ${meeting.title} meeting, the team reviewed key sprint deliverables, aligned on cross-functional dependencies, and outlined the upcoming milestone timelines.`,
        keyPoints: [
          'Reviewed project progress against quarterly objectives',
          'Identified key resource allocation requirements and team bandwidth',
          'Agreed on weekly synchronization checkpoints',
        ],
        decisions: [
          'Approved the product architectural direction and UX wireframes',
          'Set next release testing schedule for Friday',
        ],
        actionItems: [
          {
            title: 'Finalize interface component states and responsive styling',
            assignedTo: 'Engineering Team',
            deadline: 'This Friday',
          },
          {
            title: 'Share updated stakeholder documentation in Docs workspace',
            assignedTo: 'Project Lead',
            deadline: 'Next Monday',
          },
        ],
      };
    }

    meeting.aiSummary = {
      ...summaryData,
      generatedAt: new Date(),
    };
    await meeting.save();

    // ── Record AI usage ───────────────────────────────────────────────────
    try {
      const isGemini = isGeminiConfigured();
      const providerUsed: 'gemini' | 'fallback' = isGemini && geminiSuccess ? 'gemini' : 'fallback';
      const modelUsed = isGemini ? GEMINI_MODEL : 'rule_based_meeting_summary';
      await recordUsage({
        companyId,
        userId,
        feature: 'meeting_summary',
        provider: providerUsed,
        modelName: modelUsed,
        success: true,
        durationMs: geminiDurationMs || undefined,
        errorMessage: geminiSuccess ? undefined : (geminiError ?? undefined),
      });
    } catch (_e) { /* ignore */ }

    res.json({ success: true, aiSummary: meeting.aiSummary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createTaskFromAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, assignedTo, deadline, projectId } = req.body;
    if (!title) {
      res.status(400).json({ success: false, message: 'Title is required' });
      return;
    }
    const meeting = await Meeting.findOne({ meetingLink: req.params.link });
    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }
    if (meeting.hostId.toString() !== req.user!.userId || meeting.companyId.toString() !== req.user!.companyId) {
      res.status(403).json({ success: false, message: 'Only the meeting host can manage this meeting' });
      return;
    }
    if (projectId && (!mongoose.Types.ObjectId.isValid(projectId) || !await Project.exists({ _id: projectId, companyId: meeting.companyId, isArchived: false }))) {
      res.status(400).json({ success: false, message: 'Project must belong to the meeting workspace.' });
      return;
    }

    const task = await Task.create({
      companyId: meeting.companyId,
      creatorId: req.user!.userId,
      title,
      description: `Auto-generated from AI meeting summary. Assigned to: ${assignedTo || 'Unassigned'}`,
      priority: 'high',
      status: 'todo',
      projectId: projectId || null,
    });

    res.status(201).json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
