'use client';

/**
 * WorkGrind Hero Section — Premium animated product demo
 *
 * Visual strategy:
 *   LEFT  — Choose a workspace for personal work, business, or education
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
 *   The preview uses illustrative sample content, not live account data.
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
  BookOpen, GraduationCap,
  School,
} from 'lucide-react';
import styles from '@/app/landing.module.css';
import { useT } from '@/lib/i18n';

/* ═══════════════════════════════════════════════════════════
   DEMO DATA — consistent across all scenes
   Display text lives in the `landing` messages (hero.demo.*);
   names, companies and amounts are sample values shown as-is.
   ═══════════════════════════════════════════════════════════ */

const D = {
  user:  { name: 'Sarah Chen', initials: 'SC' },

  stats: [
    { id: 'openTasks',      value: '12', col: '#6366f1' },
    { id: 'activeProjects', value: '4',  col: '#10b981' },
    { id: 'meetingsToday',  value: '3',  col: '#3b82f6' },
  ],

  pipeline: ['newLead', 'qualified', 'proposal', 'negotiation', 'won'],

  crm: [
    { name: 'Acme Corp',     contact: 'David Park',   stage: 'proposal',   value: '$48k', col: '#3b82f6', av: 'AC', st: 'active'   },
    { name: 'Globex Inc',    contact: 'Maria Santos', stage: 'qualified',  value: '$22k', col: '#f59e0b', av: 'GI', st: 'followup' },
    { name: 'Initech Group', contact: 'James Liu',    stage: 'won',        value: '$95k', col: '#10b981', av: 'IG', st: 'won'      },
    { name: 'Umbrella Co',   contact: 'Lin Chen',     stage: 'newLead',    value: '$9k',  col: '#8b5cf6', av: 'UC', st: 'new'      },
  ],

  tasks: [
    { id: 'reviewAcme',     priority: 'urgent', pct: 90,  done: false, av: 'SC' },
    { id: 'onboardingDocs', priority: 'high',   pct: 55,  done: false, av: 'AR' },
    { id: 'q4Planning',     priority: 'normal', pct: 20,  done: false, av: 'SC' },
    { id: 'deployAuth',     priority: 'high',   pct: 100, done: true,  av: 'TL' },
  ],

  team: [
    { dept: 'engineering', count: 8, pct: 78, col: '#6366f1' },
    { dept: 'design',      count: 4, pct: 60, col: '#ec4899' },
    { dept: 'sales',       count: 6, pct: 85, col: '#10b981' },
    { dept: 'marketing',   count: 5, pct: 55, col: '#f59e0b' },
  ],

  chat: {
    channel: 'sales',
    messages: [
      { id: 'maria', from: 'Maria S',  av: 'MS', col: '#f59e0b' },
      { id: 'david', from: 'David P',  av: 'DP', col: '#3b82f6' },
      { id: 'sarah', from: 'Sarah C',  av: 'SC', col: '#6366f1' },
    ],
  },

  meetings: [
    { id: 'acmeDemo',     people: 4, status: 'soon'  },
    { id: 'sprintReview', people: 6, status: 'later' },
  ],
} as const;

/* colour helpers */
type Priority = (typeof D.tasks)[number]['priority'];
const PRIO_COL: Record<Priority, string> = { urgent: '#ef4444', high: '#f59e0b', normal: '#6366f1' };
const ST_STYLE: Record<string, { col: string; bg: string }> = {
  active:   { col: '#10b981', bg: '#10b98118' },
  followup: { col: '#f59e0b', bg: '#f59e0b18' },
  won:      { col: '#6366f1', bg: '#6366f118' },
  new:      { col: '#3b82f6', bg: '#3b82f618' },
};

/* ═══════════════════════════════════════════════════════════
   SCENE DEFINITIONS
   ═══════════════════════════════════════════════════════════ */

type SceneKey = 'overview' | 'crm' | 'team' | 'tasks' | 'chat' | 'ai' | 'return';
type SceneTabKey = Exclude<SceneKey, 'return'>;

const SCENES: { key: SceneTabKey; icon: React.ElementType; col: string }[] = [
  { key: 'overview', icon: LayoutDashboard, col: '#6366f1' },
  { key: 'tasks',    icon: CheckSquare,     col: '#10b981' },
  { key: 'crm',      icon: Building2,       col: '#3b82f6' },
  { key: 'team',     icon: Users,           col: '#8b5cf6' },
  { key: 'chat',     icon: MessageSquare,   col: '#06b6d4' },
  { key: 'ai',       icon: Sparkles,        col: '#c084fc' },
];

