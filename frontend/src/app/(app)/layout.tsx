'use client';

import { useEffect, useRef, memo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { normalizeTheme, useThemeStore } from '@/lib/themeStore';
import { useI18n } from '@/lib/i18n';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { GlobalSearchModal } from '@/components/modals/GlobalSearchModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { CreateProjectModal } from '@/components/modals/CreateProjectModal';
import { ScheduleMeetingModal } from '@/components/modals/ScheduleMeetingModal';
import { CreateChannelModal } from '@/components/modals/CreateChannelModal';
import { IncomingCallManager } from '@/components/calling/IncomingCallManager';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { ExpiredSubscriptionExperience } from '@/components/subscription/ExpiredSubscriptionExperience';
import { DeveloperShell } from '@/components/layout/DeveloperShell';
import Link from 'next/link';

// How long a cached user is considered "fresh" before we re-validate with the server.
const USER_REVALIDATION_MS = 3 * 60 * 1000;

// ── Memoized shell — only re-renders when sidebar open state changes ──────────
const AppShell = memo(function AppShell({
  children,
  isSidebarOpen,
}: {
  children: React.ReactNode;
  isSidebarOpen: boolean;
}) {
  const pathname = usePathname();
  const workspace = pathname.split('/').filter(Boolean).join('-') || 'dashboard';

  return (
    <div className="theme-scope min-h-screen theme-bg-base flex overflow-x-hidden" data-workspace-shell={workspace}>
      <Sidebar />
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarOpen ? 'lg:pl-64' : 'lg:pl-[4.5rem]'
        }`}
      >
        <OfflineBanner />
        <Navbar />
        <main
          className="app-content flex-1 w-full max-w-[96rem] mx-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7 lg:px-9 lg:py-9"
          data-workspace={workspace}
        >
          {children}
        </main>
      </div>
      <GlobalSearchModal />
      <CreateTaskModal />
      <CreateProjectModal />
      <ScheduleMeetingModal />
      <CreateChannelModal />
      <IncomingCallManager />
    </div>
  );
});

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasHydrated, setHasHydrated] = useState(false);
  // Read user + isLoading with a selector to avoid re-rendering on unrelated store changes
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const subscription = useAuthStore((s) => s.subscription);
  const subscriptionLoading = useAuthStore((s) => s.subscriptionLoading);
  const subscriptionError = useAuthStore((s) => s.subscriptionError);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const refreshSubscription = useAuthStore((s) => s.refreshSubscription);
  const pathname = usePathname();
  const setTheme = useThemeStore((s) => s.setTheme);
  const { setLang } = useI18n();
  const isSidebarOpen    = useAppStore((s) => s.isSidebarOpen);
  useEffect(() => {
    if (!user) return;
    setTheme(normalizeTheme(user.theme));
    if (user.preferredLanguage) setLang(user.preferredLanguage);
  }, [user?._id, user?.theme, user?.preferredLanguage, setTheme, setLang]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const lastValidatedAt = useRef<number>(0);

  // Background revalidation — only fires once per USER_REVALIDATION_MS,
  // never blocks render.
  useEffect(() => {
    const now = Date.now();
    if (now - lastValidatedAt.current > USER_REVALIDATION_MS) {
      lastValidatedAt.current = now;
      fetchCurrentUser();
    }
  }, [fetchCurrentUser]);

  // Redirect unauthenticated users after auth state is resolved
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user && !subscription && !subscriptionLoading && !subscriptionError) {
      void refreshSubscription();
    }
  }, [user, subscription, subscriptionLoading, subscriptionError, refreshSubscription]);

  useEffect(() => {
    if (!user) return;
    const refreshVisibleSubscription = () => {
      if (document.visibilityState === 'visible') void refreshSubscription();
    };
    const interval = window.setInterval(refreshVisibleSubscription, USER_REVALIDATION_MS);
    window.addEventListener('focus', refreshVisibleSubscription);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleSubscription);
    };
  }, [user?._id, refreshSubscription]);

  useEffect(() => {
    if (user && !subscriptionLoading && !subscriptionError && subscription && !subscription.hasActiveAccess && pathname !== '/billing') {
      router.replace('/subscription-expired');
    }
  }, [user, subscription, subscriptionLoading, subscriptionError, pathname, router]);

  // ── Key behaviour change ───────────────────────────────────────────────────
  // Previously: !mounted || isLoading → full-screen spinner, blocking ALL renders
  // Now:        if we have a cached user, render immediately (fast path).
  //             Only show spinner when isLoading AND there is no cached user
  //             (true first-ever visit or after explicit logout).
  // This eliminates the blank screen on every navigation.

  if (!hasHydrated) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center"
        style={{ background: 'var(--wg-bg, #f5f2e9)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <ThemeAwareLogo size="md" surface="light" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: 'var(--wg-theme-accent)', animationDelay: `${i * 0.2}s`, opacity: 0.6 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !user) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center"
        style={{ background: 'var(--wg-bg, #f5f2e9)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <ThemeAwareLogo size="md" surface="light" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: 'var(--wg-theme-accent)', animationDelay: `${i * 0.2}s`, opacity: 0.6 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (pathname === '/billing' && (subscriptionError || (subscription && !subscription.hasActiveAccess))) {
    if (subscription?.status === 'expired' && subscription.hasActiveAccess === false) {
      return <ExpiredSubscriptionExperience showPlans />;
    }
    return <>{children}</>;
  }

  if (!subscription && (subscriptionLoading || !subscriptionError)) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: 'var(--wg-bg, #f5f2e9)' }}>
        <ThemeAwareLogo size="md" surface="light" />
      </div>
    );
  }

  if (subscriptionError && !subscription) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: 'var(--wg-bg, #f5f2e9)' }}>
        <ThemeAwareLogo size="md" surface="light" />
        <p className="max-w-md text-sm" style={{ color: 'var(--wg-text-secondary)' }}>{subscriptionError}</p>
        <div className="flex gap-3">
          <button onClick={() => void refreshSubscription()} className="theme-primary-action px-4 py-2 text-sm font-semibold">Retry</button>
          <Link href="/billing" className="px-4 py-2 text-sm font-semibold" style={{ color: 'var(--wg-text)' }}>Billing</Link>
        </div>
      </div>
    );
  }

  if (!subscription?.hasActiveAccess) return null;

  if (pathname.startsWith('/developer')) {
    return <DeveloperShell>{children}</DeveloperShell>;
  }

  return <AppShell isSidebarOpen={isSidebarOpen}>{children}</AppShell>;
}
