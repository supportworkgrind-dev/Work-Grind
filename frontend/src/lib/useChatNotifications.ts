import { useState, useEffect, useCallback } from 'react';

export function useChatNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Update document title with unread badge
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = 'WorkGrind | Connected Workspace';
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [unreadCount]);

  // Clear unread count when window becomes focused
  useEffect(() => {
    const handleFocus = () => setUnreadCount(0);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      setPermission(res);
      return res;
    }
    return 'denied';
  }, []);

  const notify = useCallback(
    (title: string, body: string, icon = '/icon.svg') => {
      // Increment unread count if document is in background
      if (document.hidden) {
        setUnreadCount((c) => c + 1);
      }

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        if (document.hidden) {
          try {
            new Notification(title, { body, icon });
          } catch (e) {
            // Notification dispatch error
          }
        }
      }
    },
    []
  );

  return { permission, requestPermission, notify, unreadCount, setUnreadCount };
}
