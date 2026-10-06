import { Response } from 'express';
import DailyFocus, { IDailyFocusItem } from '../models/DailyFocus';
import Task from '../models/Task';
import Meeting from '../models/Meeting';
import Message from '../models/Message';
import Notification from '../models/Notification';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { getGenAI, isGeminiConfigured, GEMINI_MODEL } from '../services/geminiService';
import { validateWorkGrindQuery, OFF_TOPIC_REPLY } from '../services/aiGuard';
import { recordUsage } from '../services/aiUsageTracker';
import { reserveAiRequest } from '../utils/planLimits';

interface RawCollectedData {
  overdueTasks: any[];
  dueTodayTasks: any[];
  inProgressTasks: any[];
  urgentTasks: any[];
  todayMeetings: any[];
  recentMentions: any[];
}

/**
 * Gather raw work items for a user across tasks, meetings, and mentions
 */
async function gatherUserData(userId: string, companyId: string): Promise<RawCollectedData> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const past48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [allAssignedTasks, todayMeetings, mentionMessages, unreadNotifications] = await Promise.all([
    // Active tasks assigned to user
    Task.find({
      companyId,
      assigneeId: userId,
      isArchived: false,
      status: { $ne: 'completed' },
    })
      .select('title description priority status dueDate projectId')
      .populate('projectId', 'name')
      .lean(),

    // Meetings today
    Meeting.find({
      companyId,
      status: { $in: ['scheduled', 'active'] },
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
      $or: [{ hostId: userId }, { 'participants.userId': userId }],
    })
      .select('title scheduledAt meetingLink status hostId duration')
      .populate('hostId', 'fullName')
      .lean(),

    // Messages mentioning user in past 48 hours
    Message.find({
      companyId,
      mentions: userId,
      deletedAt: null,
      createdAt: { $gte: past48h },
    })
      .select('content channelId conversationId senderId createdAt')
      .populate('senderId', 'fullName')
      .populate('channelId', 'name')
      .limit(5)
      .lean(),

    // Unread mention notifications
    Notification.find({
      userId,
      companyId,
      type: 'mention',
      isRead: false,
    })
      .limit(5)
      .lean(),
  ]);

  const overdueTasks: any[] = [];
  const dueTodayTasks: any[] = [];
  const inProgressTasks: any[] = [];
  const urgentTasks: any[] = [];

  for (const task of allAssignedTasks) {
    if (task.dueDate) {
      const due = new Date(task.dueDate);
      if (due < startOfDay) {
        overdueTasks.push(task);
      } else if (due >= startOfDay && due <= endOfDay) {
        dueTodayTasks.push(task);
      }
    }

    if (task.status === 'in_progress') {
      inProgressTasks.push(task);
    }

    if (task.priority === 'urgent' || task.priority === 'high') {
      urgentTasks.push(task);
    }
  }

  // Combine mention sources
  const recentMentions = [...mentionMessages];

  return {
    overdueTasks,
    dueTodayTasks,
    inProgressTasks,
    urgentTasks,
    todayMeetings,
    recentMentions,
  };
}

/**
 * Intelligent deterministic rule-based ranking engine (Zero-API failure guard)
 */
