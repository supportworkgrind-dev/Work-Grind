'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LazyMotion, domAnimation } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import styles from '@/app/landing.module.css';
import { FloatingNavbar } from './FloatingNavbar';

export function LandingPageClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingRedirect = useRef<string | null>(null);
  const { user, isAuthenticated, isLoading, authError, restoreSession } = useAuthStore();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const company = typeof user.companyId === 'object' ? user.companyId : undefined;
    const destination = company?.organizationType && company.organizationType !== 'business'
      ? '/academic'
      : user.companyId ? '/dashboard' : '/create-company';
    if (destination === pathname || pendingRedirect.current === destination) return;
    pendingRedirect.current = destination;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Navigation diagnostics] Landing redirect.', { from: pathname, to: destination });
    }
    router.replace(destination);
  }, [isAuthenticated, isLoading, pathname, router, user]);

  return (
    // m components with the DOM animation feature set (no layout or drag), which
    // keeps most of framer-motion out of the landing page bundle.
    <LazyMotion features={domAnimation} strict>
      <div className={`${styles.landing} landing-theme theme-scope min-h-screen overflow-x-hidden`}>
        <FloatingNavbar isAuthenticated={isAuthenticated && !!user} />
        {/* Overlaid rather than inserted above the hero so a failed session
            restore cannot shift the page layout (measured CLS 0.24 when inline). */}
        {authError && (
          <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#0d1117]/95 px-5 py-4 text-center text-sm shadow-xl" role="alert">
            <p>{authError}</p>
            <button className="theme-primary-action px-4 py-2" onClick={() => void restoreSession()}>Retry</button>
          </div>
        )}
        {children}
      </div>
    </LazyMotion>
  );
}
