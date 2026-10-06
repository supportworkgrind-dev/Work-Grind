import { Response } from 'express';
import CalendarEvent from '../models/CalendarEvent';
import Task from '../models/Task';
import Meeting from '../models/Meeting';
import { AuthRequest } from '../middleware/auth';

export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query;
    const filter: any = { companyId: req.user!.companyId };

    if (start && end) {
      filter.startDate = { $gte: new Date(start as string), $lte: new Date(end as string) };
    }

    const [events, tasks, meetings] = await Promise.all([
      CalendarEvent.find(filter)
        .populate('creatorId', 'fullName avatar')
        .populate('attendees', 'fullName avatar email')
        .populate('meetingId', 'meetingLink title')
        .populate('projectId', 'name color')
        .sort({ startDate: 1 }),
      Task.find({
        companyId: req.user!.companyId,
        dueDate: { $exists: true, $ne: null },
        isArchived: false,
      })
        .populate('projectId', 'name color')
        .populate('assigneeId', 'fullName avatar'),
      Meeting.find({
        companyId: req.user!.companyId,
        scheduledAt: { $exists: true, $ne: null },
      }).populate('hostId', 'fullName avatar'),
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

    const combined = [...events, ...taskEvents, ...meetingEvents].sort(
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
