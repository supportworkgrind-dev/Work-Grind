export const MEETING_LINK_TTL_MS = 24 * 60 * 60 * 1000;
export const MEETING_DISCONNECT_GRACE_MS = 2 * 60 * 1000;

export const isScheduledMeetingLinkExpired = (meeting: {
  status: string;
  scheduledAt?: Date | string;
}, now = Date.now()): boolean => {
  if (meeting.status !== 'scheduled' || !meeting.scheduledAt) return false;
  return now - new Date(meeting.scheduledAt).getTime() > MEETING_LINK_TTL_MS;
};

export const isMeetingInactive = (meeting: {
  lastActivityAt?: Date | string;
  startedAt?: Date | string;
  createdAt?: Date | string;
}, now = Date.now()): boolean => {
  const activityAt = meeting.lastActivityAt || meeting.startedAt || meeting.createdAt;
  return Boolean(activityAt) &&
    now - new Date(activityAt!).getTime() > MEETING_DISCONNECT_GRACE_MS;
};
