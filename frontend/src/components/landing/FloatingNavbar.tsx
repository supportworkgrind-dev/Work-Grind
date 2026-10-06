'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { Menu, X, ArrowRight } from 'lucide-react';
import { LangSelector } from './PublicNavbar';
import { useI18n } from '@/lib/i18n';

interface FloatingNavbarProps {
  isAuthenticated?: boolean;
}

export function FloatingNavbar({ isAuthenticated = false }: FloatingNavbarProps) {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { scrollY } = useScroll();

  // Nav section labels come from translations
  const NAV_LINKS = [
    { labelKey: 'nav.product',   href: '#product'  },
    { labelKey: 'nav.solutions', href: '#workflow'  },
    { labelKey: 'nav.features',  href: '#features'  },
    { labelKey: 'nav.ai',        href: '#ai'        },
    { labelKey: 'nav.security',  href: '#security'  },
  ] as const;

  useEffect(() => {
    const unsub = scrollY.on('change', (v) => setScrolled(v > 16));
    return unsub;
  }, [scrollY]);

  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener('resize', close, { passive: true });
    return () => window.removeEventListener('resize', close);
  }, []);

  const goto = (href: string) => {
    setMobileOpen(false);
    if (!href.startsWith('#')) return;
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <motion.header
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`landing-nav fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'is-scrolled border-b shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link href="/" aria-label="WorkGrind home" className="shrink-0">
            <ThemeAwareLogo size="sm" showWordmark surface="light" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => goto(l.href)}
                className="landing-nav-link px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none"
              >
                {t(l.labelKey)}
              </button>
            ))}
          </nav>

          {/* Desktop auth + language */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <LangSelector />
            {isAuthenticated ? (
              <Link href="/dashboard"
                className="landing-button-primary flex items-center gap-1.5 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-indigo-600/25">
                {t('nav.openWorkspace')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login"
                  className="landing-nav-link text-sm font-medium px-3.5 py-2 rounded-xl transition-colors">
                  {t('nav.signIn')}
                </Link>
                <Link href="/signup"
                  className="landing-button-primary hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-indigo-600/25">
                  {t('nav.getStarted')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(p => !p)}
            className="landing-nav-toggle lg:hidden p-2 rounded-lg"
            aria-label={mobileOpen ? t('common.close') : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="landing-mobile-nav fixed top-16 inset-x-4 z-40 rounded-xl border shadow-lg p-4 space-y-1 lg:hidden"
          >
            {NAV_LINKS.map((l) => (
              <button key={l.href} onClick={() => goto(l.href)}
                className="landing-nav-link w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {t(l.labelKey)}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex justify-end pb-1">
                <LangSelector />
              </div>
              <Link href="/login" onClick={() => setMobileOpen(false)}
                className="py-2.5 rounded-xl text-sm font-medium text-slate-300 border border-slate-700 text-center hover:bg-slate-800 transition-colors">
                {t('nav.signIn')}
              </Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}
                className="py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 text-center transition-colors">
                {t('nav.getStarted')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
