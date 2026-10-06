'use client';

/* ──────────────────────────────────────────────────────────────────────────────
   CRM Section — replaces the abstract FeatureNetwork orbit diagram.
   Shows a realistic CRM interface: contacts list + detail view + pipeline.
────────────────────────────────────────────────────────────────────────────── */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Phone, Mail, CheckSquare, ArrowRight, Plus, MoreHorizontal, Users, Briefcase, CalendarDays } from 'lucide-react';

const CRM_CONTACTS = [
  { id: 1, name: 'Acme Corporation',  contact: 'David Park',      status: 'Active',     stage: 'Negotiation', value: '$48,000',  last: 'Proposal sent · 2h', avatar: 'AC', color: '#3b82f6' },
  { id: 2, name: 'Globex Industries', contact: 'Maria Santos',    status: 'Follow-up',  stage: 'Qualified',   value: '$22,500',  last: 'Follow-up due · Today', avatar: 'GI', color: '#f59e0b' },
  { id: 3, name: 'Initech Group',     contact: 'James Whitfield', status: 'Won',        stage: 'Won',         value: '$105,000', last: 'Contract signed · 1d', avatar: 'IG', color: '#10b981' },
  { id: 4, name: 'Umbrella Corp',     contact: 'Lin Chen',        status: 'Active',     stage: 'Lead',        value: '$9,800',   last: 'Intro call · 3d', avatar: 'UC', color: '#8b5cf6' },
];

const STAGE_COLORS: Record<string, string> = {
  'Lead':        '#64748b',
  'Qualified':   '#3b82f6',
  'Proposal':    '#f59e0b',
  'Negotiation': '#8b5cf6',
  'Won':         '#10b981',
};

const STATUS_STYLES: Record<string, string> = {
  'Active':     'text-emerald-400 bg-emerald-400/10',
  'Follow-up':  'text-amber-400   bg-amber-400/10',
  'Won':        'text-indigo-400  bg-indigo-400/10',
};

