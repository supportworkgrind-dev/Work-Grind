'use client';

/**
 * WorkGrind Hero Section — Premium animated product demo
 *
 * Visual strategy:
 *   LEFT  — Strong copy: CRM · Team · Work headline + CTAs
 *   RIGHT — 7-scene live product walkthrough cycling every ~2.2 s
 *           (Overview → CRM → Team → Tasks → Chat → AI → Overview)
 *
 * Animation:
 *   - Staggered entrance (copy → visual)
 *   - Scene auto-advance with smooth crossfade + slide
 *   - Subtle mouse parallax on the whole composition
 *   - Progress bar fills in Tasks scene
 *   - AI typing indicator then response reveal
 *   - prefers-reduced-motion respected throughout
 *
 * Data:
 *   All demo data reflects real WorkGrind features.
 *   No fake metrics, no unsupported claims.
 *   Sample records clearly use fictional company names.
 */

import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import Link from 'next/link';
import {
  motion, AnimatePresence, useReducedMotion,
} from 'framer-motion';
import {
  ArrowRight, ChevronRight,
  LayoutDashboard, Users, MessageSquare, CheckSquare,
  Briefcase, Calendar, FolderOpen, Sparkles, Video,
  Bell, Search, Plus, CheckCircle2, Clock,
  Building2, TrendingUp, Target, Circle,
  Hash, Send, AtSign,
} from 'lucide-react';
import styles from '@/app/landing.module.css';

/* ═══════════════════════════════════════════════════════════
   DEMO DATA — consistent across all scenes
   ═══════════════════════════════════════════════════════════ */

const D = {
  user:  { name: 'Sarah Chen', initials: 'SC' },

  stats: [
    { label: 'Open Tasks',      value: '12', sub: '+2 today',   col: '#6366f1' },
    { label: 'Active Projects', value: '4',  sub: '2 on track', col: '#10b981' },
    { label: 'Meetings Today',  value: '3',  sub: '1 in 45m',   col: '#3b82f6' },
  ],

  pipeline: ['New Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'],

  crm: [
    { name: 'Acme Corp',     contact: 'David Park',   stage: 'Proposal',   value: '$48k', col: '#3b82f6', av: 'AC', st: 'active'   },
    { name: 'Globex Inc',    contact: 'Maria Santos', stage: 'Qualified',  value: '$22k', col: '#f59e0b', av: 'GI', st: 'followup' },
    { name: 'Initech Group', contact: 'James Liu',    stage: 'Won',        value: '$95k', col: '#10b981', av: 'IG', st: 'won'      },
    { name: 'Umbrella Co',   contact: 'Lin Chen',     stage: 'New Lead',   value: '$9k',  col: '#8b5cf6', av: 'UC', st: 'new'      },
  ],

  tasks: [
    { title: 'Review Acme proposal',     priority: 'Urgent', pct: 90,  done: false, av: 'SC' },
    { title: 'Update onboarding docs',   priority: 'High',   pct: 55,  done: false, av: 'AR' },
    { title: 'Q4 planning session',      priority: 'Normal', pct: 20,  done: false, av: 'SC' },
    { title: 'Deploy auth improvements', priority: 'High',   pct: 100, done: true,  av: 'TL' },
  ],

  team: [
    { dept: 'Engineering', count: 8, pct: 78, col: '#6366f1' },
    { dept: 'Design',      count: 4, pct: 60, col: '#ec4899' },
    { dept: 'Sales',       count: 6, pct: 85, col: '#10b981' },
    { dept: 'Marketing',   count: 5, pct: 55, col: '#f59e0b' },
  ],

  chat: {
    channel: 'sales',
    messages: [
      { from: 'Maria S',  av: 'MS', col: '#f59e0b', text: 'Globex demo went great! They want a proposal by Friday.' },
      { from: 'David P',  av: 'DP', col: '#3b82f6', text: 'On it — I\'ll prep the Globex deck now.' },
      { from: 'Sarah C',  av: 'SC', col: '#6366f1', text: 'Nice work 🎉 Tagging this to the Globex deal in CRM.' },
    ],
  },

  meetings: [
    { title: 'Acme Demo Call',  time: '2:00 PM', people: 4, status: 'soon'  },
    { title: 'Sprint Review',   time: '4:30 PM', people: 6, status: 'later' },
  ],

  ai: {
    q: 'What needs attention today?',
    a: '3 overdue tasks · 1 customer follow-up due · Acme demo at 2:00 PM',
  },
} as const;

