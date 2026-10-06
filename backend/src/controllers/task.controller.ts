import { Response } from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task';
import Project from '../models/Project';
import type { TaskRecurrence } from '../models/Task';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './channel.controller';
import { emitToCompany } from '../utils/socket';

const TASK_RECURRENCES = new Set<TaskRecurrence>(['none', 'daily', 'weekly', 'monthly']);
const MAX_TASK_DEPENDENCIES = 25;
const MAX_TASK_CUSTOM_FIELDS = 30;

function canManageTasks(role: string): boolean {
  return ['owner', 'admin', 'manager'].includes(role);
}

function canTrackTask(task: any, userId: string, role: string): boolean {
  return canManageTasks(role)
    || task.assigneeId?.toString() === userId
    || task.creatorId?.toString() === userId;
}

function normalizeCustomFields(fields: unknown): { key: string; value: string }[] | null {
  if (!Array.isArray(fields) || fields.length > MAX_TASK_CUSTOM_FIELDS) return null;
  const normalized: { key: string; value: string }[] = [];
  for (const field of fields) {
    if (typeof field?.key !== 'string' || typeof field?.value !== 'string') return null;
    const key = field.key.trim();
    if (!key || key.length > 60 || field.value.length > 500) return null;
    normalized.push({ key, value: field.value.trim() });
  }
  return normalized;
}

async function validateDependencyIds(
  dependencyIds: unknown,
  companyId: string,
  taskId?: string,
): Promise<{ ids?: mongoose.Types.ObjectId[]; error?: string }> {
  if (!Array.isArray(dependencyIds) || dependencyIds.length > MAX_TASK_DEPENDENCIES) {
    return { error: `Choose up to ${MAX_TASK_DEPENDENCIES} task dependencies.` };
  }
  const uniqueIds = [...new Set(dependencyIds.map(String))];
  if (uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return { error: 'One or more task dependencies are invalid.' };
  }
  if (taskId && uniqueIds.includes(taskId)) return { error: 'A task cannot depend on itself.' };
  const ids = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  if (ids.length) {
    const existingCount = await Task.countDocuments({ _id: { $in: ids }, companyId });
    if (existingCount !== ids.length) return { error: 'Dependencies must belong to this workspace.' };
  }
  if (taskId && ids.length) {
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const dependencyGraph = await Task.aggregate<{ reachableIds: mongoose.Types.ObjectId[] }>([
      { $match: { _id: { $in: ids }, companyId: companyObjectId } },
      {
        $graphLookup: {
          from: Task.collection.name,
          startWith: '$dependencyIds',
          connectFromField: 'dependencyIds',
          connectToField: '_id',
          as: 'reachableDependencies',
          restrictSearchWithMatch: { companyId: companyObjectId },
        },
      },
      { $project: { _id: 0, reachableIds: '$reachableDependencies._id' } },
    ]);
    if (dependencyGraph.some(({ reachableIds }) => reachableIds?.some((id) => id.toString() === taskId))) {
      return { error: 'Task dependencies cannot create a cycle.' };
    }
  }
  return { ids };
}

