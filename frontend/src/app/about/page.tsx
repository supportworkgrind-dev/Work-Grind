'use client';

import Link from 'next/link';
import { WorkGrindLogo } from '@/components/common/WorkGrindLogo';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { useI18n } from '@/lib/i18n';
import { LangSelector } from '@/components/landing/PublicNavbar';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { ArrowLeft, Users, ShieldCheck, Zap, Globe, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  const { t } = useI18n();

  const pillars = [
    { icon: Zap,        key: 'sync',     color: '#6366f1' },
    { icon: ShieldCheck,key: 'security', color: '#10b981' },
    { icon: Globe,      key: 'scale',    color: '#3b82f6' },
  ] as const;

  const audiences = [
    { name: 'Solo', description: 'Personal planning, tasks, projects, documents, and Tavro AI assistance where available.', workspace: 'solo' },
    { name: 'Company', description: 'Office and business teams can bring chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics together where available.', workspace: 'business' },
    { name: 'School / Academy', description: 'Support administrators, teachers, and students with classes, courses, timetables, attendance, assignments, online class meetings where enabled, exams, results, fee records, and communication.', workspace: 'school' },
    { name: 'College', description: 'Coordinate students, faculty, departments, courses, schedules, attendance, assignments, online meetings where enabled, assessments, results, fee records, and communication.', workspace: 'college' },
    { name: 'University', description: 'Support students, faculty, administrators, departments, courses, timetables, attendance, online meetings where enabled, assessments, results, fee records, and communication.', workspace: 'university' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'var(--bg-navbar)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="WorkGrind home">
            <ThemeAwareLogo size="sm" showWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LangSelector dark={false} />
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {t('nav.signIn')}
            </Link>
            <Link href="/signup" className="btn-primary h-9 px-4 rounded-xl text-sm">
              {t('nav.getStarted')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold mb-10 transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.backToHome')}
        </Link>

        {/* Hero */}
        <div className="page-hero text-center mb-14">
          <div className="workspace-chip mx-auto mb-6" style={{ display: 'inline-flex' }}>
            <Users className="h-3 w-3" />
            {t('about.badge')}
          </div>
          <h1
            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5 leading-tight"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
          >
            {t('about.headline1')}{' '}
            <span className="gradient-text">{t('about.headline2')}</span>{' '}
            {t('about.headline3')}
          </h1>
          <p className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('about.subheadline')}
          </p>
        </div>

        {/* Story */}
        <div className="surface-premium rounded-2xl p-8 sm:p-12 mb-8">
          <h2 className="text-2xl font-extrabold tracking-tight mb-6"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            {t('about.story.heading')}
          </h2>
          <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>{t('about.story.p1')}</p>
            <p>{t('about.story.p2')}</p>
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}>
            {pillars.map(({ icon: Icon, key, color }) => (
              <div key={key} className="rounded-xl p-5 card-hover"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-3"
                  style={{ background: `${color}18`, color }}>
                  <Icon style={{ height: '1.125rem', width: '1.125rem' }} />
                </div>
                <h3 className="font-bold text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t(`about.pillars.${key}.title`)}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {t(`about.pillars.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <div className="surface-premium rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-2"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            {t('about.workspace.heading')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {t('about.workspace.subheading')}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map(({ name, description, workspace }) => (
              <Link key={workspace} href={`/signup?workspace=${workspace}`}
                className="flex min-h-32 flex-col rounded-xl p-4 transition-colors hover:border-[var(--accent)]"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />{name}
                </span>
                <span className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</span>
                <span className="mt-auto pt-3 text-xs font-semibold" style={{ color: 'var(--accent)' }}>Choose this workspace <ArrowRight className="inline h-3 w-3" /></span>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-10 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1060 50%, #0f172a 100%)' }}>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute top-[-20%] left-[-10%] h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
            <div className="absolute bottom-[-20%] right-[-10%] h-56 w-56 rounded-full bg-violet-600/15 blur-[70px]" />
          </div>
          <div className="relative z-10 space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
              <Sparkles className="h-3 w-3" />
              {t('about.cta.badge')}
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white uppercase">{t('about.cta.name')}</h2>
              <p className="text-xs font-mono tracking-widest uppercase mt-1.5" style={{ color: '#94a3b8' }}>
                {t('about.cta.role')}
              </p>
            </div>
            <div className="pt-2">
              <Link href="/signup"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                {t('about.cta.button')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
