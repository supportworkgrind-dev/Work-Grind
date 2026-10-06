'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ShieldCheck, Zap, MessageSquare, Gauge } from 'lucide-react';

interface StatItemProps {
  icon: React.ElementType;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  sublabel: string;
}

function Counter({ value, prefix = '', suffix = '', decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    const duration = 1800; // ms

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = easedProgress * value;

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(step);
  }, [isInView, value]);

  return (
    <span ref={ref} className="tabular-nums font-black">
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function StatsCounter() {
  const stats = [
    {
      icon: ShieldCheck,
      value: 99.9,
      decimals: 1,
      suffix: '%',
      label: 'Uptime Reliability',
      sublabel: 'Enterprise SLA guaranteed',
    },
    {
      icon: Zap,
      value: 10,
      suffix: 'x',
      label: 'Faster Onboarding',
      sublabel: 'Single-click company setups',
    },
    {
      icon: MessageSquare,
      value: 50,
      suffix: 'k+',
      label: 'Daily Messages & Events',
      sublabel: 'Zero packet drop via Socket.io',
    },
    {
      icon: Gauge,
      prefix: '<',
      value: 45,
      suffix: 'ms',
      label: 'Live Mesh Latency',
      sublabel: 'Direct peer-to-peer signaling',
    },
  ];

  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 z-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-3xl border border-slate-200/90 bg-white/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100"
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className={`flex flex-col items-center sm:items-start text-center sm:text-left ${
                idx !== 0 ? 'pt-6 sm:pt-0 sm:pl-8' : ''
              }`}
            >
              <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                <Counter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  decimals={stat.decimals}
                />
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-800">{stat.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{stat.sublabel}</p>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
