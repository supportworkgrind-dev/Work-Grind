'use client';

import { m } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Building2, Users, CheckSquare, CalendarDays, Sparkles, BookOpen, GraduationCap } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="landing-cta relative py-20 lg:py-24 overflow-hidden" aria-label="Get started with WorkGrind">
      {/* Deep ambient layers */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-gradient-radial from-indigo-600/22 via-violet-600/10 to-transparent blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-radial from-cyan-600/10 to-transparent blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <m.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Floating badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/8 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">Choose your WorkGrind workspace</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-[4rem] font-black text-white tracking-tight leading-[1.0]">
            Your workspace for{' '}
            <span className="block bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              work and learning.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Find the right tools for personal productivity, company collaboration, or academic administration.
          </p>

          {/* CTAs */}
          <div className="flex flex-col xs:flex-row gap-4 justify-center pt-2">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-indigo-600/35 transition-all duration-200 active:scale-[0.97]"
            >
              Get Started
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" style={{ height: '1.125rem', width: '1.125rem' }} />
            </Link>
            <button
              onClick={() => document.querySelector('#product')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all duration-200 active:scale-[0.97]"
            >
              Explore Features
            </button>
          </div>

          <div role="img" aria-label="Illustration of WorkGrind capabilities for personal, business, and academic workspaces" className="mx-auto max-w-2xl rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-4 sm:px-6">
            <div className="relative grid grid-cols-5 gap-1 sm:gap-3">
              <div className="absolute left-[10%] right-[10%] top-5 h-px bg-gradient-to-r from-blue-400/20 via-indigo-300/50 to-cyan-300/20" aria-hidden="true" />
              {[
                { label: 'Personal', Icon: CheckSquare, color: '#34d399' },
                { label: 'Company', Icon: Building2, color: '#60a5fa' },
                { label: 'Classes', Icon: BookOpen, color: '#a78bfa' },
                { label: 'Faculty', Icon: GraduationCap, color: '#c084fc' },
                { label: 'Tavro AI', Icon: Sparkles, color: '#67e8f9' },
              ].map(({ label, Icon, color }) => (
                <div key={label} className="relative z-10 flex min-w-0 flex-col items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-[#101522]">
                    <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                  </span>
                  <span className="truncate text-[10px] font-semibold text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust chips */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4">
            {[
              'Solo',
              'Company',
              'School / Academy',
              'College / University',
            ].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <span className="h-1 w-1 rounded-full bg-indigo-500" />
                {t}
              </div>
            ))}
          </div>
        </m.div>
      </div>
    </section>
  );
}
