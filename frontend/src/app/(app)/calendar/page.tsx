'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CalendarEvent } from '@/types';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, Video, X,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { BackButton } from '@/components/common/BackButton';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events,      setEvents]      = useState<CalendarEvent[]>([]);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [title,       setTitle]       = useState('');
  const [type,        setType]        = useState('event');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    api.get('/calendar').then((r) => { if (r.data.success) setEvents(r.data.events); }).catch(() => {});
  }, [currentDate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    try {
      const r = await api.post('/calendar', { title, type, startDate: new Date(startDate), endDate: new Date(endDate), description });
      if (r.data.success) { setEvents((p) => [...p, r.data.event]); setModalOpen(false); setTitle(''); setDescription(''); }
    } catch { /* silent */ }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevM = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextM = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const today_d = new Date().getDate(), today_m = new Date().getMonth(), today_y = new Date().getFullYear();

  const typeChipClass: Record<string, string> = {
    meeting:  'event-chip-meeting',
    deadline: 'event-chip-deadline',
    reminder: 'event-chip-reminder',
    event:    'event-chip-event',
  };

  return (
    <div className="space-y-6 pb-8">
      <BackButton fallback="/dashboard" />

      {/* Header */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Meetings, deadlines, reminders, and company events</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center rounded-xl border p-1 gap-0.5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <button onClick={prevM} className="btn-ghost h-7 w-7 p-0 rounded-lg"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-3 text-xs font-bold theme-text-primary min-w-[130px] text-center">
              {formatDate(currentDate, 'MMMM yyyy')}
            </span>
            <button onClick={nextM} className="btn-ghost h-7 w-7 p-0 rounded-lg"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={today} className="btn-secondary h-9 px-3 text-xs">Today</button>
          <button onClick={() => setModalOpen(true)} className="btn-primary h-9 px-4">
            <Plus className="h-3.5 w-3.5" /><span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="surface rounded-2xl overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b text-center py-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-[10px] font-bold uppercase tracking-widest theme-text-muted">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 divide-x divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Blank days */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`b${i}`} className="min-h-[100px] sm:min-h-[120px]" style={{ background: 'var(--bg-base)', opacity: 0.5 }} />
          ))}

          {/* Actual days */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = events.filter((e) => e.startDate?.startsWith(dateStr));
            const isToday   = d === today_d && month === today_m && year === today_y;

            return (
              <div
                key={d}
                className="min-h-[100px] sm:min-h-[120px] p-2 transition-colors"
                style={{ background: isToday ? 'var(--bg-active)' : 'var(--bg-card)' }}
              >
                {/* Day number */}
                <div className="flex items-center justify-end mb-1.5">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isToday ? 'text-[var(--text-on-accent)] shadow-xs' : 'theme-text-secondary hover:bg-[var(--bg-hover)]'
                  }`} style={isToday ? { background: 'var(--accent)' } : {}}>
                    {d}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <div
                      key={evt._id}
                      title={evt.title}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate ${typeChipClass[evt.type] ?? typeChipClass.event}`}
                    >
                      {evt.type === 'meeting' && <Video className="h-2.5 w-2.5 shrink-0" />}
                      <span className="truncate">{evt.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[9px] theme-text-muted font-semibold px-1">+{dayEvents.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Event Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg max-h-[90vh] flex flex-col">
            <div className="modal-header shrink-0">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4.5 w-4.5 text-indigo-600" style={{ height: '1.125rem', width: '1.125rem' }} />
                <h3 className="modal-title">Add Calendar Event</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn-ghost h-7 w-7 p-0 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="modal-body overflow-y-auto flex-1">
              <div>
                <label className="form-label" htmlFor="cal-title">Event Title</label>
                <input id="cal-title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Strategy Review" className="input-base" autoFocus />
              </div>
              <div>
                <label className="form-label" htmlFor="cal-type">Event Type</label>
                <select id="cal-type" value={type} onChange={(e) => setType(e.target.value)} className="input-base">
                  <option value="event">Company Event</option>
                  <option value="meeting">Video Meeting</option>
                  <option value="deadline">Project Deadline</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="cal-start">Start</label>
                  <input id="cal-start" type="datetime-local" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="form-label" htmlFor="cal-end">End</label>
                  <input id="cal-end" type="datetime-local" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-base" />
                </div>
              </div>
              <div>
                <label className="form-label" htmlFor="cal-desc">Description</label>
                <textarea id="cal-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes, agenda, or links…" className="input-base resize-none" />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