const STORY_SCENES: SceneKey[] = ['overview', 'tasks', 'crm', 'chat', 'ai'];

const WORKSPACE_AREAS = [
  { id: 'personal',  icon: CheckSquare,   color: '#34d399' },
  { id: 'business',  icon: Building2,     color: '#60a5fa' },
  { id: 'classes',   icon: BookOpen,      color: '#a78bfa' },
  { id: 'academics', icon: GraduationCap, color: '#c084fc' },
  { id: 'tavro',     icon: Sparkles,      color: '#67e8f9' },
] as const;

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
      {/* Animate scaleX (compositor-only) rather than width, which relaid out every frame. */}
      <motion.div
        className="h-full rounded-full origin-left rtl:origin-right"
        style={{ background: col, width: `${pct}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
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
  const t = useT('landing');
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-[#090c13]">
      <div className="h-2 w-2 rounded-full bg-rose-500/50" />
      <div className="h-2 w-2 rounded-full bg-amber-400/50" />
      <div className="h-2 w-2 rounded-full bg-emerald-400/50" />
      <div className="ms-3 flex items-center gap-1.5">
        <div className="h-5 w-5 rounded-md bg-indigo-600 flex items-center justify-center">
          <span className="text-[7px] font-black text-white">WG</span>
        </div>
        {/* Product name and window label; the label is translated. */}
        <span className="text-[10px] text-slate-500">WorkGrind — {label}</span>
      </div>
      <div className="ms-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.05] px-2 py-1">
          <Search className="h-2.5 w-2.5 text-slate-600" />
          <span className="text-[9px] text-slate-600">{t('hero.demo.search')}</span>
        </div>
        <Bell className="h-3.5 w-3.5 text-slate-600" />
        <div className="h-5 w-5 rounded-md bg-indigo-600/40 flex items-center justify-center text-[7px] font-black text-indigo-300">SC</div>
      </div>
    </div>
  );
}

const ALL_NAV = [
  { id: 'overview',  icon: LayoutDashboard, col: '#6366f1' },
  { id: 'crm',       icon: Building2,       col: '#3b82f6' },
  { id: 'team',      icon: Users,           col: '#8b5cf6' },
  { id: 'chat',      icon: MessageSquare,   col: '#06b6d4' },
  { id: 'tasks',     icon: CheckSquare,     col: '#10b981' },
  { id: 'projects',  icon: Briefcase,       col: '#f59e0b' },
  { id: 'meetings',  icon: Video,           col: '#ec4899' },
  { id: 'calendar',  icon: Calendar,        col: '#a78bfa' },
  { id: 'tavro',     icon: Sparkles,        col: '#c084fc' },
] as const;

/** Persistent sidebar used in every scene */
function AppSidebar({ activeId }: { activeId: string }) {
  const t = useT('landing');
  return (
    <div className="w-[108px] shrink-0 border-e border-white/[0.06] bg-[#090c13] flex flex-col py-2 px-1.5 gap-0.5 overflow-hidden">
      {ALL_NAV.map((n) => (
        <SideNav key={n.id} icon={n.icon as React.ElementType} label={t(`hero.demo.nav.${n.id}`)}
          active={n.id === activeId} col={n.col} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCENE CONTENT PANELS
   ═══════════════════════════════════════════════════════════ */

/** Scene 1 — Overview dashboard */
function SceneOverview({ reduced }: { reduced: boolean }) {
  const t = useT('landing');
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-3">
      <div>
        <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-0.5">{t('hero.demo.scenes.overview')}</p>
        <p className="text-[13px] font-bold text-white">{t('hero.demo.overview.greeting', { name: D.user.name })}</p>
      </div>
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-1.5">
        {D.stats.map((s) => (
          <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
            <p className="text-[8px] text-slate-500 mb-1">{t(`hero.demo.overview.stats.${s.id}.label`)}</p>
            <span className="text-[17px] font-black text-white leading-none">{s.value}</span>
            <p className="text-[8px] font-semibold" style={{ color: s.col }}>{t(`hero.demo.overview.stats.${s.id}.sub`)}</p>
          </div>
        ))}
      </div>
      {/* Recent tasks */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1.5">{t('hero.demo.overview.myTasks')}</p>
        <div className="space-y-1">
          {D.tasks.slice(0, 3).map((task, i) => (
            <motion.div key={task.id}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.07 }}
              className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5">
              <div className={`h-3 w-3 rounded border shrink-0 flex items-center justify-center ${
                task.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20'
              }`}>
                {task.done && <CheckCircle2 className="h-2 w-2 text-emerald-400" />}
              </div>
              <span className={`text-[10px] flex-1 truncate ${task.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>{t(`hero.demo.tasks.${task.id}`)}</span>
              <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
                style={{ color: PRIO_COL[task.priority], background: PRIO_COL[task.priority] + '18' }}>
                {t(`sample.priority.${task.priority}`)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Meetings */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1.5">{t('hero.demo.overview.todaysMeetings')}</p>
        <div className="flex gap-1.5">
          {D.meetings.map((m) => (
            <div key={m.id} className="flex-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Clock className="h-2.5 w-2.5 text-blue-400" /><span className="text-[9px] font-bold text-blue-400">{t(`hero.demo.meetings.${m.id}.time`)}</span>
              </div>
              <p className="text-[10px] font-semibold text-white truncate">{t(`hero.demo.meetings.${m.id}.title`)}</p>
              <p className="text-[9px] text-slate-500">{t('hero.demo.overview.people', { count: m.people })}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Scene 2 — CRM Pipeline */
function SceneCRM({ reduced }: { reduced: boolean }) {
  const t = useT('landing');
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Pipeline stages */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{t('hero.demo.crm.heading')}</p>
          <button className="flex items-center gap-1 text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
            <Plus className="h-2.5 w-2.5" />{t('hero.demo.crm.newDeal')}
          </button>
        </div>
        <div className="flex items-center gap-0.5 overflow-hidden">
          {D.pipeline.map((stage, i) => (
            <React.Fragment key={stage}>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                i < 3 ? 'text-indigo-300 bg-indigo-500/15' : i === 4 ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400 bg-white/[0.05]'
              }`}>{t(`hero.demo.crm.stages.${stage}`)}</span>
              {i < D.pipeline.length - 1 && <ChevronRight className="rtl-mirror h-2.5 w-2.5 text-slate-700 shrink-0" />}
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
                style={{ color: ss.col, background: ss.bg }}>{t(`hero.demo.crm.stages.${c.stage}`)}</span>
              <span className="text-[9px] font-bold text-slate-400 shrink-0">{c.value}</span>
            </motion.div>
          );
        })}
      </div>
      {/* Pipeline total */}
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] text-slate-500">{t('hero.demo.crm.totalValue')}</span>
        <span className="text-[11px] font-black text-emerald-400">$174k</span>
      </div>
    </div>
  );
}

/** Scene 3 — Team */
function SceneTeam({ reduced }: { reduced: boolean }) {
  const t = useT('landing');
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{t('hero.demo.team.heading')}</p>
        <span className="text-[9px] text-slate-500">{t('sample.members', { count: 23 })}</span>
      </div>
      {D.team.map((team, i) => (
        <motion.div key={team.dept}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.07 }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: team.col }} />
              <span className="text-[10px] font-semibold text-slate-200">{t(`sample.departments.${team.dept}`)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500">{t('sample.members', { count: team.count })}</span>
              <span className="text-[9px] font-bold" style={{ color: team.col }}>{team.pct}%</span>
            </div>
          </div>
          <Bar pct={team.pct} col={team.col} delay={i * 0.09} reduced={reduced} />
        </motion.div>
      ))}
      {/* Quick member avatars */}
      <div className="pt-1">
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">{t('hero.demo.team.onlineNow')}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['SC', 'DP', 'AR', 'TL', 'MS', 'JL'].map((av, i) => (
            <div key={av} className="relative">
              <div className="h-7 w-7 rounded-xl bg-indigo-600/30 flex items-center justify-center text-[8px] font-black text-indigo-300">
                {av}
              </div>
              <span className="absolute -bottom-0.5 -end-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#0d1117]" />
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
  const t = useT('landing');
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{t('hero.demo.overview.myTasks')}</p>
        <button className="flex items-center gap-1 text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
          <Plus className="h-2.5 w-2.5" />{t('hero.demo.newTask')}
        </button>
      </div>
      {D.tasks.map((task, i) => (
        <motion.div key={task.id}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.07 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center ${
              task.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20'
            }`}>
              {task.done && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
            </div>
            <span className={`text-[10px] font-medium flex-1 truncate ${task.done ? 'line-through text-slate-600' : 'text-slate-200'}`}>
              {t(`hero.demo.tasks.${task.id}`)}
            </span>
            <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
              style={{ color: PRIO_COL[task.priority], background: PRIO_COL[task.priority] + '18' }}>
              {t(`sample.priority.${task.priority}`)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Bar pct={task.pct} col={task.done ? '#10b981' : PRIO_COL[task.priority]} delay={i * 0.1} reduced={reduced} />
            <span className="text-[9px] font-bold shrink-0"
              style={{ color: task.done ? '#10b981' : PRIO_COL[task.priority] }}>
              {task.pct}%
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Scene 5 — Chat */
function SceneChat({ reduced }: { reduced: boolean }) {
  const t = useT('landing');
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Hash className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[11px] font-semibold text-white">{D.chat.channel}</span>
        <span className="text-[9px] text-slate-600 ms-1">{t('hero.demo.chat.teamName')}</span>
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
                <span className="text-[8px] text-slate-600">{t('hero.demo.chat.justNow')}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{t(`hero.demo.chat.messages.${msg.id}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>
      {/* Input bar */}
      <div className="px-3 py-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-1.5">
          <span className="text-[10px] text-slate-600 flex-1">{t('hero.demo.chat.placeholder', { channel: D.chat.channel })}</span>
          <Send className="h-3 w-3 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

/** Scene 6 — AI */
function SceneAI({ reduced }: { reduced: boolean }) {
  const t = useT('landing');
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
          <p className="text-[10px] text-slate-400">{t('hero.demo.ai.note')}</p>
        </div>
      </div>

      {/* Conversation */}
      <div className="space-y-2 flex-1">
        {/* User message */}
        <div className="flex items-start gap-2">
          <div className="h-5 w-5 rounded-md bg-indigo-600/30 flex items-center justify-center text-[7px] font-black text-indigo-300">SC</div>
          <div className="rounded-xl bg-indigo-600/15 border border-indigo-500/20 px-2.5 py-1.5">
            <p className="text-[10px] text-indigo-200">{t('hero.demo.ai.question')}</p>
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
                  {t('hero.demo.ai.thinking')}{dots}
                </motion.p>
              ) : (
                <motion.p key="resp" className="text-[10px] text-slate-300 leading-relaxed"
                  initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}>
                  {t('hero.demo.ai.answer')}
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
  const tl = useT('landing');
  const [sceneIdx, setSceneIdx] = useState(0);
  const scene = SCENES[sceneIdx];
  const sceneLabel = (key: SceneTabKey) => tl(`hero.demo.scenes.${key}`);

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

  /* Map scene key → active sidebar item */
  const sidebarItem: Record<SceneKey, string> = {
    overview: 'overview',
    crm:      'crm',
    team:     'team',
    tasks:    'tasks',
    chat:     'chat',
    ai:       'tavro',
    return:   'overview',
  };

  return (
    <div className="landing-preview rounded-2xl border border-white/[0.09] bg-[#0d1117] shadow-[0_28px_72px_rgba(0,0,0,0.65)] overflow-hidden">
      {/* Window chrome */}
      <Chrome label={sceneLabel(scene.key)} />

      <div className="flex" style={{ height: 340 }}>
        {/* Persistent sidebar — active item animates on scene change */}
        <AppSidebar activeId={sidebarItem[scene.key]} />

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
              <span className="text-[9px] font-semibold" style={{ color: scene.col }}>{sceneLabel(scene.key)}</span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">{tl('sample.illustrativePreview')}</span>
        </div>
      </div>

      <div role="group" aria-label={tl('hero.demo.chooseScene')} className="flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.05] bg-[#090c13] px-3 py-2">
        {SCENES.map((s, i) => {
          const Icon = s.icon;
          const selected = i === sceneIdx;
          return (
            <button
              key={s.key}
              type="button"
              title={tl('hero.demo.showPreview', { label: sceneLabel(s.key) })}
              aria-label={tl('hero.demo.showPreview', { label: sceneLabel(s.key) })}
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
              <span className="hidden sm:inline">{sceneLabel(s.key)}</span>
            </button>
          );
        })}
      </div>

      <div
        role="img"
        aria-label={tl('hero.demo.previewAlt')}
        className="relative border-t border-white/[0.05] bg-gradient-to-b from-[#0b0f19] to-[#090c13] px-2 py-3 sm:px-4"
      >
        <div className="absolute left-[12%] right-[12%] top-[28px] h-px bg-gradient-to-r from-blue-400/20 via-indigo-300/60 to-cyan-300/20" aria-hidden="true" />
        <div className="relative grid grid-cols-5 gap-1">
          {WORKSPACE_AREAS.map(({ id, icon: Icon, color }) => (
            <div key={id} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#111827] shadow-[0_4px_14px_rgba(0,0,0,.24)]">
                <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
              </span>
              <span className="truncate text-[9px] font-semibold text-slate-300">{tl(`hero.demo.areas.${id}`)}</span>
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
  // Staggered CSS entrance (0.1s steps), matching the previous motion timing.
  const enterDelay = (step: number) => ({ '--hero-enter-delay': `${step * 0.1}s` }) as React.CSSProperties;

  return (
    <section
      className="landing-hero relative flex items-center overflow-hidden"
      style={{ paddingTop: '4rem' }}
      aria-label="WorkGrind — connected workspaces for personal work, business, and education"
    >
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-center">

          {/* ══ LEFT: Copy ══ */}
          <div className="text-center lg:text-left">
            {/* Eyebrow */}
            <div className={`${styles.heroEnterFade} mb-5`} style={enterDelay(0)}>
              <span className={`${styles.heroEyebrow} inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide`}>
                For individuals, business teams, and education.
              </span>
            </div>

            {/* Headline — LCP candidate: rises in but is never transparent */}
            <h1
              className={`${styles.heroEnterRise} ${styles.heroTitle} font-black text-white mb-5`}
              style={enterDelay(1)}
            >
              One workspace for<br />
              work, business, and<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400">
                education.
              </span>
            </h1>

            {/* Supporting line — mobile LCP candidate */}
            <p
              className={`${styles.heroEnterRise} ${styles.heroDescription} text-slate-400 max-w-[65ch] mx-auto lg:mx-0 mb-7`}
              style={enterDelay(2)}
            >
              Bring personal planning and freelancer work together with business team tools and
              academic administration for schools, colleges, and universities. Tavro AI supports
              both work and learning, with access based on your workspace, role, and plan.
            </p>

            {/* CTAs */}
            <div
              className={`${styles.heroEnterFade} ${styles.heroActions} flex flex-col gap-3 justify-center lg:justify-start mb-8`}
              style={enterDelay(3)}
            >
              <Link
                href="/signup"
                className={`${styles.heroPrimaryCta} group inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3 rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.97]`}
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/features"
                className={`${styles.heroSecondaryCta} inline-flex items-center justify-center gap-2 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white font-semibold px-7 py-3 rounded-xl transition-all active:scale-[0.97]`}
              >
                Explore Features
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Workspace choices */}
            <div
              className={`${styles.heroEnterFade} grid grid-cols-2 gap-2 sm:grid-cols-3`}
              style={enterDelay(4)}
            >
              {([
                { id: 'solo', label: 'Solo', icon: CheckSquare },
                { id: 'business', label: 'Company', icon: Building2 },
                { id: 'school', label: 'School / Academy', icon: School },
                { id: 'college', label: 'College', icon: BookOpen },
                { id: 'university', label: 'University', icon: GraduationCap },
              ] as const).map(({ id, label, icon: Icon }) => (
                <Link
                  key={id}
                  href={`/signup?workspace=${id}`}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2 text-xs font-semibold text-slate-300 transition-colors hover:border-indigo-400/50 hover:bg-indigo-400/10 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* ══ RIGHT: Animated product demo ══ */}
          <div
            ref={parallaxRef}
            className={`${styles.heroEnterFade} ${styles.heroEnterDemo} relative`}
            style={enterDelay(3)}
          >
            <ProductDemo reduced={reduced} />
          </div>
        </div>
      </div>
    </section>
  );
}
