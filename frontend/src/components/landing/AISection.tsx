'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, MessageSquare, CheckSquare } from 'lucide-react';
import Link from 'next/link';

const PROMPTS = [
  "Summarize today's meetings.",
  'Show overdue tasks.',
  'What should I focus on today?',
] as const;

const AI_RESPONSES = [
  '3 tasks need review before sprint ends Friday. The #engineering meeting produced 5 action items.',
  '2 high-priority tasks are overdue: "API docs" (3 days) and "Design review" (1 day).',
  'Top priority: complete the auth flow review (due today), then join the 3 PM sprint call.',
] as const;

export function AISection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showResponse, setShowResponse] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cycle = () => {
      setShowResponse(false);
      timeoutRef.current = setTimeout(() => {
        setActiveIdx((p) => (p + 1) % PROMPTS.length);
        setShowResponse(true);
      }, 900);
    };
    const id = setInterval(cycle, 3600);
    return () => {
      clearInterval(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <section
      id="ai"
      className="landing-section relative py-28 lg:py-36 overflow-hidden"
      aria-labelledby="ai-heading"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* Left: Tavro AI workspace flow */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8 }}
          >
            <div role="group" aria-label="Tavro AI turns a user request into workspace actions" className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#111625] to-[#0a0d14] p-4 shadow-2xl sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Workspace assistance</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[10px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Context connected
                </span>
              </div>
              <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:gap-3">
                <div className="min-w-0 rounded-xl border border-blue-400/15 bg-blue-400/[0.045] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-200">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" /> You
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p key={activeIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs leading-5 text-slate-300">
                      {PROMPTS[activeIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-slate-500 sm:rotate-0" aria-hidden="true" />
                <div className="min-w-0 rounded-xl border border-violet-400/20 bg-violet-400/[0.07] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-200">
                    <Sparkles className="h-4 w-4" aria-hidden="true" /> Tavro AI
                  </div>
                  <p className="text-xs leading-5 text-slate-400">Understands your tasks, CRM, calendar, and team activity.</p>
                </div>
                <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-slate-500 sm:rotate-0" aria-hidden="true" />
                <div className="min-w-0 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-200">
                    <CheckSquare className="h-4 w-4" aria-hidden="true" /> Actions &amp; results
                  </div>
                  <AnimatePresence mode="wait">
                    {showResponse ? (
                      <motion.p key={`${activeIdx}-result`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs leading-5 text-slate-300">
                        {AI_RESPONSES[activeIdx]}
                      </motion.p>
                    ) : (
                      <motion.p key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-slate-500">
                        Preparing workspace context…
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: copy — concise */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="space-y-7"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/8 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">AI Intelligence</span>
            </div>

            <h2 id="ai-heading" className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Work doesn't just happen.{' '}
              <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                It gets smarter.
              </span>
            </h2>

            <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
              Tavro AI is built into WorkGrind to understand your workspace and help your team focus on what matters most — every single day.
            </p>

            <Link
              href="/ai"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/30 transition-all duration-200 active:scale-[0.97]"
            >
              Try Tavro AI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