/* colour helpers */
const PRIO_COL: Record<string, string> = { Urgent: '#ef4444', High: '#f59e0b', Normal: '#6366f1' };
const ST_STYLE: Record<string, { label: string; col: string; bg: string }> = {
  active:   { label: 'Active',    col: '#10b981', bg: '#10b98118' },
  followup: { label: 'Follow-up', col: '#f59e0b', bg: '#f59e0b18' },
  won:      { label: 'Won',       col: '#6366f1', bg: '#6366f118' },
  new:      { label: 'New Lead',  col: '#3b82f6', bg: '#3b82f618' },
};

/* ═══════════════════════════════════════════════════════════
   SCENE DEFINITIONS
   ═══════════════════════════════════════════════════════════ */

type SceneKey = 'overview' | 'crm' | 'team' | 'tasks' | 'chat' | 'ai' | 'return';

const SCENES: { key: SceneKey; label: string; icon: React.ElementType; col: string }[] = [
  { key: 'overview', label: 'Overview',  icon: LayoutDashboard, col: '#6366f1' },
  { key: 'tasks',    label: 'Tasks',     icon: CheckSquare,     col: '#10b981' },
  { key: 'crm',      label: 'CRM',       icon: Building2,       col: '#3b82f6' },
  { key: 'team',     label: 'Team',      icon: Users,           col: '#8b5cf6' },
  { key: 'chat',     label: 'Collaboration', icon: MessageSquare, col: '#06b6d4' },
  { key: 'ai',       label: 'Tavro AI',  icon: Sparkles,        col: '#c084fc' },
];

const STORY_SCENES: SceneKey[] = ['overview', 'tasks', 'crm', 'chat', 'ai'];

const WORKSPACE_AREAS = [
  { label: 'CRM', icon: Building2, color: '#60a5fa' },
  { label: 'Tasks', icon: CheckSquare, color: '#34d399' },
  { label: 'Calendar', icon: Calendar, color: '#a78bfa' },
  { label: 'Team', icon: Users, color: '#c084fc' },
  { label: 'Tavro AI', icon: Sparkles, color: '#67e8f9' },
];

const SCENE_DURATION = 5000;

/* ═══════════════════════════════════════════════════════════
   MICRO COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/** Animated progress bar — fills on mount */
function Bar({
  pct, col, delay = 0, reduced,
}: { pct: number; col: string; delay?: number; reduced: boolean }) {
  return (
    <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: col }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduced ? 0 : 0.85, delay: reduced ? 0 : delay, ease: 'easeOut' }}
      />
    </div>
  );
}