export function FeatureNetwork() {
  const [selected, setSelected] = useState(CRM_CONTACTS[0]);

  return (
    <section
      id="crm"
      className="landing-section relative py-24 lg:py-32 border-t"
      aria-labelledby="crm-heading"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/4 w-[600px] h-[400px] bg-blue-600/[0.05] rounded-full blur-[100px] -translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* LEFT: Copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="lg:sticky lg:top-24 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-4 py-1.5 text-[11px] font-bold text-blue-400 tracking-widest uppercase">
              CRM
            </div>

            <h2 id="crm-heading" className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Know every customer.<br />
              <span className="text-blue-400">Move every opportunity forward.</span>
            </h2>

            <p className="text-base text-slate-400 leading-relaxed max-w-md">
              Every contact, company, conversation and follow-up — in one organised place. WorkGrind keeps your customer relationships moving.
            </p>

            <ul className="space-y-3">
              {[
                'Contacts & companies in one view',
                'Activity timeline with all interactions',
                'Linked tasks, meetings and notes',
                'Stage-by-stage pipeline tracking',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                  <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* RIGHT: CRM UI */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden shadow-2xl">

              {/* CRM header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] bg-[#0a0d14]">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-bold text-white">CRM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-500">
                    <Search className="h-3 w-3" />
                    Search customers…
                  </div>
                  <button className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors">
                    <Plus className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>

              <ol aria-label="Company relationship flow" className="grid grid-cols-4 gap-2 border-b border-white/[0.06] bg-gradient-to-r from-blue-500/[0.04] via-indigo-500/[0.06] to-violet-500/[0.04] px-3 py-3 sm:px-4">
                {[
                  { label: 'Company', icon: Building2, color: '#60a5fa' },
                  { label: 'Contact', icon: Users, color: '#818cf8' },
                  { label: 'Deal', icon: Briefcase, color: '#a78bfa' },
                  { label: 'Activity', icon: CalendarDays, color: '#34d399' },
                ].map(({ label, icon: Icon, color }, index, items) => (
                  <li key={label} className="relative flex min-w-0 flex-col items-center gap-1.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-[#111827]">
                      <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                    </span>
                    <span className="truncate text-[10px] font-semibold text-slate-300">{label}</span>
                    {index < items.length - 1 && <ArrowRight className="absolute -right-2 top-2 h-3.5 w-3.5 text-slate-600" aria-hidden="true" />}
                  </li>
                ))}
              </ol>

              {/* Two-pane layout */}
              <div className="flex h-[380px]">
                {/* Contact list */}
                <div className="w-[55%] border-r border-white/[0.06] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-white/[0.04]">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Companies · {CRM_CONTACTS.length}</p>
                  </div>
                  {CRM_CONTACTS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 border-b border-white/[0.04] text-left transition-colors ${
                        selected.id === c.id ? 'bg-indigo-600/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ background: c.color + '30', border: `1px solid ${c.color}30`, color: c.color }}>
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12px] font-semibold text-white truncate">{c.name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ color: STAGE_COLORS[c.stage], background: STAGE_COLORS[c.stage] + '18' }}>{c.stage}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{c.last}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Detail pane */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {/* Company header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0"
                          style={{ background: selected.color + '25', color: selected.color }}>
                          {selected.avatar}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-white">{selected.name}</p>
                          <p className="text-[10px] text-slate-500">{selected.contact}</p>
                        </div>
                      </div>
                      <button className="text-slate-600 hover:text-slate-400 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Status + value */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
                        <p className="text-[9px] text-slate-600">Status</p>
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${STATUS_STYLES[selected.status] || 'text-slate-400 bg-slate-400/10'}`}>
                          {selected.status}
                        </span>
                      </div>
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
                        <p className="text-[9px] text-slate-600">Deal Value</p>
                        <p className="text-[12px] font-bold text-white">{selected.value}</p>
                      </div>
                    </div>

                    {/* Pipeline stage */}
                    <div>
                      <p className="text-[9px] text-slate-600 mb-2 uppercase tracking-wider">Pipeline Stage</p>
                      <div className="flex items-center gap-1">
                        {['Lead','Qualified','Proposal','Negotiation','Won'].map((stage, i) => {
                          const stages = ['Lead','Qualified','Proposal','Negotiation','Won'];
                          const currentIdx = stages.indexOf(selected.stage);
                          const isActive = i === currentIdx;
                          const isPast   = i < currentIdx;
                          return (
                            <React.Fragment key={stage}>
                              <div className={`flex-1 h-1.5 rounded-full transition-all ${
                                isPast  ? 'bg-indigo-600' :
                                isActive ? 'bg-indigo-500' :
                                'bg-white/[0.08]'
                              }`} />
                              {i < 4 && <div className="h-px w-1 bg-white/[0.04]" />}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-indigo-400 font-semibold mt-1.5">{selected.stage}</p>
                    </div>

                    {/* Activity */}
                    <div>
                      <p className="text-[9px] text-slate-600 mb-2 uppercase tracking-wider">Activity</p>
                      <div className="space-y-1.5">
                        {[
                          { icon: Phone, text: 'Discovery call — 45 min', time: '3d ago', c: '#3b82f6' },
                          { icon: Mail,  text: 'Proposal deck sent',       time: '2h ago', c: '#10b981' },
                          { icon: CheckSquare, text: 'Follow-up scheduled', time: 'Tomorrow', c: '#a78bfa' },
                        ].map((a) => {
                          const Icon = a.icon;
                          return (
                            <div key={a.text} className="flex items-center gap-2 text-[10px]">
                              <Icon className="h-3 w-3 shrink-0" style={{ color: a.c }} />
                              <span className="text-slate-400 flex-1 truncate">{a.text}</span>
                              <span className="text-slate-600 shrink-0">{a.time}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
