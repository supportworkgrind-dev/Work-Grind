'use client';

import { InstallPromptBanner } from '@/components/pwa/InstallPromptBanner';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { I18nProvider } from '@/lib/i18n';
import { hydrateThemeFromStorage, useThemeStore } from '@/lib/themeStore';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { ArrowUpRight, X } from 'lucide-react';

function PlanUpgradePrompt() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleUpgrade = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message || 'Upgrade your plan to continue.');
    };
    window.addEventListener('workgrind:upgrade-required', handleUpgrade);
    return () => window.removeEventListener('workgrind:upgrade-required', handleUpgrade);
  }, []);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--wg-text) 68%, transparent)' }}
      role="presentation"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="plan-upgrade-title"
        className="w-full max-w-md border p-6 shadow-2xl"
        style={{
          background: 'var(--wg-surface-elevated)',
          borderColor: 'var(--wg-border)',
          color: 'var(--wg-text)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="plan-upgrade-title" className="text-base font-semibold" style={{ color: 'var(--wg-text)' }}>Plan limit reached</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--wg-text-secondary)' }}>{message}</p>
          </div>
          <button onClick={() => setMessage('')} aria-label="Close" className="transition-colors" style={{ color: 'var(--wg-text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setMessage('')} className="px-3 py-2 text-sm" style={{ color: 'var(--wg-text-secondary)' }}>
            Not now
          </button>
          <Link
            href="/billing"
            onClick={() => setMessage('')}
            className="theme-primary-action inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors"
            style={{ background: 'var(--wg-theme-accent)', color: 'var(--wg-on-accent)' }}
          >
            View plans <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export function RootClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const redirectingForSubscription = useRef(false);

  useEffect(() => {
    if (pathname === '/billing' || pathname === '/tasks') {
      redirectingForSubscription.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    useThemeStore.getState().setTheme(hydrateThemeFromStorage());
  }, []);

  useEffect(() => {
    const handleSubscriptionRequired = () => {
      if (window.location.pathname === '/billing' || window.location.pathname === '/subscription-expired') return;
      if (redirectingForSubscription.current) return;
      redirectingForSubscription.current = true;
      void useAuthStore.getState().refreshSubscription().finally(() => {
        window.location.assign('/subscription-expired');
      });
    };
    window.addEventListener('workgrind:subscription-required', handleSubscriptionRequired);
    return () => window.removeEventListener('workgrind:subscription-required', handleSubscriptionRequired);
  }, [pathname]);

  return (
    <I18nProvider>
      <ServiceWorkerRegister />
      {children}
      <PlanUpgradePrompt />
      <InstallPromptBanner />
    </I18nProvider>
  );
}
