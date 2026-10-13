'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import styles from '@/app/landing.module.css';
import { FloatingNavbar } from './FloatingNavbar';

export function LandingPageClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authError, restoreSession } = useAuthStore();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const company = typeof user.companyId === 'object' ? user.companyId : undefined;
    router.replace(company?.organizationType && company.organizationType !== 'business'
      ? '/academic'
      : user.companyId ? '/dashboard' : '/create-company');
  }, [isAuthenticated, isLoading, router, user]);

  return (
    <div className={`${styles.landing} landing-theme theme-scope min-h-screen overflow-x-hidden`}>
      <FloatingNavbar isAuthenticated={isAuthenticated && !!user} />
      {authError && (
        <div className="flex flex-col items-center justify-center gap-4 px-6 pt-24 text-center" role="alert">
          <p>{authError}</p>
          <button className="theme-primary-action px-4 py-2" onClick={() => void restoreSession()}>Retry</button>
        </div>
      )}
      {children}
    </div>
  );
}
