'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Users, Briefcase, CheckSquare, Sparkles, Building2, BarChart3, MessageSquare, Calendar, Grid3X3 } from 'lucide-react';

const PILLARS = [
  {
    id: 'crm',
    label: 'CRM',
    color: '#3b82f6',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: Building2,
    headline: 'Customer Relationships',
    items: ['Contacts & companies', 'Activity timeline', 'Follow-ups & tasks', 'Deal tracking'],
  },
  {
    id: 'team',
    label: 'Team',
    color: '#8b5cf6',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    icon: Users,
    headline: 'People & Teams',
    items: ['Departments & roles', 'Workload visibility', 'Member profiles', 'Status & presence'],
  },
  {
    id: 'work',
    label: 'Work',
    color: '#10b981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckSquare,
    headline: 'Tasks & Projects',
    items: ['Kanban & list views', 'Project milestones', 'Meetings & calendar', 'Files & documents'],
  },
  {
    id: 'ai',
    label: 'AI',
    color: '#a78bfa',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    icon: Sparkles,
    headline: 'Intelligence Layer',
    items: ['Daily focus & priorities', 'Meeting summaries', 'Smart task creation', 'Workspace search'],
  },
] as const;

const WORKFLOW = [
  { label: 'CRM', detail: 'Customer context', icon: Building2, color: '#60a5fa' },
  { label: 'Team', detail: 'People aligned', icon: Users, color: '#c084fc' },
  { label: 'Work', detail: 'Tasks in motion', icon: CheckSquare, color: '#34d399' },
  { label: 'AI', detail: 'Tavro intelligence', icon: Sparkles, color: '#a78bfa' },
] as const;

export function ProductShowcase() {
  return (
    <section id="product" className="landing-section relative py-14 lg:py-20 border-t" aria-labelledby="product-heading">

      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65 }}
          className="max-w-2xl mb-16"
        >
          <h2 id="product-heading" className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black text-white tracking-tight leading-tight mb-4">
            Everything your business needs.{' '}
            <span className="text-slate-400">Connected.</span>
          </h2>
          <p className="text-base text-slate-400 leading-relaxed">
            From customer relationships to team execution, WorkGrind keeps the entire workflow in one place.
          </p>
        </motion.div>

        {/* 4-column pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                className={`rounded-2xl border ${p.border} ${p.bg} p-5 hover:scale-[1.01] transition-transform duration-200`}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${p.color}20` }}>
                    <Icon className="h-4.5 w-4.5" style={{ color: p.color, height: '1.125rem', width: '1.125rem' }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: p.color }}>{p.label}</span>
                </div>

                <h3 className="text-sm font-bold text-white mb-3">{p.headline}</h3>

                <ul className="space-y-2.5">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
                      <span className="h-1 w-1 rounded-full shrink-0" style={{ background: p.color }} />
                      {item}
                    </li>
                  ))}
                </ul>

                {p.id === 'work' && (
                  <div className="mt-5 rounded-xl border border-white/[0.07] bg-slate-950/40 p-3" aria-label="Sheets spreadsheet preview">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200">
                      <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Sheets
                    </div>
                    <div className="grid grid-cols-4 overflow-hidden rounded-md border border-white/[0.08] text-[9px]">
                      {['', 'A', 'B', 'C', '1', '', '', '', '2', '', '', '', '3', '', '', ''].map((cell, cellIndex) => (
                        <span
                          key={`${cell}-${cellIndex}`}
                          className={`flex h-5 items-center justify-center border-b border-r border-white/[0.06] ${
                            cellIndex < 4 ? 'bg-white/[0.06] font-semibold text-slate-400' : 'bg-white/[0.015] text-slate-500'
                          }`}
                        >
                          {cell}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Connective tagline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mt-12 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-indigo-500/[0.035] p-4 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">One connected workspace</p>
            <p className="text-sm text-slate-400">All connected. No switching tabs.</p>
          </div>
          <ol aria-label="CRM to Team to Work to AI workflow" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {WORKFLOW.map(({ label, detail, icon: Icon, color }, index) => (
              <li key={label} className="relative min-w-0">
                <div className="flex h-full items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0b0f19]/85 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white">{label}</span>
                    <span className="block truncate text-xs text-slate-400">{detail}</span>
                  </span>
                </div>
                {index < WORKFLOW.length - 1 && (
                  <ArrowRight className="absolute -right-[11px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-slate-500 sm:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}
