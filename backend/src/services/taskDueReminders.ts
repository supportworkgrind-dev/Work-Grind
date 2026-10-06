import Task from '../models/Task';
import { createNotification } from '../controllers/channel.controller';

const MAX_REMINDERS_PER_SWEEP = 500;

export async function runTaskDueReminderSweep(now = new Date()): Promise<number> {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setUTCDate(endOfTomorrow.getUTCDate() + 2);

  const dueTasks = await Task.find({
    isArchived: false,
    status: { $ne: 'completed' },
    dueDate: { $gte: startOfToday, $lt: endOfTomorrow },
  })
    .select('_id companyId title assigneeId creatorId dueDate dueReminderDate')
    .sort({ dueDate: 1 })
    .limit(MAX_REMINDERS_PER_SWEEP)
    .lean();

  let remindersCreated = 0;
  for (const task of dueTasks) {
    if (!task.dueDate) continue;
    const dueDate = new Date(task.dueDate);
    const dueDateKey = dueDate.toISOString().slice(0, 10);
    if (task.dueReminderDate === dueDateKey) continue;

    const claim = await Task.updateOne(
      {
        _id: task._id,
        companyId: task.companyId,
        isArchived: false,
        status: { $ne: 'completed' },
        dueDate: task.dueDate,
        dueReminderDate: { $ne: dueDateKey },
      },
      { $set: { dueReminderDate: dueDateKey } },
    );
    if (!claim.modifiedCount) continue;

    try {
      await createNotification({
        companyId: task.companyId.toString(),
        userId: (task.assigneeId ?? task.creatorId).toString(),
        type: 'task_due',
        title: 'Task due soon',
        body: `"${task.title}" is due ${dueDate.toLocaleDateString()}.`,
        actionUrl: '/tasks',
        metadata: { taskId: task._id.toString(), dueDate: dueDate.toISOString() },
      });
      remindersCreated++;
    } catch {
      await Task.updateOne(
        { _id: task._id, companyId: task.companyId, dueReminderDate: dueDateKey },
        { $unset: { dueReminderDate: 1 } },
      );
      console.error('[Tasks] Due reminder delivery failed', { taskId: task._id.toString() });
    }
  }

  return remindersCreated;
}
