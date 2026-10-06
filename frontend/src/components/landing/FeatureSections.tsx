'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users, CheckSquare, MessageSquare, Video, Sparkles, ArrowRight, BarChart3, Calendar, Briefcase, Zap, GitBranch, CheckCircle2, CalendarDays } from 'lucide-react';

/* ── Reusable section container ── */
function Section({ id, children, className = '' }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`landing-section relative py-24 lg:py-32 border-t overflow-hidden ${className}`}>
      {children}
    </section>
  );
}

/* ── TEAM MANAGEMENT SECTION ── */
function TeamSection() {
  const teams = [
    { name: 'Engineering', count: 12, color: '#6366f1',
      members: [
        { n: 'Alex R.', role: 'Lead Dev', status: 'online', task: 'API optimisation', pct: 78 },
        { n: 'Mia C.',  role: 'Frontend', status: 'busy',   task: 'Dashboard redesign', pct: 55 },
        { n: 'Tom L.',  role: 'DevOps',   status: 'online', task: 'CI pipeline fix', pct: 90 },
      ],
    },
    { name: 'Design', count: 6, color: '#ec4899',
      members: [
        { n: 'Sara J.', role: 'Product Designer', status: 'online', task: 'Onboarding flow', pct: 40 },
        { n: 'Jake M.', role: 'Brand',             status: 'away',  task: 'Brand update',    pct: 65 },
      ],
    },
  ];

  const statusDot: Record<string, string> = { online: 'bg-emerald-500', busy: 'bg-amber-400', away: 'bg-slate-400' };

  return (
    <Section id="team">
      <div className="pointer-events-none absolute top-1/2 right-0 w-[500px] h-[400px] bg-violet-600/[0.05] rounded-full blur-[100px] -translate-y-1/2" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* UI — LEFT */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0a0d14]">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-bold text-white">Team</span>
                </div>
                <span className="text-[10px] text-slate-600">32 members · 6 departments</span>
              </div>

              <div className="p-4 space-y-4">
                {teams.map((team) => (
                  <div key={team.name}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                        <span className="text-[12px] font-bold text-white">{team.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{team.count} members</span>
                    </div>
                    <div className="space-y-1.5">
                      {team.members.map((m) => (
                        <div key={m.n} className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                          <div className="relative shrink-0">
                            <div className="h-6 w-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white" style={{ background: team.color + '30', color: team.color }}>
                              {m.n[0]}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-[#0d1117] ${statusDot[m.status]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-white">{m.n}</span>
                              <span className="text-[9px] text-slate-500">{m.role}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: team.color }} />
                              </div>
                              <span className="text-[9px] text-slate-600 shrink-0 truncate max-w-[90px]">{m.task}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Copy — RIGHT */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-4 py-1.5 text-[11px] font-bold text-violet-400 tracking-widest uppercase">
              Team Management
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Know your people.<br />
              <span className="text-violet-400">Align the work.</span>
            </h2>
            <p className="text-base text-slate-400 leading-relaxed max-w-md">
              See who is working on what, across every department. Workload visibility, roles, status and active projects — all in one place.
            </p>
            <ul className="space-y-3">
              {['Departments, roles & permissions', 'Live workload & status', 'Member profiles & skills', 'Cross-team project visibility'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

/* ── WORKFLOW SECTION: Chat → Task → Project → Meeting → AI ── */
function WorkflowSection() {
  const steps = [
    {
      step: 1,
      type: 'Chat',
      color: '#3b82f6',
      icon: MessageSquare,
      preview: (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] p-3">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.04]">
            <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-bold text-white">#product</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-md bg-blue-600/30 text-[8px] font-bold text-blue-300 flex items-center justify-center shrink-0">SR</div>
              <div className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 max-w-[160px]">
                <p className="text-[10px] text-slate-300">"Let's finish the onboarding redesign before launch."</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      step: 2,
      type: 'Task',
      color: '#10b981',
      icon: CheckSquare,
      preview: (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Task</span>
            <span className="text-[9px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded font-bold">High</span>
          </div>
          <p className="text-[11px] font-semibold text-white mb-2">Finish onboarding redesign</p>
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>→ Onboarding Project</span>
            <span>Due Friday</span>
          </div>
        </div>
      ),
    },
    {
      step: 3,
      type: 'Meeting',
      color: '#8b5cf6',
      icon: Video,
      preview: (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/30 rounded-md px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[9px] font-bold text-rose-400">LIVE</span>
            </div>
            <span className="text-[11px] font-bold text-white">Design Review</span>
          </div>
          <div className="flex gap-1">
            {['SR','AR','MC'].map((a) => (
              <div key={a} className="h-6 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-[8px] font-bold text-white">{a}</div>
            ))}
          </div>
        </div>
      ),
    },
    {
      step: 4,
      type: 'Tavro AI Summary',
      color: '#a78bfa',
      icon: Sparkles,
      preview: (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3 w-3 text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-300">Tavro AI Summary</span>
          </div>
          <ul className="space-y-1">
            {['✓ Redesign approved', '3 tasks created', '1 Acme demo scheduled'].map((i) => (
              <li key={i} className="text-[10px] text-slate-400">{i}</li>
            ))}
          </ul>
        </div>
      ),
    },
  ];

  return (
    <Section id="workflow">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-indigo-600/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-4">
            From conversation to completion.
          </h2>
          <p className="text-base text-slate-400">
            One idea becomes a chat, a task, a meeting and an outcome — all tracked in the same workspace.
          </p>
        </motion.div>

        {/* Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-5 z-10 -translate-y-px">
                    <div className="h-px bg-gradient-to-r from-white/20 to-transparent" />
                    <ArrowRight className="h-3 w-3 text-slate-700 absolute -right-1.5 -top-1.5" />
                  </div>
                )}

                <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117]/60 p-4 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: s.color + '20' }}>
                      <Icon className="h-4 w-4" style={{ color: s.color }} />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">Step {s.step}</p>
                      <p className="text-[12px] font-bold text-white">{s.type}</p>
                    </div>
                  </div>
                  {s.preview}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117]/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white">Calendar → Meeting → Team</h3>
              <CalendarDays className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { title: 'Schedule', detail: 'Design Review', icon: CalendarDays, color: '#a78bfa' },
                { title: 'Meeting', detail: 'Shared room', icon: Video, color: '#60a5fa' },
                { title: 'Team', detail: 'People together', icon: Users, color: '#34d399' },
              ].map(({ title, detail, icon: Icon, color }, index) => (
                <div key={title} className="relative min-w-0 rounded-xl border border-white/[0.07] bg-slate-950/45 p-3 text-center">
                  <span className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">{detail}</p>
                  {index < 2 && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#0d1117]/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white">Automation</h3>
              <Zap className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { title: 'Trigger', detail: 'CRM follow-up due', icon: Zap, color: '#fbbf24' },
                { title: 'Workflow', detail: 'Create task reminder', icon: GitBranch, color: '#818cf8' },
                { title: 'Result', detail: 'Team stays on track', icon: CheckCircle2, color: '#34d399' },
              ].map(({ title, detail, icon: Icon, color }, index) => (
                <div key={title} className="relative min-w-0 rounded-xl border border-white/[0.07] bg-slate-950/45 p-3 text-center">
                  <span className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">{detail}</p>
                  {index < 2 && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ── TASKS + PROJECTS SECTION ── */
function TasksSection() {
  const kanbanCols = [
    { label: 'To Do',        color: '#64748b', cards: [{ t: 'Write Q4 proposal',      p: 'High'   }, { t: 'Update docs', p: 'Normal' }] },
    { label: 'In Progress',  color: '#6366f1', cards: [{ t: 'Onboarding redesign',    p: 'High'   }, { t: 'API review',  p: 'Normal' }] },
    { label: 'Review',       color: '#f59e0b', cards: [{ t: 'Acme demo deck',         p: 'Urgent' }] },
    { label: 'Done',         color: '#10b981', cards: [{ t: 'Contract signed',        p: 'High'   }] },
  ];

  const priorityColor: Record<string, string> = { Urgent: '#ef4444', High: '#f59e0b', Normal: '#6366f1' };

  return (
    <Section id="features">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-emerald-600/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="space-y-6 lg:sticky lg:top-24"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-1.5 text-[11px] font-bold text-emerald-400 tracking-widest uppercase">
              Tasks &amp; Projects
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Know what needs to happen next.
            </h2>
            <p className="text-base text-slate-400 leading-relaxed max-w-md">
              Kanban boards, project milestones, priorities and assignments — with real-time updates so every team member sees the same picture.
            </p>
            <ul className="space-y-3">
              {['Kanban and list views', 'Project milestones and progress', 'Priority, assignee and due dates', 'Linked to CRM and meetings'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                  <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Kanban UI */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0a0d14]">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Onboarding Project</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>8 tasks</span>
                  <div className="h-1.5 w-20 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full w-[62%] bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full" />
                  </div>
                  <span className="text-emerald-400 font-bold">62%</span>
                </div>
              </div>

              <div className="relative grid grid-cols-4 gap-2 border-b border-white/[0.05] bg-white/[0.015] px-3 py-2.5 sm:px-4" aria-label="Task pipeline: To Do, In Progress, Review, Done">
                <span className="absolute left-[12.5%] right-[12.5%] top-[17px] h-px bg-gradient-to-r from-slate-500/30 via-indigo-400/45 to-emerald-400/45" aria-hidden="true" />
                {kanbanCols.map((col) => (
                  <div key={col.label} className="relative z-10 flex min-w-0 flex-col items-center gap-1.5 text-center">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[#10131b]" style={{ backgroundColor: col.color }} />
                    <span className="w-full truncate text-[10px] font-semibold text-slate-300">{col.label}</span>
                  </div>
                ))}
              </div>

              {/* Kanban */}
              <div className="p-3 overflow-x-auto">
                <div className="flex gap-3 min-w-[520px]">
                  {kanbanCols.map((col) => (
                    <div key={col.label} className="flex-1 min-w-[120px]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{col.label}</span>
                        <span className="text-[9px] text-slate-600 ml-auto">{col.cards.length}</span>
                      </div>
                      <div className="space-y-2">
                        {col.cards.map((card) => (
                          <div key={card.t} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                            <p className="text-[11px] font-semibold text-slate-200 leading-snug mb-1.5">{card.t}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ color: priorityColor[card.p], background: priorityColor[card.p] + '18' }}>
                              {card.p}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

export function FeatureSections() {
  return (
    <>
      <TeamSection />
      <WorkflowSection />
      <TasksSection />
    </>
  );
}
