'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  CheckSquare,
  Bot,
  Video,
  Sparkles,
  Maximize2,
  Minimize2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export function ProductPreview3D() {
  const [isHovered, setIsHovered] = useState(false);
  const [forcedFlat, setForcedFlat] = useState(false);

  const isFlat = isHovered || forcedFlat;

  return (
    <div className="relative mx-auto max-w-5xl mt-12 sm:mt-16 w-full perspective-1400 select-none">
      {/* Ambient Radial Floor Glow */}
      <div
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[90%] h-32 bg-gradient-to-t from-blue-600/20 via-indigo-500/10 to-transparent blur-3xl pointer-events-none rounded-full"
        aria-hidden="true"
      />

      {/* Mode Switcher Pill */}
      <div className="flex justify-end mb-3 sm:mb-4 pr-2">
        <button
          type="button"
          onClick={() => setForcedFlat(!forcedFlat)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/80 backdrop-blur-md border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 shadow-xs transition-all active:scale-95"
        >
          {forcedFlat ? (
            <>
              <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Reset 3D Perspective</span>
            </>
          ) : (
            <>
              <Minimize2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Flatten View</span>
            </>
          )}
        </button>
      </div>

      {/* 3D Tilted Showcase Frame */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          transform: isFlat
            ? 'rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)'
            : 'rotateX(11deg) rotateY(-2.5deg) rotateZ(0.8deg) scale(0.98)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`relative rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xl p-3 sm:p-5 shadow-2xl transition-all ${
          isFlat
            ? 'shadow-slate-300/60'
            : 'shadow-[0_30px_70px_-15px_rgba(37,99,235,0.25),0_15px_30px_-10px_rgba(15,23,42,0.1)]'
        }`}
      >
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-6 overflow-hidden text-left preserve-3d">
          {/* Fake Browser Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-6 preserve-3d">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-400" />
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs font-mono font-medium text-slate-400 hidden sm:inline">
                workgrind workspace
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                style={{ transform: isFlat ? 'none' : 'translateZ(30px)' }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-700 shadow-xs transition-transform"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Live Sync &amp; WebRTC Active</span>
              </span>
            </div>
          </div>

          {/* 3D Layered Grid Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 preserve-3d">
            {/* Panel 1: Team Chat with 3D Depth */}
            <div
              style={{
                transform: isFlat ? 'none' : 'translateZ(24px)',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-md shadow-slate-200/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">#engineering</h4>
                      <span className="text-[10px] text-slate-400">Company Channel</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Online
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">Sarah Jenkins</span>
                      <span className="text-[9px] text-slate-400">10:42 AM</span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                      Instant WebRTC meeting is live! Ready for team sprint review. 🚀
                    </p>
                  </div>
                  <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100/80 text-blue-950">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 text-[11px]">Alex Rivera</span>
                      <span className="text-[9px] text-blue-500">Just now</span>
                    </div>
                    <p className="text-blue-800 text-[11px] mt-1 leading-relaxed">
                      Joined with HD audio &amp; video. All real-time signals synced!
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium">18 team members active</span>
                <span className="text-blue-600 font-semibold cursor-pointer hover:underline">View Chat →</span>
              </div>
            </div>

            {/* Panel 2: Sprint Delivery & Kanban (Elevated 3D Layer) */}
            <div
              style={{
                transform: isFlat ? 'none' : 'translateZ(40px)',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5 shadow-lg shadow-indigo-100/60 flex flex-col justify-between ring-1 ring-indigo-50"
            >
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <CheckSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">Sprint Roadmap</h4>
                      <span className="text-[10px] text-slate-400">Q3 Milestone</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    84% Complete
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-[11px]">WebRTC Live Mesh</span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        Delivered
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Assigned: Alex R.</span>
                      <span className="text-emerald-600 font-medium">✓ Passed E2E</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-[11px]">MFA Authenticator</span>
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                        Active
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Assigned: Security</span>
                      <span>100% Protected</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full w-[84%]" />
                </div>
              </div>
            </div>

            {/* Panel 3: Video & AI Copilot Insights */}
            <div
              style={{
                transform: isFlat ? 'none' : 'translateZ(26px)',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-md shadow-slate-200/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">AI Copilot</h4>
                      <span className="text-[10px] text-slate-400">Real-time Insights</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                    GPT-4o
                  </span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-xs space-y-2">
                  <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-sky-500" />
                    <span>Auto-Generated Summary</span>
                  </p>
                  <ul className="text-[10px] text-slate-600 space-y-1.5 list-none pl-0">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Unified video rooms and real-time chat</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Automated 6-digit MFA portal protection</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Single-click Book a Demo routing</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Video className="h-3 w-3 text-slate-400" />
                  <span>3 Active Rooms</span>
                </span>
                <span className="text-sky-600 font-semibold cursor-pointer hover:underline">Ask Copilot →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
