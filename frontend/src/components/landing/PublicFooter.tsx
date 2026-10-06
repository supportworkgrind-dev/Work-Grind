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

export function PublicFooter() {
  const { t } = useI18n();

  const cols = [
    {
      key:   'company',
      label: t('footer.company'),
      links: [
        { label: t('footer.about'),    href: '/about'    },
        { label: t('footer.features'), href: '/features' },
        { label: t('footer.demo'),     href: '/demo'     },
        { label: t('footer.contact'),  href: '/contact'  },
      ],
    },
    {
      key:   'legal',
      label: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Cookie Preferences', href: '/cookies' },
        { label: 'Refund Policy', href: '/refunds' },
        { label: 'Cancellation Policy', href: '/cancellation' },
        { label: 'Disclaimer', href: '/disclaimer' },
      ],
    },
    {
      key: 'trust',
      label: 'Trust & Security',
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
      key: 'support',
      label: 'Support',
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
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">

          {/* Brand */}
          <div className="col-span-2 space-y-3 sm:col-span-1">
            <ThemeAwareLogo size="sm" showWordmark surface="dark" />
            <p className="text-[12px] text-slate-500 max-w-[200px] leading-relaxed">
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
                  className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-slate-400 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/60 hover:bg-indigo-500/10 hover:text-white"
                >
                  <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <>
            {cols.map(col => (
              <div key={col.key} className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {col.label}
                </h3>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link.href}>
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
          </>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-600">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </p>
          <LangSelector dark />
        </div>
      </div>
    </footer>
  );
}
