'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { Globe, ChevronDown, Menu, X } from 'lucide-react';
import { useI18n, LANGUAGES, type LangCode } from '@/lib/i18n';

/* ────────────────────────────────────────────────────────────────────────────
   Language Selector — labels always in their own language (never translated)
   ──────────────────────────────────────────────────────────────────────────── */
export function LangSelector({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  const select = (code: LangCode) => { setLang(code); setOpen(false); };

  const textCls    = dark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900';
  const dropdownBg = dark ? 'bg-[#0d1117] border-slate-700' : 'bg-white border-slate-200';
  const itemCls    = dark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900';
  const activeCls  = dark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-medium transition-colors ${textCls}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="inline sm:hidden">{String(current.code).toUpperCase()}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="listbox"
            aria-label="Language options"
            className={`absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border shadow-lg overflow-hidden ${dropdownBg}`}
          >
            {LANGUAGES.map(l => (
              <button
                key={String(l.code)}
                role="option"
                aria-selected={l.code === lang}
                onClick={() => select(l.code)}
                className={`flex items-center justify-between w-full px-3 py-2 text-[12px] font-medium transition-colors ${l.code === lang ? activeCls : itemCls}`}
              >
                <span>{l.label}</span>
                <span className="opacity-60 text-[11px]">{l.native}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   PublicNavbar — used on all non-homepage public pages
   ──────────────────────────────────────────────────────────────────────────── */
export function PublicNavbar() {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="WorkGrind home">
          <ThemeAwareLogo size="sm" showWordmark surface="light" />
        </Link>

        <div className="hidden sm:flex items-center gap-2">
          <LangSelector dark={false} />
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            {t('nav.signIn')}
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all"
          >
            {t('nav.getStarted')}
          </Link>
        </div>

        <button
          className="sm:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(p => !p)}
          aria-label={mobileOpen ? t('common.close') : 'Open menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="sm:hidden border-t border-slate-200/80 bg-white/95 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <LangSelector dark={false} />
          </div>
          <Link href="/login" onClick={() => setMobileOpen(false)}
            className="block w-full py-2.5 px-4 rounded-xl text-sm font-medium text-slate-700 border border-slate-200 text-center hover:bg-slate-50 transition-colors">
            {t('nav.signIn')}
          </Link>
          <Link href="/signup" onClick={() => setMobileOpen(false)}
            className="block w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 text-center transition-colors">
            {t('nav.getStarted')}
          </Link>
        </div>
      )}
    </header>
  );
}
