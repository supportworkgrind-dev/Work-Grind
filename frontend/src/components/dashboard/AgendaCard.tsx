'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonLine } from '@/components/common/LoadingSkeleton';

type AgendaItem = { _id: string; title: string; type?: string; startDate: string; allDay?: boolean; color?: string };

const AGENDA_DAYS = 7;

/**
 * The next week from the member's calendar (events and due tasks). Used where
 * team meetings are not part of the workspace, such as Solo workspaces.
 */
export function AgendaCard() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    const start = new Date();
    const end = new Date(start.getTime() + AGENDA_DAYS * 86_400_000);
    api.get('/calendar', { params: { start: start.toISOString(), end: end.toISOString() } })
      .then((response) => {
        if (!active) return;
        setItems((response.data.events ?? []).slice(0, 5));
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);

  return (
    <div className="surface surface-interactive rounded-2xl overflow-hidden" data-testid="agenda-card">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-bold theme-text-primary">Next {AGENDA_DAYS} days</h3>
        </div>
        <Link href="/calendar" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Open calendar →</Link>
      </div>
      {status === 'loading' ? (
        <div className="space-y-3 p-5"><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>
      ) : status === 'error' ? (
        <p className="px-5 py-4 text-[12px] theme-text-muted text-center" role="status">Your calendar could not be loaded.</p>
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Events and task due dates for the next week appear here." compact />
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {items.map((item) => (
            <div key={item._id} className="table-row-hover flex items-center gap-3 px-5 py-3">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color || 'var(--accent)' }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold theme-text-primary truncate">{item.title}</p>
                <p className="text-[11px] theme-text-muted">
                  {formatDate(item.startDate, item.allDay ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
