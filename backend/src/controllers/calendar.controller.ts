import { Response } from 'express';
import CalendarEvent from '../models/CalendarEvent';
import Task from '../models/Task';
import Meeting from '../models/Meeting';
import SocialPost from '../models/SocialPost';
import { AuthRequest } from '../middleware/auth';
import { AccountType, OrganizationType, isOrganizationType } from '../config/organization';
import { isOrganizationFeatureAllowed } from '../middleware/organizationAccess';

export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query;
    const filter: any = { companyId: req.user!.companyId };
    // The calendar asks for one visible range; tasks and meetings are limited
    // to it as well, instead of loading every dated record in the workspace.
    let range: { $gte: Date; $lte: Date } | undefined;
    if (start && end) {
      range = { $gte: new Date(start as string), $lte: new Date(end as string) };
      if (Number.isNaN(range.$gte.getTime()) || Number.isNaN(range.$lte.getTime())) {
        res.status(400).json({ success: false, message: 'start and end must be valid dates.' });
        return;
      }
      filter.startDate = range;
    }

    const postDateFilter = range ?? { $gte: new Date() };
    const organizationType = req.user!.organizationType;
    const accountType = req.user!.accountType;
    const canSeeSocialPosts = isOrganizationType(organizationType) &&
      (accountType === 'company' || accountType === 'individual') &&
      isOrganizationFeatureAllowed(
        { organizationType: organizationType as OrganizationType, accountType: accountType as AccountType },
        req.user!.role,
        'socialPublishing',
      );
    const [events, tasks, meetings, socialPosts] = await Promise.all([
      CalendarEvent.find(filter)
        .populate('creatorId', 'fullName avatar')
        .populate('attendees', 'fullName avatar email')
        .populate('meetingId', 'meetingLink title')
        .populate('projectId', 'name color')
        .sort({ startDate: 1 })
        .lean(),
      Task.find({
        companyId: req.user!.companyId,
        dueDate: range ?? { $exists: true, $ne: null },
        isArchived: false,
      })
        .select('companyId title description priority status dueDate projectId assigneeId')
        .populate('projectId', 'name color')
        .populate('assigneeId', 'fullName avatar')
        .lean(),
      Meeting.find({
        companyId: req.user!.companyId,
        scheduledAt: range ?? { $exists: true, $ne: null },
      })
        .select('companyId hostId title description scheduledAt endedAt duration meetingLink participants.userId')
        .populate('hostId', 'fullName avatar')
        .lean(),
      canSeeSocialPosts
        ? SocialPost.find({
          companyId: req.user!.companyId,
          status: 'scheduled',
          scheduledAt: postDateFilter,
        }).select('platform text authorId scheduledAt scheduleTimeZone')
          .populate('authorId', 'fullName avatar')
          .sort({ scheduledAt: 1 })
          .lean()
        : Promise.resolve([]),
    ]);

    // Format tasks as calendar events
    const taskEvents = tasks.map((t: any) => ({
      _id: `task-${t._id}`,
      companyId: t.companyId,
      creatorId: t.assigneeId || { fullName: 'Task' },
      title: `Task: ${t.title}`,
      description: t.description || `Priority: ${t.priority} • Status: ${t.status}`,
      type: 'task',
      startDate: t.dueDate,
      endDate: t.dueDate,
      allDay: true,
      color: t.priority === 'urgent' ? '#e11d48' : t.priority === 'high' ? '#f59e0b' : '#6366f1',
      projectId: t.projectId,
      attendees: t.assigneeId ? [t.assigneeId] : [],
    }));

    // Format meetings as calendar events
    const meetingEvents = meetings.map((m: any) => ({
      _id: `meeting-${m._id}`,
      companyId: m.companyId,
      creatorId: m.hostId,
      title: `Meeting: ${m.title}`,
      description: m.description || 'Virtual team meeting',
      type: 'meeting',
      startDate: m.scheduledAt,
      endDate: m.endedAt || new Date(new Date(m.scheduledAt).getTime() + (m.duration || 30) * 60000),
      allDay: false,
      videoLink: m.meetingLink,
      color: '#2563eb',
      attendees: (m.participants || []).map((p: any) => p.userId).filter(Boolean),
    }));

    const socialPostEvents = socialPosts.map((post) => ({
      _id: `social-post-${post._id}`,
      companyId: req.user!.companyId,
      creatorId: post.authorId,
      title: `Scheduled ${post.platform} post`,
      description: post.text,
      type: 'social_post',
      startDate: post.scheduledAt,
      endDate: post.scheduledAt,
      allDay: false,
      color: '#315F59',
      attendees: [],
      scheduleTimeZone: post.scheduleTimeZone,
    }));

    const combined = [...events, ...taskEvents, ...meetingEvents, ...socialPostEvents].sort(
      (a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    res.json({ success: true, events: combined });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, type, startDate, endDate, allDay, location, videoLink, attendees = [], color, projectId } = req.body;
    if (!title || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Title, start date, and end date required' });
      return;
    }

    const event = await CalendarEvent.create({
      companyId: req.user!.companyId,
      creatorId: req.user!.userId,
      title,
      description,
      type: type || 'event',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      allDay: allDay || false,
      location,
      videoLink,
      attendees: [req.user!.userId, ...attendees],
      color: color || '#4F46E5',
      projectId: projectId || null,
    });

    const populated = await event.populate([
      { path: 'creatorId', select: 'fullName avatar' },
      { path: 'attendees', select: 'fullName avatar email' },
    ]);

    res.status(201).json({ success: true, event: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getEventById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await CalendarEvent.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    })
      .populate('creatorId', 'fullName avatar')
      .populate('attendees', 'fullName avatar email')
      .populate('meetingId', 'meetingLink title')
      .populate('projectId', 'name color');

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Explicit allowlist — prevents mass assignment of protected fields
    const ALLOWED = ['title', 'description', 'type', 'startDate', 'endDate', 'allDay', 'location', 'videoLink', 'attendees', 'color', 'projectId'];
    const updates: Record<string, any> = {};
    ALLOWED.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const event = await CalendarEvent.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      updates,
      { new: true }
    ).populate([
      { path: 'creatorId', select: 'fullName avatar' },
      { path: 'attendees', select: 'fullName avatar email' },
    ]);

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await CalendarEvent.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    res.json({ success: true, message: 'Event deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