function getNextRecurringDueDate(dueDate: Date | undefined, recurrence: TaskRecurrence): Date {
  const next = dueDate ? new Date(dueDate) : new Date();
  if (recurrence === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  else if (recurrence === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (recurrence === 'monthly') {
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  }
  return next;
}

const updateProjectProgress = async (projectId: string, companyId: string) => {
  if (!projectId) return;
  const total = await Task.countDocuments({ projectId, companyId, isArchived: false });
  if (total === 0) return;
  const completed = await Task.countDocuments({ projectId, companyId, status: 'completed', isArchived: false });
  const progress = Math.round((completed / total) * 100);
  await Project.findByIdAndUpdate(projectId, { progress });
};

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assigneeId, projectId, status, priority, dueDate, search } = req.query;
    const filter: any = { companyId: req.user!.companyId, isArchived: false };

    if (req.user!.role === 'employee') {
      // Single aggregation-friendly query: fetch project IDs the employee is part of,
      // then use $or — avoids 2 sequential roundtrips by keeping both in one await
      const [userProjectIds] = await Promise.all([
        Project.find({
          companyId: req.user!.companyId,
          isArchived: false,
          $or: [
            { 'members.userId': req.user!.userId },
            { assigneeId: req.user!.userId },
            { managerId: req.user!.userId },
          ],
        }).select('_id').lean(),
      ]);

      filter.$or = [
        { assigneeId: req.user!.userId },
        { creatorId: req.user!.userId },
        { projectId: { $in: userProjectIds.map((p: any) => p._id) } },
      ];
    }

    if (assigneeId) filter.assigneeId = assigneeId;
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) filter.title = { $regex: search, $options: 'i' };

    // Default limit of 200 tasks — prevents full-collection fetch on large workspaces.
    // Pass ?limit=all to bypass when genuinely needed (e.g. exports).
    const requestedLimit = req.query.limit;
    const limit = requestedLimit === 'all'
      ? undefined
      : Math.min(500, Math.max(1, Number(requestedLimit) || 200));

    let query = Task.find(filter)
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('creatorId', 'fullName avatar')
      .populate('projectId', 'name color')
      .sort({ createdAt: -1 });

    if (limit) {
      query = query.limit(limit);
    }

    const tasks = await query.lean();

    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Default to 50 tasks for dashboard/widget calls; pass ?limit=200 for full list
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));

    const tasks = await Task.find({
      companyId: req.user!.companyId,
      assigneeId: req.user!.userId,
      isArchived: false,
    })
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('creatorId', 'fullName avatar')
      .populate('projectId', 'name color')
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, assigneeId, projectId, priority, status, startDate, dueDate, tags, subtasks } = req.body;
    if (!title) {
      res.status(400).json({ success: false, message: 'Title is required' });
      return;
    }

    const recurrence = req.body.recurrence ?? 'none';
    if (!TASK_RECURRENCES.has(recurrence)) {
      res.status(400).json({ success: false, message: 'Recurrence must be none, daily, weekly, or monthly.' });
      return;
    }
    const dependencies = await validateDependencyIds(req.body.dependencyIds ?? [], req.user!.companyId);
    if (dependencies.error) {
      res.status(400).json({ success: false, message: dependencies.error });
      return;
    }
    const customFields = normalizeCustomFields(req.body.customFields ?? []);
    if (!customFields) {
      res.status(400).json({ success: false, message: 'Custom fields must contain up to 30 key/value pairs.' });
      return;
    }
    const estimatedMinutes = req.body.estimatedMinutes == null ? undefined : Number(req.body.estimatedMinutes);
    if (estimatedMinutes !== undefined && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 525600)) {
      res.status(400).json({ success: false, message: 'Estimated minutes must be a whole number between 0 and 525600.' });
      return;
    }

    const task = await Task.create({
      companyId: req.user!.companyId,
      creatorId: req.user!.userId,
      title,
      description,
      assigneeId: assigneeId || null,
      projectId: projectId || null,
      priority: priority || 'medium',
      status: status || 'todo',
      startDate: startDate || null,
      dueDate: dueDate || null,
      tags: tags || [],
      subtasks: subtasks || [],
      recurrence,
      dependencyIds: dependencies.ids,
      estimatedMinutes,
      customFields,
    });

    const populated = await task.populate([
      { path: 'assigneeId', select: 'fullName avatar email jobTitle' },
      { path: 'creatorId', select: 'fullName avatar' },
      { path: 'projectId', select: 'name color' },
    ]);

    if (projectId) {
      await updateProjectProgress(projectId, req.user!.companyId);
    }

    if (assigneeId && assigneeId !== req.user!.userId) {
      await createNotification({
        companyId: req.user!.companyId,
        userId: assigneeId,
        type: 'task_assigned',
        title: 'New Task Assigned',
        body: `You have been assigned to: "${title}"`,
        actionUrl: `/tasks`,
      });
    }

    // Broadcast new task to all company members so their Kanban boards update in real-time
    emitToCompany(req.user!.companyId, 'task:created', populated);

    res.status(201).json({ success: true, task: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findOne({ _id: req.params.id, companyId: req.user!.companyId })
      .populate('assigneeId', 'fullName avatar email jobTitle')
      .populate('creatorId', 'fullName avatar')
      .populate('projectId', 'name color')
      .populate('comments.userId', 'fullName avatar')
      .lean();

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existingTask = await Task.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!existingTask) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (req.user!.role === 'employee') {
      const isAssigned = existingTask.assigneeId && existingTask.assigneeId.toString() === req.user!.userId;
      if (!isAssigned) {
        res.status(403).json({ success: false, message: 'Employees can only update tasks assigned to them' });
        return;
      }

      const allowedKeys = ['status'];
      const forbiddenKeys = Object.keys(req.body).filter((k) => !allowedKeys.includes(k));
      if (forbiddenKeys.length > 0) {
        res.status(403).json({
          success: false,
          message: 'Employees are only permitted to update task status (To Do, In Progress, Completed)',
        });
        return;
      }
    }

    const updates: Record<string, any> = {};
    if (req.body.recurrence !== undefined) {
      if (!TASK_RECURRENCES.has(req.body.recurrence)) {
        res.status(400).json({ success: false, message: 'Recurrence must be none, daily, weekly, or monthly.' });
        return;
      }
      updates.recurrence = req.body.recurrence;
    }
    if (req.body.dependencyIds !== undefined) {
      const dependencies = await validateDependencyIds(req.body.dependencyIds, req.user!.companyId, req.params.id);
      if (dependencies.error) {
        res.status(400).json({ success: false, message: dependencies.error });
        return;
      }
      updates.dependencyIds = dependencies.ids;
    }
    if (req.body.estimatedMinutes !== undefined) {
      const estimatedMinutes = req.body.estimatedMinutes == null ? null : Number(req.body.estimatedMinutes);
      if (estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 525600)) {
        res.status(400).json({ success: false, message: 'Estimated minutes must be a whole number between 0 and 525600.' });
        return;
      }
      updates.estimatedMinutes = estimatedMinutes;
    }
    if (req.body.customFields !== undefined) {
      const customFields = normalizeCustomFields(req.body.customFields);
      if (!customFields) {
        res.status(400).json({ success: false, message: 'Custom fields must contain up to 30 key/value pairs.' });
        return;
      }
      updates.customFields = customFields;
    }

    // Explicit allowlist — prevents mass assignment of protected fields
    // (companyId, creatorId, isArchived cannot be overwritten via the API)
    const ALLOWED_UPDATE_FIELDS = [
      'title', 'description', 'assigneeId', 'projectId',
      'priority', 'status', 'startDate', 'dueDate', 'tags',
    ];
    ALLOWED_UPDATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const completesTask = updates.status === 'completed' && existingTask.status !== 'completed';
    if (completesTask) {
      const dependencyIds = updates.dependencyIds ?? existingTask.dependencyIds ?? [];
      if (dependencyIds.length) {
        const dependencies = await Task.find({ _id: { $in: dependencyIds }, companyId: req.user!.companyId }).select('_id status').lean();
        if (dependencies.length !== dependencyIds.length || dependencies.some((dependency) => dependency.status !== 'completed')) {
          res.status(409).json({ success: false, code: 'TASK_DEPENDENCIES_INCOMPLETE', message: 'Complete this task’s dependencies before marking it complete.' });
          return;
        }
      }
    }
    const recurrence = (updates.recurrence ?? existingTask.recurrence ?? 'none') as TaskRecurrence;
    if (completesTask && recurrence !== 'none') updates.recurrence = recurrence;

    if (completesTask && !updates.completedAt) {
      updates.completedAt = new Date();
    } else if (updates.status && updates.status !== 'completed') {
      updates.completedAt = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      updates,
      { new: true }
    ).populate([
      { path: 'assigneeId', select: 'fullName avatar email jobTitle' },
      { path: 'creatorId', select: 'fullName avatar' },
      { path: 'projectId', select: 'name color' },
      { path: 'comments.userId', select: 'fullName avatar' },
    ]);

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (task.projectId) {
      await updateProjectProgress(task.projectId._id.toString(), req.user!.companyId);
    }

    let recurringTaskCreated = false;
    if (completesTask && task.recurrence !== 'none') {
      const nextDueDate = getNextRecurringDueDate(task.dueDate, task.recurrence);
      const dateSpan = task.startDate && task.dueDate
        ? new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()
        : 0;
      try {
        const nextTask = await Task.create({
          companyId: req.user!.companyId,
          projectId: task.projectId?._id ?? task.projectId ?? null,
          title: task.title,
          description: task.description,
          assigneeId: task.assigneeId?._id ?? task.assigneeId ?? null,
          creatorId: task.creatorId?._id ?? task.creatorId,
          priority: task.priority,
          status: 'todo',
          startDate: dateSpan ? new Date(nextDueDate.getTime() - dateSpan) : null,
          dueDate: nextDueDate,
          tags: task.tags,
          recurrence: task.recurrence,
          dependencyIds: [task._id],
          estimatedMinutes: task.estimatedMinutes,
          customFields: task.customFields,
          subtasks: task.subtasks.map((subtask: any) => ({ title: subtask.title, assigneeId: subtask.assigneeId ?? null, isCompleted: false })),
        });
        const populatedNextTask = await nextTask.populate([
          { path: 'assigneeId', select: 'fullName avatar email jobTitle' },
          { path: 'creatorId', select: 'fullName avatar' },
          { path: 'projectId', select: 'name color' },
        ]);
        emitToCompany(req.user!.companyId, 'task:created', populatedNextTask);
        if (task.projectId) await updateProjectProgress(task.projectId._id.toString(), req.user!.companyId);
        recurringTaskCreated = true;
      } catch (recurrenceError) {
        console.error('[Tasks] Failed to create recurring occurrence', { taskId: task._id.toString() });
      }
    }

    // Broadcast task update to all company members so Kanban boards stay in sync
    emitToCompany(req.user!.companyId, 'task:updated', task);

    res.json({ success: true, task, recurringTaskCreated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      { isArchived: true },
      { new: true }
    );

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (task.projectId) {
      await updateProjectProgress(task.projectId.toString(), req.user!.companyId);
    }

    // Notify all company members to remove this task from their board
    emitToCompany(req.user!.companyId, 'task:deleted', { taskId: req.params.id });

    res.json({ success: true, message: 'Task deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const startTaskTimer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    if (!canTrackTask(task, req.user!.userId, req.user!.role)) {
      res.status(403).json({ success: false, message: 'You can only track time on tasks assigned to or created by you.' });
      return;
    }
    if (task.status === 'completed') {
      res.status(409).json({ success: false, message: 'Completed tasks cannot start a timer.' });
      return;
    }
    if (task.timeEntries.some((entry) => entry.userId.toString() === req.user!.userId && !entry.stoppedAt)) {
      res.status(409).json({ success: false, message: 'A timer is already running for this task.' });
      return;
    }
    task.timeEntries.push({ userId: new mongoose.Types.ObjectId(req.user!.userId), startedAt: new Date(), stoppedAt: null, durationSeconds: 0 } as any);
    await task.save();
    emitToCompany(req.user!.companyId, 'task:updated', task);
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const stopTaskTimer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    if (!canTrackTask(task, req.user!.userId, req.user!.role)) {
      res.status(403).json({ success: false, message: 'You can only track time on tasks assigned to or created by you.' });
      return;
    }
    const activeEntry = [...task.timeEntries].reverse().find((entry) => entry.userId.toString() === req.user!.userId && !entry.stoppedAt);
    if (!activeEntry) {
      res.status(409).json({ success: false, message: 'There is no running timer for this task.' });
      return;
    }
    activeEntry.stoppedAt = new Date();
    activeEntry.durationSeconds = Math.max(0, Math.floor((activeEntry.stoppedAt.getTime() - activeEntry.startedAt.getTime()) / 1000));
    await task.save();
    emitToCompany(req.user!.companyId, 'task:updated', task);
    res.json({ success: true, task, durationSeconds: activeEntry.durationSeconds });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addSubtask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, assigneeId } = req.body;
    if (!title) {
      res.status(400).json({ success: false, message: 'Title is required' });
      return;
    }

    const task = await Task.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    if (!canTrackTask(task, req.user!.userId, req.user!.role)) {
      res.status(403).json({ success: false, message: 'You can only update subtasks on tasks assigned to or created by you.' });
      return;
    }

    task.subtasks.push({ title, isCompleted: false, assigneeId: assigneeId || null } as any);
    await task.save();
    emitToCompany(req.user!.companyId, 'task:updated', task);

    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleSubtask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, subtaskId } = req.params;
    const task = await Task.findOne({ _id: id, companyId: req.user!.companyId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    if (!canTrackTask(task, req.user!.userId, req.user!.role)) {
      res.status(403).json({ success: false, message: 'You can only update subtasks on tasks assigned to or created by you.' });
      return;
    }

    const subtask = task.subtasks.find((s) => s._id.toString() === subtaskId);
    if (!subtask) {
      res.status(404).json({ success: false, message: 'Subtask not found' });
      return;
    }

    subtask.isCompleted = !subtask.isCompleted;
    await task.save();
    emitToCompany(req.user!.companyId, 'task:updated', task);

    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ success: false, message: 'Comment content is required' });
      return;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      {
        $push: {
          comments: {
            userId: req.user!.userId,
            content,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate('comments.userId', 'fullName avatar');

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (task.assigneeId && task.assigneeId.toString() !== req.user!.userId) {
      await createNotification({
        companyId: req.user!.companyId,
        userId: task.assigneeId.toString(),
        type: 'comment',
        title: 'New Comment on Task',
        body: `A comment was added to "${task.title}"`,
        actionUrl: `/tasks`,
      });
    }

    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
