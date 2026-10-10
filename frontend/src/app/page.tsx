'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   WorkGrind Landing Page
   Editorial WorkGrind landing with an interactive workspace preview.
───────────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import styles from './landing.module.css';

/* Landing section components — all real, no placeholders */
import { FloatingNavbar }   from '@/components/landing/FloatingNavbar';
import { HeroSection }      from '@/components/landing/HeroSection';
import { ProductShowcase }  from '@/components/landing/ProductShowcase';
import { FeatureNetwork }   from '@/components/landing/FeatureNetwork';
import { FeatureSections }  from '@/components/landing/FeatureSections';
import { AISection }        from '@/components/landing/AISection';
import { SecuritySection }  from '@/components/landing/SecuritySection';
import { FinalCTA }         from '@/components/landing/FinalCTA';
import { LandingFooter }    from '@/components/landing/LandingFooter';

/* ── Hydration guard ── */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authError, restoreSession } = useAuthStore();
  const mounted = useMounted();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const company = typeof user.companyId === 'object' ? user.companyId : undefined;
    router.replace(company?.organizationType && company.organizationType !== 'business'
      ? '/academic'
      : user.companyId ? '/dashboard' : '/create-company');
  }, [isAuthenticated, isLoading, router, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Restoring your session">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p>{authError}</p>
        <button className="theme-primary-action px-4 py-2" onClick={() => void restoreSession()}>Retry</button>
      </div>
    );
  }

  /* Auth state is only safe to read client-side. */
  const authed = mounted ? isAuthenticated && !!user : false;

  return (
    <div className={`${styles.landing} landing-theme theme-scope min-h-screen overflow-x-hidden`}>
      {/* ── Floating navigation ── */}
      <FloatingNavbar isAuthenticated={authed} />

      {/* ── 1. Hero — full-screen 3D + headline ── */}
      <HeroSection />

      {/* ── 2. Product dashboard showcase ── */}
      <ProductShowcase />

      {/* ── 3. Feature network visualisation ── */}
      <FeatureNetwork />

      {/* ── 4. Feature deep-dives: Chat, Meetings, Tasks, Projects ── */}
      <FeatureSections />

      {/* ── 5. AI section — cinematic dark moment ── */}
      <AISection />

      {/* ── 6. Security ── */}
      <SecuritySection />

      {/* ── 7. Final CTA ── */}
      <FinalCTA />

      {/* ── 8. Footer ── */}
      <LandingFooter />
    </div>
  );
}
