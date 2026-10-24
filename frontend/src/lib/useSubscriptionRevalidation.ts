'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

const ACTIVE_REVALIDATION_MS = 3 * 60 * 1000;
// While a workspace has no active access its sockets are closed, so an admin
// grant or completed payment can only be noticed by asking the server.
const INACTIVE_REVALIDATION_MS = 30 * 1000;
const FOCUS_REVALIDATION_MS = 60 * 1000;

/**
 * Keeps the signed-in member's workspace subscription in step with the server
 * while the tab is visible: on an interval (faster while access is inactive)
 * and when the window regains focus.
 */
export function useSubscriptionRevalidation(userId: string | undefined, active: boolean) {
  const refreshSubscription = useAuthStore((state) => state.refreshSubscription);

  useEffect(() => {
    if (!userId) return;
    let lastRefreshAt = Date.now();
    const refreshVisibleSubscription = () => {
      if (document.visibilityState !== 'visible') return;
      lastRefreshAt = Date.now();
      void refreshSubscription();
    };
    // Focus fires on every alt-tab or devtools click; each refresh re-renders the shell.
    const refreshOnFocus = () => {
      if (Date.now() - lastRefreshAt >= FOCUS_REVALIDATION_MS) refreshVisibleSubscription();
    };
    const interval = window.setInterval(
      refreshVisibleSubscription,
      active ? ACTIVE_REVALIDATION_MS : INACTIVE_REVALIDATION_MS,
    );
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [userId, active, refreshSubscription]);
}
