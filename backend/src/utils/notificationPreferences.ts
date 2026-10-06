import User from '../models/User';

export type NotificationPreferenceKey =
  | 'taskAssigned'
  | 'meetingReminder'
  | 'newMessage'
  | 'dealUpdate';

const PREFERENCE_BY_NOTIFICATION_TYPE: Record<string, NotificationPreferenceKey> = {
  task_assigned: 'taskAssigned',
  meeting_invite: 'meetingReminder',
  message: 'newMessage',
  deal_update: 'dealUpdate',
};

export async function shouldDeliverNotification(
  userId: string,
  notificationType: string
): Promise<boolean> {
  const preferenceKey = PREFERENCE_BY_NOTIFICATION_TYPE[notificationType];
  if (!preferenceKey) return true;

  const user = await User.findById(userId).select('notificationPreferences').lean();
  return user?.notificationPreferences?.[preferenceKey] !== false;
}
