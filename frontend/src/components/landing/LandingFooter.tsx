'use client';

import React from 'react';
import Link from 'next/link';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { LangSelector } from './PublicNavbar';
import { useI18n } from '@/lib/i18n';

function InstagramIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LandingFooter() {
  const { t } = useI18n();

  const COLS = [
    {
      heading: t('footer.company'),
      links: [
        { label: t('footer.about'),    href: '/about'    },
        { label: t('footer.features'), href: '/features' },
        { label: t('footer.demo'),     href: '/demo'     },
        { label: t('footer.contact'),  href: '/contact'  },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: t('footer.privacy'),  href: '/privacy'  },
        { label: t('footer.terms'),    href: '/terms'    },
        { label: 'Cookie Preferences', href: '/cookies' },
        { label: 'Refund Policy', href: '/refunds' },
        { label: 'Cancellation Policy', href: '/cancellation' },
        { label: 'Disclaimer', href: '/disclaimer' },
      ],
    },
    {
      heading: 'Trust & Security',
      links: [
        { label: 'Security', href: '/security' },
        { label: 'Responsible Disclosure', href: '/responsible-disclosure' },
        { label: 'Accessibility', href: '/accessibility' },
        { label: 'Data Processing Agreement', href: '/dpa' },
        { label: 'Acceptable Use', href: '/acceptable-use' },
        { label: 'Community Guidelines', href: '/community-guidelines' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help Center', href: '/help' },
        { label: 'Support', href: '/support' },
      ],
    },
  ];

  const socialLinks = [
    {
      label: 'Follow WorkGrind on Instagram',
      href: 'https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp',
      icon: InstagramIcon,
    },
  ];

  return (
    <footer className="landing-footer relative border-t" role="contentinfo">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">

          {/* Brand */}
          <div className="space-y-3">
            <ThemeAwareLogo size="sm" showWordmark surface="dark" />
            <p className="text-[12px] text-slate-500 leading-relaxed max-w-[220px]">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-2.5">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/60 hover:bg-indigo-500/10 hover:text-white"
                >
                  <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                </a>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {t('footer.rights', { year: new Date().getFullYear() })}
            </p>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.heading} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[12px] text-slate-500 hover:text-slate-200 transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-5 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {t('footer.trial')}
          </p>
          <LangSelector dark />
        </div>
      </div>
    </footer>
  );
}