function generateWithRules(raw: RawCollectedData): { summary: string; focusItems: IDailyFocusItem[]; isAllClear: boolean } {
  const items: IDailyFocusItem[] = [];
  const seenIds = new Set<string>();

  // 1. Overdue tasks (Highest Urgency)
  for (const task of raw.overdueTasks) {
    const id = task._id.toString();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const diffDays = Math.max(
      1,
      Math.round((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    items.push({
      id,
      type: 'task',
      title: task.title,
      reason: `Overdue by ${diffDays} day${diffDays > 1 ? 's' : ''} — immediate action required`,
      link: `/tasks?taskId=${id}`,
      priority: 'high',
      badge: 'Overdue',
      meta: { dueDate: task.dueDate, status: task.status },
    });
  }

  // 2. Scheduled meetings today
  for (const meeting of raw.todayMeetings) {
    const id = meeting._id.toString();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const timeStr = meeting.scheduledAt
      ? new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Today';

    items.push({
      id,
      type: 'meeting',
      title: meeting.title,
      reason: `Live session at ${timeStr} — prepare camera & agenda`,
      link: `/meetings?join=${meeting.meetingLink}`,
      priority: meeting.status === 'active' ? 'high' : 'high',
      badge: meeting.status === 'active' ? '🔴 Live Now' : `Today ${timeStr}`,
      meta: { meetingLink: meeting.meetingLink, scheduledAt: meeting.scheduledAt },
    });
  }

  // 3. Tasks due today
  for (const task of raw.dueTodayTasks) {
    const id = task._id.toString();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    items.push({
      id,
      type: 'task',
      title: task.title,
      reason: 'Deadline concludes today — submit before close of business',
      link: `/tasks?taskId=${id}`,
      priority: 'high',
      badge: 'Due Today',
      meta: { dueDate: task.dueDate, status: task.status },
    });
  }

  // 4. Unread chat mentions
  for (const msg of raw.recentMentions) {
    const id = msg._id.toString();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const sender = msg.senderId?.fullName || 'A teammate';
    const channel = msg.channelId?.name ? `#${msg.channelId.name}` : 'direct chat';

    items.push({
      id,
      type: 'message',
      title: `${sender} mentioned you in ${channel}`,
      reason: 'Teammates are awaiting your response or review',
      link: msg.channelId ? `/chat?channel=${msg.channelId._id || msg.channelId}` : '/chat',
      priority: 'medium',
      badge: 'Mention',
      meta: { senderName: sender, channelName: channel },
    });
  }

  // 5. In-progress tasks
  for (const task of raw.inProgressTasks) {
    const id = task._id.toString();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    items.push({
      id,
      type: 'task',
      title: task.title,
      reason: 'Active deliverable marked in progress — keep momentum going',
      link: `/tasks?taskId=${id}`,
      priority: task.priority === 'urgent' ? 'high' : 'medium',
      badge: 'In Progress',
      meta: { status: task.status, priority: task.priority },
    });
  }

  // 6. Other urgent priority tasks
  for (const task of raw.urgentTasks) {
    const id = task._id.toString();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    items.push({
      id,
      type: 'task',
      title: task.title,
      reason: 'Flagged as high-impact initiative by project leads',
      link: `/tasks?taskId=${id}`,
      priority: 'high',
      badge: 'Urgent',
      meta: { priority: task.priority },
    });
  }

  // Cap at top 7 most critical items
  const ranked = items.slice(0, 7);

  // Compute summary
  const overdueCount = raw.overdueTasks.length;
  const todayDueCount = raw.dueTodayTasks.length;
  const meetingsCount = raw.todayMeetings.length;
  const mentionsCount = raw.recentMentions.length;

  let summary = '';
  if (ranked.length === 0) {
    summary = 'All clear for today! Everything is completely under control. 🎉';
  } else {
    const parts: string[] = [];
    if (overdueCount > 0) parts.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
    if (todayDueCount > 0) parts.push(`${todayDueCount} deadline${todayDueCount > 1 ? 's' : ''} today`);
    if (meetingsCount > 0) parts.push(`${meetingsCount} scheduled meeting${meetingsCount > 1 ? 's' : ''}`);
    if (mentionsCount > 0) parts.push(`${mentionsCount} unread mention${mentionsCount > 1 ? 's' : ''}`);

    if (parts.length > 0) {
      summary = `Today's priorities: ${parts.join(', ')}. Focus on urgent blockers first.`;
    } else {
      summary = `You have ${ranked.length} priority action item${ranked.length > 1 ? 's' : ''} to tackle today.`;
    }
  }

  return {
    summary,
    focusItems: ranked,
    isAllClear: ranked.length === 0,
  };
}

/**
 * AI Prioritization with Gemini
 */
async function generateWithGemini(
  raw: RawCollectedData,
  userName: string
): Promise<{ summary: string; focusItems: IDailyFocusItem[]; isAllClear: boolean } | null> {
  if (!isGeminiConfigured()) return null;

  const totalCount =
    raw.overdueTasks.length +
    raw.dueTodayTasks.length +
    raw.inProgressTasks.length +
    raw.urgentTasks.length +
    raw.todayMeetings.length +
    raw.recentMentions.length;

  if (totalCount === 0) {
    return {
      summary: 'All clear for today! No urgent tasks or meetings scheduled. 🎉',
      focusItems: [],
      isAllClear: true,
    };
  }

  const prompt = `You are WorkGrind's executive AI daily prioritization assistant.
Analyze the user's workload for today and synthesize a prioritized, ranked list of maximum 5 to 7 action items.

User: ${userName}
Overdue tasks: ${JSON.stringify(raw.overdueTasks.map((t) => ({ id: t._id, title: t.title, dueDate: t.dueDate, priority: t.priority })))}
Due today tasks: ${JSON.stringify(raw.dueTodayTasks.map((t) => ({ id: t._id, title: t.title, priority: t.priority })))}
In-progress tasks: ${JSON.stringify(raw.inProgressTasks.map((t) => ({ id: t._id, title: t.title, priority: t.priority })))}
Scheduled meetings today: ${JSON.stringify(raw.todayMeetings.map((m) => ({ id: m._id, title: m.title, time: m.scheduledAt, link: m.meetingLink })))}
Recent mentions in chat: ${JSON.stringify(raw.recentMentions.map((msg) => ({ id: msg._id, sender: msg.senderId?.fullName, channel: msg.channelId?.name, content: msg.content?.slice(0, 80) })))}

Rules:
1. Prioritize strictly: Overdue tasks > Due today tasks > Meetings today > Chat mentions > In-progress tasks.
2. Provide a short, actionable one-line reason for each item explaining why it is urgent.
3. Generate a punchy, motivating summary sentence (in clear English or professional Urdu/Roman Urdu if appropriate, default to crisp English).
4. Return ONLY a valid JSON object matching this schema. Do NOT wrap in markdown, do NOT add any extra commentary outside the JSON. JSON ONLY:
{
  "summary": "...",
  "focusItems": [
    {
      "id": "...",
      "type": "task" | "meeting" | "message",
      "title": "...",
      "reason": "...",
      "link": "...",
      "priority": "high" | "medium" | "low",
      "badge": "Overdue" | "Today" | "Meeting" | "Mention" | "In Progress"
    }
  ]
}`;

  try {
    const genai = getGenAI();
    const systemInstruction =
      'You are an executive productivity AI. Always output valid structured JSON matching the requested schema. No markdown formatting outside JSON. ONLY the JSON object, no other text.';

    const response = await genai.models.generateContent({
      model: GEMINI_MODEL,
      config: { systemInstruction, temperature: 0.3 },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let content = response.text;
    if (!content) return null;

    content = content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      content = content.trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (_jsonErr) {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1));
        } catch (_e2) {
          return null;
        }
      } else {
        return null;
      }
    }

    if (!parsed || !Array.isArray(parsed.focusItems)) return null;

    const sanitizedItems: IDailyFocusItem[] = parsed.focusItems.map((item: any) => {
      let link = item.link;
      if (!link || link === '...') {
        if (item.type === 'meeting') link = `/meetings?join=${item.id}`;
        else if (item.type === 'message') link = '/chat';
        else link = `/tasks?taskId=${item.id}`;
      }
      return {
        id: String(item.id),
        type: item.type === 'meeting' || item.type === 'message' ? item.type : 'task',
        title: String(item.title || 'Untitled item'),
        reason: String(item.reason || 'Action required today'),
        link: String(link),
        priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
        badge: String(item.badge || 'Priority'),
      };
    });

    return {
      summary: parsed.summary || 'Here are your top priorities for today.',
      focusItems: sanitizedItems.slice(0, 7),
      isAllClear: sanitizedItems.length === 0,
    };
  } catch (err) {
    console.warn('Gemini Daily Focus generation failed, falling back to rule engine:', err);
    return null;
  }
}

/**
 * Controller: GET /api/daily-focus
 */
export const getDailyFocus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId.toString();
    const companyId = req.user!.companyId.toString();
    const isForceRefresh = req.query.refresh === 'true';

    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    // Check cached document if not forcing refresh
    if (!isForceRefresh) {
      const cached = await DailyFocus.findOne({ userId, dateKey }).lean();
      if (cached) {
        res.json({
          success: true,
          cached: true,
          data: cached,
        });
        return;
      }
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

    // Generate fresh Daily Focus
    const [raw, userDoc] = await Promise.all([
      gatherUserData(userId, companyId),
      User.findById(userId).select('fullName').lean(),
    ]);

    const userName = userDoc?.fullName || 'WorkGrind Member';

    // Try AI first, fallback to rules
    let generatedBy: 'ai' | 'rules' = 'rules';
    let result: { summary: string; focusItems: IDailyFocusItem[]; isAllClear: boolean } | null = null;

    let aiStartTime = 0;
    let aiDurationMs = 0;
    let aiError: string | undefined;

    if (isGeminiConfigured()) {
      aiStartTime = Date.now();
      try {
        result = await generateWithGemini(raw, userName);
        aiDurationMs = Date.now() - aiStartTime;
      } catch (err: any) {
        aiError = err?.message ?? String(err);
        aiDurationMs = Date.now() - aiStartTime;
        result = null;
      }
    }

    if (result) {
      generatedBy = 'ai';
    } else {
      result = generateWithRules(raw);
    }

    const totalUrgentCount = result.focusItems.filter((i) => i.priority === 'high').length;

    // Cache / Upsert in MongoDB
    const focusDoc = await DailyFocus.findOneAndUpdate(
      { userId, dateKey },
      {
        userId,
        companyId,
        dateKey,
        summary: result.summary,
        focusItems: result.focusItems,
        generatedBy,
        isAllClear: result.isAllClear,
        totalUrgentCount,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ── Record AI usage ───────────────────────────────────────────────────
    try {
      const isGemini = isGeminiConfigured();
      const providerUsed: 'gemini' | 'fallback' = isGemini && generatedBy === 'ai' ? 'gemini' : 'fallback';
      const modelUsed = isGemini ? GEMINI_MODEL : 'rule_based_daily_focus';
      const aiSuccess = generatedBy === 'ai';
      await recordUsage({
        companyId,
        userId,
        feature: 'daily_focus',
        provider: providerUsed,
        modelName: modelUsed,
        success: aiSuccess,
        durationMs: aiDurationMs || undefined,
        errorMessage: aiSuccess ? undefined : (aiError ?? undefined),
      });
    } catch (_e) { /* ignore */ }

    res.json({
      success: true,
      cached: false,
      data: focusDoc,
    });
  } catch (err: any) {
    console.error('Error generating Daily Focus:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to generate Daily Focus' });
  }
};

/**
 * Controller: POST /api/daily-focus/refresh
 */
export const refreshDailyFocus = async (req: AuthRequest, res: Response): Promise<void> => {
  req.query.refresh = 'true';
  return getDailyFocus(req, res);
};