/** Sidebar nav item */
function SideNav({ icon: Icon, label, active, col }: {
  icon: React.ElementType; label: string; active: boolean; col: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium cursor-default ${
      active ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-600'
    }`}>
      <Icon className="h-3 w-3 shrink-0" style={{ color: active ? col : undefined }} />
      <span>{label}</span>
    </div>
  );
}

/** Window chrome bar */
function Chrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-[#090c13]">
      <div className="h-2 w-2 rounded-full bg-rose-500/50" />
      <div className="h-2 w-2 rounded-full bg-amber-400/50" />
      <div className="h-2 w-2 rounded-full bg-emerald-400/50" />
      <div className="ml-3 flex items-center gap-1.5">
        <div className="h-5 w-5 rounded-md bg-indigo-600 flex items-center justify-center">
          <span className="text-[7px] font-black text-white">TF</span>
        </div>
        <span className="text-[10px] text-slate-500">WorkGrind — {label}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.05] px-2 py-1">
          <Search className="h-2.5 w-2.5 text-slate-600" />
          <span className="text-[9px] text-slate-600">Search…</span>
        </div>
        <Bell className="h-3.5 w-3.5 text-slate-600" />
        <div className="h-5 w-5 rounded-md bg-indigo-600/40 flex items-center justify-center text-[7px] font-black text-indigo-300">SC</div>
      </div>
    </div>
  );
}

const ALL_NAV = [
  { label: 'Overview',  icon: LayoutDashboard, col: '#6366f1' },
  { label: 'CRM',       icon: Building2,       col: '#3b82f6' },
  { label: 'Team',      icon: Users,           col: '#8b5cf6' },
  { label: 'Chat',      icon: MessageSquare,   col: '#06b6d4' },
  { label: 'Tasks',     icon: CheckSquare,     col: '#10b981' },
  { label: 'Projects',  icon: Briefcase,       col: '#f59e0b' },
  { label: 'Meetings',  icon: Video,           col: '#ec4899' },
  { label: 'Calendar',  icon: Calendar,        col: '#a78bfa' },
  { label: 'Tavro AI',  icon: Sparkles,        col: '#c084fc' },
] as const;

/** Persistent sidebar used in every scene */
function AppSidebar({ activeLabel }: { activeLabel: string }) {
  return (
    <div className="w-[108px] shrink-0 border-r border-white/[0.06] bg-[#090c13] flex flex-col py-2 px-1.5 gap-0.5 overflow-hidden">
      {ALL_NAV.map((n) => (
        <SideNav key={n.label} icon={n.icon as React.ElementType} label={n.label}
          active={n.label === activeLabel} col={n.col} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCENE CONTENT PANELS
   ═══════════════════════════════════════════════════════════ */

/** Scene 1 — Overview dashboard */
function SceneOverview({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-3">
      <div>
        <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-0.5">Overview</p>
        <p className="text-[13px] font-bold text-white">Good morning, {D.user.name} ☀️</p>
      </div>
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-1.5">
        {D.stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
            <p className="text-[8px] text-slate-500 mb-1">{s.label}</p>
            <span className="text-[17px] font-black text-white leading-none">{s.value}</span>
            <p className="text-[8px] font-semibold" style={{ color: s.col }}>{s.sub}</p>
          </div>
        ))}
      </div>
      {/* Recent tasks */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1.5">My Tasks</p>
        <div className="space-y-1">
          {D.tasks.slice(0, 3).map((t, i) => (
            <motion.div key={t.title}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.07 }}
              className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5">
              <div className={`h-3 w-3 rounded border shrink-0 flex items-center justify-center ${
                t.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20'
              }`}>
                {t.done && <CheckCircle2 className="h-2 w-2 text-emerald-400" />}
              </div>
              <span className={`text-[10px] flex-1 truncate ${t.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>{t.title}</span>
              <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
                style={{ color: PRIO_COL[t.priority], background: PRIO_COL[t.priority] + '18' }}>
                {t.priority}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Meetings */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1.5">Today's Meetings</p>
        <div className="flex gap-1.5">
          {D.meetings.map((m) => (
            <div key={m.title} className="flex-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Clock className="h-2.5 w-2.5 text-blue-400" /><span className="text-[9px] font-bold text-blue-400">{m.time}</span>
              </div>
              <p className="text-[10px] font-semibold text-white truncate">{m.title}</p>
              <p className="text-[9px] text-slate-500">{m.people} people</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Scene 2 — CRM Pipeline */
function SceneCRM({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Pipeline stages */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Sales Pipeline · Demo workspace</p>
          <button className="flex items-center gap-1 text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
            <Plus className="h-2.5 w-2.5" />New deal
          </button>
        </div>
        <div className="flex items-center gap-0.5 overflow-hidden">
          {D.pipeline.map((stage, i) => (
            <React.Fragment key={stage}>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                i < 3 ? 'text-indigo-300 bg-indigo-500/15' : i === 4 ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400 bg-white/[0.05]'
              }`}>{stage}</span>
              {i < D.pipeline.length - 1 && <ChevronRight className="h-2.5 w-2.5 text-slate-700 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      {/* Contacts */}
      <div className="flex-1 divide-y divide-white/[0.04] overflow-hidden">
        {D.crm.map((c, i) => {
          const ss = ST_STYLE[c.st];
          return (
            <motion.div key={c.name}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : i * 0.08 }}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.02]">
              <div className="h-7 w-7 rounded-xl flex items-center justify-center text-[9px] font-black shrink-0"
                style={{ background: c.col + '22', color: c.col }}>{c.av}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white truncate">{c.name}</p>
                <p className="text-[9px] text-slate-500 truncate">{c.contact}</p>
              </div>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                style={{ color: ss.col, background: ss.bg }}>{c.stage}</span>
              <span className="text-[9px] font-bold text-slate-400 shrink-0">{c.value}</span>
            </motion.div>
          );
        })}
      </div>
      {/* Pipeline total */}
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] text-slate-500">Total pipeline value</span>
        <span className="text-[11px] font-black text-emerald-400">$174k</span>
      </div>
    </div>
  );
}

/** Scene 3 — Team */
function SceneTeam({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Team Workload</p>
        <span className="text-[9px] text-slate-500">23 members</span>
      </div>
      {D.team.map((t, i) => (
        <motion.div key={t.dept}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.07 }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: t.col }} />
              <span className="text-[10px] font-semibold text-slate-200">{t.dept}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500">{t.count} members</span>
              <span className="text-[9px] font-bold" style={{ color: t.col }}>{t.pct}%</span>
            </div>
          </div>
          <Bar pct={t.pct} col={t.col} delay={i * 0.09} reduced={reduced} />
        </motion.div>
      ))}
      {/* Quick member avatars */}
      <div className="pt-1">
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">Online now</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['SC', 'DP', 'AR', 'TL', 'MS', 'JL'].map((av, i) => (
            <div key={av} className="relative">
              <div className="h-7 w-7 rounded-xl bg-indigo-600/30 flex items-center justify-center text-[8px] font-black text-indigo-300">
                {av}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#0d1117]" />
            </div>
          ))}
          <div className="h-7 w-7 rounded-xl bg-white/[0.05] flex items-center justify-center text-[8px] text-slate-500">+17</div>
        </div>
      </div>
    </div>
  );
}

/** Scene 4 — Tasks */
function SceneTasks({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">My Tasks</p>
        <button className="flex items-center gap-1 text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
          <Plus className="h-2.5 w-2.5" />New
        </button>
      </div>
      {D.tasks.map((t, i) => (
        <motion.div key={t.title}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.07 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center ${
              t.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20'
            }`}>
              {t.done && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
            </div>
            <span className={`text-[10px] font-medium flex-1 truncate ${t.done ? 'line-through text-slate-600' : 'text-slate-200'}`}>
              {t.title}
            </span>
            <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
              style={{ color: PRIO_COL[t.priority], background: PRIO_COL[t.priority] + '18' }}>
              {t.priority}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Bar pct={t.pct} col={t.done ? '#10b981' : PRIO_COL[t.priority]} delay={i * 0.1} reduced={reduced} />
            <span className="text-[9px] font-bold shrink-0"
              style={{ color: t.done ? '#10b981' : PRIO_COL[t.priority] }}>
              {t.pct}%
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Scene 5 — Chat */
function SceneChat({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Hash className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[11px] font-semibold text-white">{D.chat.channel}</span>
        <span className="text-[9px] text-slate-600 ml-1">Sales team</span>
      </div>
      {/* Messages */}
      <div className="flex-1 p-3 space-y-3 overflow-hidden">
        {D.chat.messages.map((msg, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : i * 0.14 }}
            className="flex items-start gap-2.5">
            <div className="h-7 w-7 rounded-xl flex items-center justify-center text-[8px] font-black shrink-0"
              style={{ background: msg.col + '25', color: msg.col }}>{msg.av}</div>
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[10px] font-semibold text-slate-300">{msg.from}</span>
                <span className="text-[8px] text-slate-600">just now</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{msg.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
      {/* Input bar */}
      <div className="px-3 py-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-1.5">
          <span className="text-[10px] text-slate-600 flex-1">Message #sales…</span>
          <Send className="h-3 w-3 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

/** Scene 6 — AI */
function SceneAI({ reduced }: { reduced: boolean }) {
  const [showResp, setShowResp] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    setShowResp(false);
    setDots('');
    if (reduced) { setShowResp(true); return; }

    let dotTimer: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      dotTimer = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 350);
      setTimeout(() => { clearInterval(dotTimer); setShowResp(true); }, 1400);
    }, 400);

    return () => { clearTimeout(start); clearInterval(dotTimer); };
  }, [reduced]);

  return (
    <div className="flex-1 overflow-hidden p-3 flex flex-col gap-3">
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Tavro AI</p>
        <div className="rounded-xl bg-violet-600/10 border border-violet-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span className="text-[10px] font-semibold text-violet-300">Tavro AI</span>
          </div>
          <p className="text-[10px] text-slate-400">Connected to your workspace context — tasks, CRM, calendar and team activity.</p>
        </div>
      </div>

      {/* Conversation */}
      <div className="space-y-2 flex-1">
        {/* User message */}
        <div className="flex items-start gap-2">
          <div className="h-5 w-5 rounded-md bg-indigo-600/30 flex items-center justify-center text-[7px] font-black text-indigo-300">SC</div>
          <div className="rounded-xl bg-indigo-600/15 border border-indigo-500/20 px-2.5 py-1.5">
            <p className="text-[10px] text-indigo-200">{D.ai.q}</p>
          </div>
        </div>
        {/* AI response */}
        <div className="flex items-start gap-2">
          <div className="h-5 w-5 rounded-md bg-violet-600/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-3 w-3 text-violet-400" />
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-2.5 py-1.5 flex-1 min-h-[28px]">
            <AnimatePresence mode="wait">
              {!showResp ? (
                <motion.p key="typing" className="text-[10px] text-slate-600"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Thinking{dots}
                </motion.p>
              ) : (
                <motion.p key="resp" className="text-[10px] text-slate-300 leading-relaxed"
                  initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}>
                  {D.ai.a}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* scene router */
function SceneContent({ scene, reduced }: { scene: SceneKey; reduced: boolean }) {
  const map: Record<SceneKey, React.ReactNode> = {
    overview: <SceneOverview reduced={reduced} />,
    crm:      <SceneCRM      reduced={reduced} />,
    team:     <SceneTeam     reduced={reduced} />,
    tasks:    <SceneTasks    reduced={reduced} />,
    chat:     <SceneChat     reduced={reduced} />,
    ai:       <SceneAI       reduced={reduced} />,
    return:   <SceneOverview reduced={reduced} />,
  };
  return <>{map[scene]}</>;
}

/* ═══════════════════════════════════════════════════════════
   SCENE INDICATOR + SCENE LABEL BADGE
   ═══════════════════════════════════════════════════════════ */

function SceneIndicator({
  current, total, col,
}: { current: number; total: number; col: string }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-1 rounded-full transition-all duration-500"
          style={{
            width: i === current ? 16 : 4,
            background: i === current ? col : 'rgba(255,255,255,0.15)',
          }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOUSE PARALLAX HOOK
   ═══════════════════════════════════════════════════════════ */

function useMouseParallax(factor = 0.004) {
  const elementRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const reduced = useReducedMotion();

  const handleMove = useCallback((e: MouseEvent) => {
    if (reduced) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      const element = elementRef.current;
      if (!element) return;
      const x = (e.clientX - cx) * factor;
      const y = (e.clientY - cy) * factor;
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }, [reduced, factor]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => { window.removeEventListener('mousemove', handleMove); cancelAnimationFrame(frameRef.current); };
  }, [handleMove]);

  return elementRef;
}

/* ═══════════════════════════════════════════════════════════
   PRODUCT DEMO WINDOW
   ═══════════════════════════════════════════════════════════ */

function ProductDemo({ reduced }: { reduced: boolean }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const scene = SCENES[sceneIdx];

  /* Auto-advance unless reduced-motion */
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      const storyIndex = STORY_SCENES.indexOf(scene.key);
      const nextStoryScene = STORY_SCENES[(storyIndex + 1) % STORY_SCENES.length];
      setSceneIdx(SCENES.findIndex(({ key }) => key === nextStoryScene));
    }, SCENE_DURATION);
    return () => clearTimeout(t);
  }, [reduced, scene]);

  const sceneVariants = {
    enter:  { opacity: 0, y: 6 },
    center: { opacity: 1, y: 0,  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as any } },
    exit:   { opacity: 0, y: -4, transition: { duration: 0.2, ease: 'easeIn' as const } },
  };

  /* Map scene key → sidebar active label */
  const sidebarLabel: Record<SceneKey, string> = {
    overview: 'Overview',
    crm:      'CRM',
    team:     'Team',
    tasks:    'Tasks',
    chat:     'Chat',
    ai:       'AI',
    return:   'Overview',
  };

  return (
    <div className="landing-preview rounded-2xl border border-white/[0.09] bg-[#0d1117] shadow-[0_28px_72px_rgba(0,0,0,0.65)] overflow-hidden">
      {/* Window chrome */}
      <Chrome label={scene.label} />

      <div className="flex" style={{ height: 340 }}>
        {/* Persistent sidebar — active item animates on scene change */}
        <AppSidebar activeLabel={sidebarLabel[scene.key]} />

        {/* Scene content — crossfades between scenes */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.key}
              variants={sceneVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              <SceneContent scene={scene.key} reduced={reduced} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom bar — scene indicator + label + LIVE PRODUCT PREVIEW badge */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.05] bg-[#090c13]">
        <div className="flex items-center gap-3">
          <SceneIndicator current={sceneIdx} total={SCENES.length} col={scene.col} />
          <AnimatePresence mode="wait">
            <motion.div key={scene.key} className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.25 }}>
              {React.createElement(scene.icon as React.ElementType, {
                className: 'h-3 w-3 shrink-0',
                style: { color: scene.col },
              })}
              <span className="text-[9px] font-semibold" style={{ color: scene.col }}>{scene.label}</span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Live Preview</span>
        </div>
      </div>

      <div role="group" aria-label="Choose a product preview scene" className="flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.05] bg-[#090c13] px-3 py-2">
        {SCENES.map((s, i) => {
          const Icon = s.icon;
          const selected = i === sceneIdx;
          return (
            <button
              key={s.key}
              type="button"
              title={`Show ${s.label} preview`}
              aria-label={`Show ${s.label} preview`}
              aria-pressed={selected}
              onClick={() => setSceneIdx(i)}
              className="landing-button-icon flex h-10 min-w-10 items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-all duration-200 hover:scale-[1.03] focus-visible:outline-none"
              style={{
                color: selected ? s.col : undefined,
                borderColor: selected ? `${s.col}80` : 'rgba(255,255,255,0.08)',
                backgroundColor: selected ? `${s.col}20` : undefined,
              }}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="img"
        aria-label="WorkGrind connects CRM, Tasks, Calendar, Team, and Tavro AI"
        className="relative border-t border-white/[0.05] bg-gradient-to-b from-[#0b0f19] to-[#090c13] px-2 py-3 sm:px-4"
      >
        <div className="absolute left-[12%] right-[12%] top-[28px] h-px bg-gradient-to-r from-blue-400/20 via-indigo-300/60 to-cyan-300/20" aria-hidden="true" />
        <div className="relative grid grid-cols-5 gap-1">
          {WORKSPACE_AREAS.map(({ label, icon: Icon, color }) => (
            <div key={label} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#111827] shadow-[0_4px_14px_rgba(0,0,0,.24)]">
                <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
              </span>
              <span className="truncate text-[9px] font-semibold text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════════════ */

export function HeroSection() {
  const reduced  = !!useReducedMotion();
  const parallaxRef = useMouseParallax(0.015);

  const copyVariants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.1 } },
  };
  const lineVariant = {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as any } },
  };

  return (
    <section
      className="landing-hero relative flex items-center overflow-hidden"
      style={{ paddingTop: '4rem' }}
      aria-label="WorkGrind — CRM, team and work management"
    >
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-center">

          {/* ══ LEFT: Copy ══ */}
          <motion.div
            variants={copyVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            {/* Eyebrow */}
            <motion.div variants={lineVariant} className="mb-5">
              <span className={`${styles.heroEyebrow} inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide`}>
                The Connected Workspace for Modern Teams
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={lineVariant}
              className={`${styles.heroTitle} font-black text-white mb-5`}
            >
              Run your team.<br />
              Manage customers.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400">
                Move work forward.
              </span>
            </motion.h1>

            {/* Supporting line */}
            <motion.p
              variants={lineVariant}
              className={`${styles.heroDescription} text-slate-400 max-w-[65ch] mx-auto lg:mx-0 mb-7`}
            >
              WorkGrind brings CRM, team collaboration, tasks, projects, meetings,
              documents and AI into one connected workspace for serious businesses.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={lineVariant}
              className={`${styles.heroActions} flex flex-col gap-3 justify-center lg:justify-start mb-8`}
            >
              <Link
                href="/signup"
                className={`${styles.heroPrimaryCta} group inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3 rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.97]`}
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/how-it-works"
                className={`${styles.heroSecondaryCta} inline-flex items-center justify-center gap-2 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white font-semibold px-7 py-3 rounded-xl transition-all active:scale-[0.97]`}
              >
                See How It Works
                <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Feature proof row */}
            <motion.div
              variants={lineVariant}
              className={`${styles.heroProof} flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start`}
            >
              {([
                { icon: Building2,   label: 'CRM & Contacts'   },
                { icon: Users,       label: 'Team Management'  },
                { icon: CheckSquare, label: 'Tasks & Projects' },
                { icon: Sparkles,    label: 'Tavro AI'          },
              ] as const).map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  <Icon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  {label}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* ══ RIGHT: Animated product demo ══ */}
          <motion.div
            ref={parallaxRef}
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <ProductDemo reduced={reduced} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
