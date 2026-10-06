'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Users, Eye } from 'lucide-react';

const PILLARS = [
  { Icon: Users,  title: 'Role-Based Access',    desc: 'Owner, Admin, Manager and Employee roles with clear permission boundaries.'  },
  { Icon: Shield, title: 'Workspace Isolation',  desc: 'Each workspace is fully isolated — no cross-tenant data exposure.'           },
  { Icon: Lock,   title: 'Secure Authentication',desc: 'JWT with refresh rotation and bcrypt password hashing.'                      },
  { Icon: Eye,    title: 'Audit Logs',           desc: 'Every privileged action logged with actor, resource and timestamp.'          },
];

export function SecuritySection() {
  return (
    <section
      id="security"
      className="landing-section relative py-24 lg:py-32 overflow-hidden border-t"
      aria-labelledby="security-heading"
    >
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial from-emerald-600/9 to-transparent blur-[90px]" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.75 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-4 py-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">Security</span>
            </div>

            <h2 id="security-heading" className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Built for{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                serious work.
              </span>
            </h2>

            <p className="text-[15px] text-slate-400 leading-relaxed max-w-md">
              Workspace isolation, role-based access and audit logging — baked in from day one.
            </p>

            <div role="img" aria-label="Security flow with role-based access, an isolated workspace, and an audit trail" className="max-w-xl rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/[0.06] to-cyan-400/[0.025] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-emerald-100">
                <Shield className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Protected workspace data flow
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { title: 'Role access', detail: 'Permission checks', Icon: Users },
                  { title: 'Workspace', detail: 'Isolated data', Icon: Lock },
                  { title: 'Audit trail', detail: 'Actions recorded', Icon: Eye },
                ].map(({ title, detail, Icon }, index) => (
                  <div key={title} className="relative min-w-0 rounded-xl border border-white/[0.08] bg-slate-950/55 p-3 text-center">
                    <span className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
                      <Icon className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    </span>
                    <p className="text-xs font-semibold text-white">{title}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-400">{detail}</p>
                    {index < 2 && <span className="absolute -right-2.5 top-1/2 h-px w-3 bg-emerald-300/40" aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* 4 compact trust cards */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.75, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {PILLARS.map((p, i) => {
              const Icon = p.Icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.07 * i }}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 hover:border-emerald-500/25 hover:bg-emerald-500/[0.03] transition-all duration-200"
                >
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/18 flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h3 className="text-[13px] font-bold text-white mb-1">{p.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
