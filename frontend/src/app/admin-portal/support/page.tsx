'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import { SupportTicket } from '@/types';
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  RefreshCw,
  X,
  Mail,
  Building2,
  Calendar,
  MessageSquare,
} from 'lucide-react';

export default function SuperAdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [ticketStatus, setTicketStatus] = useState<
    'new' | 'replied' | 'closed' | 'open' | 'in_progress' | 'resolved'
  >('new');
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        q: search.trim(),
      });
      const res = await adminApi.get(`/tickets?${params.toString()}`);
      if (res.data.success) {
        setTickets(res.data.tickets);
      }
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleOpenDrawer = (t: SupportTicket) => {
    setSelectedTicket(t);
    setAdminNotes(t.adminNotes || '');
    setTicketStatus(t.status);
  };

  const handleSaveTicket = async () => {
    if (!selectedTicket) return;
    setIsSaving(true);
    try {
      const res = await adminApi.patch(`/tickets/${selectedTicket._id}`, {
        status: ticketStatus,
        adminNotes,
      });
      if (res.data.success) {
        setTickets((prev) =>
          prev.map((t) => (t._id === selectedTicket._id ? res.data.ticket : t))
        );
        showToast('Ticket updated successfully!');
        setSelectedTicket(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) return;
    try {
      const res = await adminApi.delete(`/tickets/${id}`);
      if (res.data.success) {
        setTickets((prev) => prev.filter((t) => t._id !== id));
        showToast('Ticket removed.');
        if (selectedTicket?._id === id) setSelectedTicket(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete ticket');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-2xl border border-emerald-500/30 bg-emerald-950/90 px-4 py-3 shadow-2xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Support Inquiries & Moderation</h1>
          <p className="mt-1 text-xs text-slate-400">
            Total {tickets.length} inquiries &bull; Review contact form leads, customer reports, and user feedback
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <Link
            href="/admin-portal/inbox"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/30"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Open Contact Inbox & Direct Reply →</span>
          </Link>
          <button
            onClick={fetchTickets}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by sender name, email, or subject..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-300 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Ticket Statuses</option>
          <option value="open">Open (Needs Attention)</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Ticket List */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md divide-y divide-slate-800/60">
        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-xs">Loading support tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">No support inquiries found.</div>
        ) : (
          tickets.map((t) => (
            <div
              key={t._id}
              className="p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              onClick={() => handleOpenDrawer(t)}
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      t.status === 'open'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : t.status === 'in_progress'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-bold text-white truncate">{t.subject}</span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{t.message}</p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span>From: <strong className="text-slate-300">{t.name}</strong> ({t.email})</span>
                  {t.company && <span>Company: <strong className="text-slate-300">{t.company}</strong></span>}
                  <span>Date: {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleOpenDrawer(t)}
                  className="rounded-xl border border-slate-800 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Manage
                </button>
                <button
                  onClick={() => handleDeleteTicket(t._id)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                  title="Delete Ticket"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ticket Drawer */}
      {selectedTicket && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-slate-900 border-l border-slate-800 shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Support Inquiry</span>
            <button onClick={() => setSelectedTicket(null)} className="rounded p-1 text-slate-400 hover:bg-slate-800">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 space-y-5 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Subject</span>
              <h3 className="text-sm font-bold text-white mt-0.5">{selectedTicket.subject}</h3>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Sender:</span>
                <span className="font-semibold text-white">{selectedTicket.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <a href={`mailto:${selectedTicket.email}`} className="font-semibold text-indigo-400 hover:underline">
                  {selectedTicket.email}
                </a>
              </div>
              {selectedTicket.company && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Company:</span>
                  <span className="font-semibold text-slate-200">{selectedTicket.company}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Message Content</span>
              <div className="mt-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.message}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Status</span>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-xs text-white"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Internal Admin Notes</span>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Log internal follow-up, client response notes, or ticket resolution details..."
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-white placeholder:text-slate-600 outline-none"
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                onClick={handleSaveTicket}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSaving ? 'Updating...' : 'Save Ticket Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
