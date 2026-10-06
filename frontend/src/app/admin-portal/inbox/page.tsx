'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { SupportTicket } from '@/types';
import {
  Inbox,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Send,
  Loader2,
  Video,
  Check,
  Reply,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function AdminPortalInboxPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState({ total: 0, unread: 0, demo: 0, contact: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'contact' | 'demo'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'replied' | 'closed'>('replied');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTickets = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search.trim()) params.append('q', search.trim());

      const res = await adminApi.get(`/tickets?${params.toString()}`);
      if (res.data.success) {
        setTickets(res.data.tickets || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const selectedTicket = tickets.find((t) => t._id === selectedTicketId) || null;

  // When clicking a ticket, mark it as read on the backend
  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicketId(ticket._id);
    setReplyText('');

    if (ticket.isRead === false) {
      setTickets((prev) =>
        prev.map((t) => (t._id === ticket._id ? { ...t, isRead: true } : t))
      );
      setCounts((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));

      try {
        await adminApi.patch(`/tickets/${ticket._id}/read`, { isRead: true });
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }
  };

  // Toggle read/unread manually
  const handleToggleRead = async (ticket: SupportTicket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newRead = !ticket.isRead;
    setTickets((prev) =>
      prev.map((t) => (t._id === ticket._id ? { ...t, isRead: newRead } : t))
    );
    setCounts((prev) => ({
      ...prev,
      unread: newRead ? Math.max(0, prev.unread - 1) : prev.unread + 1,
    }));

    try {
      await adminApi.patch(`/tickets/${ticket._id}/read`, { isRead: newRead });
      showToast(newRead ? 'Marked as read' : 'Marked as unread');
    } catch (err) {
      console.error('Failed to toggle read state:', err);
    }
  };

  // Update status directly
  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const res = await adminApi.patch(`/tickets/${ticketId}`, { status: newStatus });
      if (res.data.success) {
        setTickets((prev) =>
          prev.map((t) => (t._id === ticketId ? { ...t, status: newStatus as any } : t))
        );
        showToast(`Status updated to "${newStatus}"`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // Delete ticket
  const handleDeleteTicket = async (ticketId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this message?')) return;

    try {
      const res = await adminApi.delete(`/tickets/${ticketId}`);
      if (res.data.success) {
        setTickets((prev) => prev.filter((t) => t._id !== ticketId));
        if (selectedTicketId === ticketId) setSelectedTicketId(null);
        showToast('Message deleted successfully');
        fetchTickets(true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete message', 'error');
    }
  };

  // Send Direct Reply via Gmail SMTP
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const res = await adminApi.post(`/tickets/${selectedTicket._id}/reply`, {
        replyText: replyText.trim(),
        updateStatus: replyStatus,
      });

      if (res.data.success) {
        const updatedTicket = res.data.ticket;
        setTickets((prev) =>
          prev.map((t) => (t._id === selectedTicket._id ? updatedTicket : t))
        );
        setReplyText('');
        showToast(
          res.data.message || `Reply dispatched to ${selectedTicket.email}!`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(
        err.response?.data?.message || 'Failed to send reply. Please check SMTP settings.',
        'error'
      );
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/90 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Contact & Demo Inbox</h1>
            {counts.unread > 0 && (
              <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold animate-pulse">
                {counts.unread} unread
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Unified inbox for Contact Us inquiries and Book a Demo requests &bull; Reply directly to prospects and users via Gmail SMTP
          </p>
        </div>

        <button
          onClick={() => fetchTickets()}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 self-start cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Split Inbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[640px]">
        {/* ── LEFT PANE: MESSAGE LIST (5 cols) ── */}
        <div className="lg:col-span-5 flex flex-col rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md">
          {/* Top Search & Filter Bar */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, company, subject..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Type Tabs */}
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800/80">
              <button
                onClick={() => setTypeFilter('all')}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>All</span>
                <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                  {counts.total}
                </span>
              </button>
              <button
                onClick={() => setTypeFilter('contact')}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  typeFilter === 'contact'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Contact Us</span>
                <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                  {counts.contact}
                </span>
              </button>
              <button
                onClick={() => setTypeFilter('demo')}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  typeFilter === 'demo'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="h-3 w-3" />
                <span>Demo</span>
                <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                  {counts.demo}
                </span>
              </button>
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-0.5">
              <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider pl-1 mr-1">
                Status:
              </span>
              {[
                { id: 'all', label: 'All' },
                { id: 'new', label: 'New' },
                { id: 'replied', label: 'Replied' },
                { id: 'closed', label: 'Closed' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                    statusFilter === s.id
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 max-h-[580px]">
            {isLoading ? (
              <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                <span>Loading messages...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-xs px-6">
                <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                <p className="font-semibold text-slate-400">No messages found</p>
                <p className="mt-1 text-[11px]">No inquiry or demo request matches this filter.</p>
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = t._id === selectedTicketId;
                const isUnread = t.isRead === false;
                const isDemo = t.type === 'demo';

                return (
                  <div
                    key={t._id}
                    onClick={() => handleSelectTicket(t)}
                    className={`p-4 transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-indigo-950/40 border-l-4 border-l-indigo-500'
                        : isUnread
                        ? 'bg-slate-800/40 hover:bg-slate-800/70 border-l-4 border-l-blue-500'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Unread indicator dot */}
                        {isUnread && (
                          <span
                            className="h-2 w-2 rounded-full bg-blue-400 shrink-0 animate-pulse"
                            title="Unread message"
                          />
                        )}

                        {/* Type Badge */}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isDemo
                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {isDemo ? 'Demo Request' : 'Contact'}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            t.status === 'new' || t.status === 'open'
                              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                              : t.status === 'replied'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-700/40 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(t.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Sender & Subject */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'
                          }`}
                        >
                          {t.name}
                        </span>
                        {t.company && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                            {t.company}
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-xs truncate ${
                          isUnread ? 'font-semibold text-slate-200' : 'text-slate-400'
                        }`}
                      >
                        {t.subject}
                      </p>

                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-normal">
                        {t.message}
                      </p>
                    </div>

                    {/* Replies count indicator */}
                    {t.replies && t.replies.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <Reply className="h-3 w-3" />
                        <span>{t.replies.length} {t.replies.length === 1 ? 'reply sent' : 'replies sent'}</span>
                      </div>
                    )}

                    {/* Hover actions */}
                    <div
                      className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 rounded-lg p-1 border border-slate-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleToggleRead(t, e)}
                        title={t.isRead ? 'Mark as unread' : 'Mark as read'}
                        className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      >
                        {t.isRead ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={(e) => handleDeleteTicket(t._id, e)}
                        title="Delete message"
                        className="rounded p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANE: DETAIL & DIRECT REPLY (7 cols) ── */}
        <div className="lg:col-span-7 flex flex-col rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md">
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
              {/* Header Details */}
              <div className="p-6 border-b border-slate-800/80 bg-slate-950/40 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          selectedTicket.type === 'demo'
                            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {selectedTicket.type === 'demo' ? 'Live Demo Walkthrough' : 'Contact Us Inquiry'}
                      </span>
                      <span className="text-xs text-slate-500">
                        ID: {selectedTicket._id.slice(-6)}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {selectedTicket.subject}
                    </h2>
                  </div>

                  {/* Actions: Status Dropdown & Delete */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleStatusChange(selectedTicket._id, e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-900 py-1.5 px-3 text-xs font-semibold text-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="new">Status: New</option>
                      <option value="replied">Status: Replied</option>
                      <option value="closed">Status: Closed</option>
                      <option value="in_progress">Status: In Progress</option>
                    </select>

                    <button
                      onClick={() => handleToggleRead(selectedTicket)}
                      title={selectedTicket.isRead ? 'Mark unread' : 'Mark read'}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      {selectedTicket.isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={() => handleDeleteTicket(selectedTicket._id)}
                      title="Delete ticket"
                      className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sender Info Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
                      {selectedTicket.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{selectedTicket.name}</span>
                        {selectedTicket.company && (
                          <span className="text-[11px] text-slate-400">
                            &bull; {selectedTicket.company}
                          </span>
                        )}
                      </div>
                      <a
                        href={`mailto:${selectedTicket.email}`}
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        <span>{selectedTicket.email}</span>
                      </a>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Received:{' '}
                    <span className="text-slate-400 font-medium">
                      {new Date(selectedTicket.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Content & History */}
              <div className="p-6 space-y-6 flex-1">
                {/* Original Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Original Message
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.message}
                  </div>
                </div>

                {/* Previous Replies Thread */}
                {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Reply className="h-3 w-3" />
                      <span>Reply History ({selectedTicket.replies.length})</span>
                    </span>

                    <div className="space-y-3">
                      {selectedTicket.replies.map((r, idx) => (
                        <div
                          key={r._id || idx}
                          className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">{r.sentBy}</span>
                              <span className="text-slate-500">&bull; Support Reply</span>
                            </div>
                            <span className="text-slate-500">
                              {new Date(r.sentAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {r.replyText}
                          </p>
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1 pt-1">
                            <Check className="h-3 w-3" />
                            <span>Delivered to {selectedTicket.email} via support.workgrind5@gmail.com</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Reply Composer Box */}
                <div className="pt-2">
                  <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <Reply className="h-4 w-4 text-indigo-400" />
                        <span>Direct Reply via Email</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        To: <strong className="text-slate-200">{selectedTicket.email}</strong>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal">
                      Your message will be formatted with official WorkGrind branding and dispatched from{' '}
                      <code className="text-indigo-300">support.workgrind5@gmail.com</code> with the user&apos;s original inquiry quoted.
                    </p>

                    <form onSubmit={handleSendReply} className="space-y-3">
                      <textarea
                        rows={4}
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Hi ${selectedTicket.name}, thank you for reaching out! We'd love to...`}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 outline-none resize-none leading-relaxed"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-[11px]">After sending:</span>
                          <select
                            value={replyStatus}
                            onChange={(e) => setReplyStatus(e.target.value as any)}
                            className="rounded-lg border border-slate-800 bg-slate-900 py-1 px-2 text-xs text-slate-300 outline-none cursor-pointer"
                          >
                            <option value="replied">Mark as Replied</option>
                            <option value="closed">Mark as Closed</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={isSendingReply || !replyText.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 cursor-pointer"
                        >
                          {isSendingReply ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Sending via Gmail SMTP...</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              <span>Send Reply to User</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty placeholder when no message selected */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-center text-slate-400">
                <Mail className="h-8 w-8" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-sm font-bold text-slate-300">Select a message</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Choose an inquiry or demo request from the inbox to review full details and send an instant direct reply to the customer.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
