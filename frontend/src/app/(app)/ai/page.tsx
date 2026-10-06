'use client';

/**
 * Tavro AI
 *
 * Upgraded from simple Q&A chat to a full action-capable agent UI.
 * Uses existing WorkGrind design system — no external component libraries added.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';
import {
  Sparkles, Send, Bot, User as UserIcon,
  CheckCircle2, AlertCircle, Loader2, Plus,
  ChevronRight, Zap, Search, BarChart2,
  CheckSquare, Briefcase, Users, Building2,
  Clock, Trash2, History, X, RefreshCw,
} from 'lucide-react';
import { AIStatusBadge } from '@/components/common/AIStatusBadge';
import type { AIProvider } from '@/components/common/AIStatusBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolStep {
  toolName:   string;
  success:    boolean;
  durationMs: number;
  error?:     string;
}

interface ChatMessage {
  id:        string;
  role:      'user' | 'assistant' | 'system';
  content:   string;
  toolSteps?: ToolStep[];
  isLoading?: boolean;
  createdAt:  Date;
  /** Which AI provider handled this message (backend returns this) */
  provider?:  AIProvider;
}

interface ConversationSummary {
  _id:       string;
  title:     string;
  updatedAt: string;
}

interface AgentCompletion {
  success?: boolean;
  reply?: string;
  provider?: string;
  toolSteps?: ToolStep[];
  conversationId?: string | null;
}

interface AgentStreamEvent extends AgentCompletion {
  text?: string;
  message?: string;
}

// ── Tool name → friendly label map ───────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  searchTasks:          'Searching tasks…',
  createTask:           'Creating task…',
  updateTask:           'Updating task…',
  searchProjects:       'Searching projects…',
  createProject:        'Creating project…',
  searchMeetings:       'Checking meetings…',
  searchCalendarEvents: 'Checking calendar events…',
  createMeeting:        'Scheduling meeting…',
  searchContacts:       'Searching CRM contacts…',
  searchDeals:          'Searching CRM deals…',
  searchCrmCompanies:   'Searching CRM companies…',
  createDeal:           'Creating CRM deal…',
  searchTeamMembers:    'Looking up team members…',
  searchDocuments:      'Searching documents…',
  searchFiles:          'Searching files…',
  getWorkspaceSummary:  'Summarizing workspace…',
  getWorkspacePlan:     'Checking your workspace plan…',
  getCrmAccountSummary: 'Loading account summary…',
};

const TOOL_ICONS: Record<string, React.ElementType> = {
  searchTasks:     CheckSquare,
  createTask:      CheckSquare,
  updateTask:      CheckSquare,
  searchProjects:  Briefcase,
  createProject:   Briefcase,
  searchMeetings:  Clock,
  createMeeting:   Clock,
  searchContacts:  Users,
  searchDeals:     Building2,
  searchCrmCompanies: Building2,
  createDeal:      Building2,
  searchTeamMembers: Users,
  searchDocuments: BarChart2,
  getWorkspaceSummary: Sparkles,
  getCrmAccountSummary: Building2,
};

// ── Quick action prompts ──────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: CheckSquare, label: 'Overdue tasks',     prompt: 'Show me all my overdue tasks' },
  { icon: BarChart2,   label: 'Week summary',       prompt: 'Summarize my workspace activity this week' },
  { icon: Building2,   label: 'Analyze CRM',        prompt: 'Show me all overdue CRM deals' },
  { icon: Sparkles,    label: 'Today\'s priorities',prompt: 'What are my top priorities for today?' },
  { icon: Users,       label: 'Team overview',      prompt: 'Show me my team members and their status' },
  { icon: Search,      label: 'Find a client',      prompt: 'Search CRM for a specific client' },
];

// ── Simple markdown → JSX renderer ───────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { elements.push(<br key={key++} />); continue; }

    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-sm font-bold mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={key++} className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{line.slice(2, -2)}</p>);
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      const content = line.slice(2);
      // Inline bold
      const parts = content.split(/\*\*(.+?)\*\*/g);
      elements.push(
        <div key={key++} className="flex items-start gap-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
          <span>
            {parts.map((p, pi) =>
              pi % 2 === 1
                ? <strong key={pi} style={{ color: 'var(--text-primary)' }}>{p}</strong>
                : p
            )}
          </span>
        </div>
      );
    } else {
      // Inline bold within regular text
      const parts = line.split(/\*\*(.+?)\*\*/g);
      elements.push(
        <p key={key++} className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {parts.map((p, pi) =>
            pi % 2 === 1
              ? <strong key={pi} style={{ color: 'var(--text-primary)' }}>{p}</strong>
              : p
          )}
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ── Tool step display ─────────────────────────────────────────────────────────

function ToolStepBadge({ step }: { step: ToolStep }) {
  const Icon = TOOL_ICONS[step.toolName] ?? Sparkles;
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium border ${
      step.success
        ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
        : 'border-rose-200/60 bg-rose-50 text-rose-700'
    }`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{TOOL_LABELS[step.toolName] ?? step.toolName}</span>
      {step.success
        ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
        : <AlertCircle  className="h-3 w-3 text-rose-500    shrink-0" />}
      <span className="opacity-60">{step.durationMs}ms</span>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, user }: { msg: ChatMessage; user: any }) {
  if (msg.isLoading) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="rounded-2xl border px-4 py-3 flex items-center gap-2.5"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)' }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {msg.toolSteps && msg.toolSteps.length > 0
              ? (TOOL_LABELS[msg.toolSteps[msg.toolSteps.length - 1].toolName] ?? 'Working…')
              : 'Thinking…'}
          </span>
        </div>
      </div>
    );
  }

  if (msg.role === 'user') {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-[13px] leading-relaxed ai-bubble-user">
          {msg.content}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl font-bold text-[11px] shrink-0"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
          {user?.fullName?.[0] ?? 'U'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 shadow-xs"
        style={{
          background: 'var(--accent)',
          color: 'var(--text-on-accent)',
          boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
        }}>
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {/* Tool steps */}
        {msg.toolSteps && msg.toolSteps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.toolSteps.map((step, i) => <ToolStepBadge key={i} step={step} />)}
          </div>
        )}
        {/* Reply content */}
        <div className="rounded-2xl rounded-bl-sm px-4 py-3 ai-bubble-assistant">
          {renderMarkdown(msg.content)}
        </div>
        <div className="flex items-center gap-2 pl-1">
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {/* Tavro AI response status */}
          {msg.provider && <AIStatusBadge provider={msg.provider} size="xs" />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIAgentPage() {
  const { user, subscription, isAtLimit, refreshSubscription } = useAuthStore();
  const aiLimitReached = isAtLimit('aiRequests');
  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [input,           setInput]           = useState('');
  const [isLoading,       setIsLoading]       = useState(false);
  const [conversationId,  setConversationId]  = useState<string | null>(null);
  const [showHistory,     setShowHistory]     = useState(false);
  const [history,         setHistory]         = useState<ConversationSummary[]>([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Show welcome on mount
  useEffect(() => {
    setMessages([{
      id:        'welcome',
      role:      'assistant',
      content:   `Hello ${user?.fullName?.split(' ')[0] ?? 'there'}! 👋 I'm Tavro AI, built into WorkGrind.\n\nI can help you find information, create tasks and meetings, analyze your CRM, and much more — all from your workspace.\n\nWhat would you like to do?`,
      createdAt: new Date(),
    }]);
  }, [user?.fullName]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/ai/agent/history');
      if (res.data.success) setHistory(res.data.conversations);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  const openHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await api.get(`/ai/agent/conversations/${id}`);
      if (res.data.success) {
        const msgs: ChatMessage[] = res.data.conversation.messages.map((m: any) => ({
          id:        m._id ?? Math.random().toString(),
          role:      m.role,
          content:   m.content,
          createdAt: new Date(m.createdAt),
        }));
        setMessages(msgs);
        setConversationId(id);
        setShowHistory(false);
      }
    } catch { /* silent */ }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/ai/agent/conversations/${id}`);
    setHistory(h => h.filter(c => c._id !== id));
    if (conversationId === id) startNewConversation();
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([{
      id:        'welcome-new',
      role:      'assistant',
      content:   'New conversation started. What can I help you with?',
      createdAt: new Date(),
    }]);
    setShowHistory(false);
  };

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || isLoading || aiLimitReached) return;
    setInput('');

    const userMsg: ChatMessage = {
      id:        Date.now().toString(),
      role:      'user',
      content:   prompt,
      createdAt: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id:        'loading',
      role:      'assistant',
      content:   '',
      toolSteps: [],
      isLoading: true,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      let streamedReply = '';
      let responseOffset = 0;
      let eventBuffer = '';
      let completion: AgentCompletion | null = null;
      let streamError = '';
      const applyEvent = (frame: string) => {
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) return;
        let data: AgentStreamEvent;
        try {
          data = JSON.parse(dataLines.join('\n')) as AgentStreamEvent;
        } catch {
          return;
        }

        if (eventName === 'delta' && typeof data.text === 'string') {
          streamedReply += data.text;
          setMessages(prev => prev.map(message => message.id === 'loading'
            ? { ...message, content: streamedReply, isLoading: false }
            : message));
        } else if (eventName === 'reset') {
          streamedReply = '';
          setMessages(prev => prev.map(message => message.id === 'loading'
            ? { ...message, content: '', isLoading: true }
            : message));
        } else if (eventName === 'done') {
          completion = data;
        } else if (eventName === 'error') {
          streamError = data.message || 'Tavro AI could not complete the request.';
        }
      };
      const consumeEvents = (text: string) => {
        eventBuffer += text;
        const frames = eventBuffer.split(/\r?\n\r?\n/);
        eventBuffer = frames.pop() ?? '';
        frames.forEach(applyEvent);
      };
      const res = await api.post('/ai/agent', {
        message:        prompt,
        conversationId: conversationId ?? undefined,
        stream: true,
      }, {
        timeout: 60_000,
        onDownloadProgress: (progress) => {
          const xhr = progress.event.target as XMLHttpRequest | null;
          const body = xhr?.responseText;
          if (typeof body === 'string' && body.length > responseOffset) {
            consumeEvents(body.slice(responseOffset));
            responseOffset = body.length;
          }
        },
      });

      if (typeof res.data === 'string') {
        if (res.data.length > responseOffset) consumeEvents(res.data.slice(responseOffset));
        if (eventBuffer.trim()) applyEvent(eventBuffer);
        if (streamError) throw new Error(streamError);
        if (!completion) throw new Error('Tavro AI closed the response before completing the answer.');
      } else if (!res.data?.success) {
        throw new Error(res.data?.message || 'Tavro AI could not complete the request.');
      } else {
        streamedReply = res.data.reply;
        completion = res.data;
      }

      if (!completion) throw new Error('Tavro AI closed the response before completing the answer.');
      void refreshSubscription();
      setConversationId(completion.conversationId ?? null);
      const assistantMsg: ChatMessage = {
        id:        Date.now().toString() + '-a',
        role:      'assistant',
        content:   streamedReply,
        toolSteps: completion.toolSteps,
        // Provider values remain internal; the badge displays Tavro AI.
        provider:  (completion.provider ?? 'gemini') as AIProvider,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), assistantMsg]);
    } catch (err: unknown) {
      const failure = err && typeof err === 'object'
        ? err as { response?: { data?: unknown }; code?: string; message?: string }
        : {};
      const responseMessage = typeof failure.response?.data === 'string'
        ? (() => {
            try { return (JSON.parse(failure.response!.data as string) as { message?: string }).message; } catch { return undefined; }
          })()
        : failure.response?.data && typeof failure.response.data === 'object' &&
          'message' in failure.response.data && typeof failure.response.data.message === 'string'
          ? failure.response.data.message
          : undefined;
      const errMsg = responseMessage ?? (
        failure.code === 'ECONNABORTED' || failure.code === 'ETIMEDOUT'
          ? 'Tavro AI timed out while waiting for the service. Please try again.'
          : failure.message && failure.message !== 'Network Error'
            ? failure.message
            : 'Tavro AI could not reach the service. Check your connection and try again.'
      );
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), {
        id:        'err-' + Date.now(),
        role:      'assistant',
        content:   errMsg,
        createdAt: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasMessages = messages.filter(m => m.role !== 'system').length > 1;

  return (
    <div className="flex h-full min-h-0 gap-4">

      {/* ── History sidebar ── */}
      {showHistory && (
        <div className="w-64 shrink-0 flex flex-col rounded-2xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Conversations</span>
            <button onClick={() => setShowHistory(false)} className="btn-ghost h-6 w-6 p-0 rounded-lg">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={startNewConversation}
            className="flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold border-b transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent)' }}>
            <Plus className="h-3.5 w-3.5" />New conversation
          </button>

          <div className="flex-1 overflow-y-auto">
            {historyLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-[11px] py-6" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
            ) : (
              history.map(c => (
                <div key={c._id}
                  onClick={() => loadConversation(c._id)}
                  className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors hover:bg-[var(--bg-hover)] ${
                    c._id === conversationId ? 'bg-[var(--bg-active)]' : ''
                  }`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.title || 'Untitled'}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(c._id, e)}
                    className="opacity-0 group-hover:opacity-100 btn-ghost h-5 w-5 p-0 rounded text-rose-500 transition-opacity"
                    aria-label="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Main chat area ── */}
      <div className="flex flex-1 flex-col rounded-2xl border overflow-hidden min-h-0"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>

        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-5 shrink-0"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl shadow-xs"
              style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Tavro AI</h2>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Workspace-aware · Action-capable
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="badge badge-emerald text-[10px]">Active</span>
            {hasMessages && (
              <button onClick={startNewConversation} title="New conversation"
                className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="New conversation">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={openHistory} title="Conversation history"
              className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="History">
              <History className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} user={user} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions (only when no real conversation yet) */}
        {!hasMessages && (
          <div className="px-5 pb-4 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Quick actions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                <button key={label} onClick={() => send(prompt)}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium text-left transition-all hover:border-indigo-400/50 hover:shadow-xs"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4 shrink-0"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
          <div className="flex items-end gap-2.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to find tasks, create meetings, analyze deals…"
              rows={1}
              disabled={isLoading || aiLimitReached}
              className="flex-1 resize-none rounded-2xl border px-4 py-2.5 text-[13px] transition-all disabled:opacity-60"
              style={{
                background:   'var(--bg-card)',
                borderColor:  'var(--border-color)',
                color:        'var(--text-primary)',
                maxHeight:    '120px',
                minHeight:    '44px',
                overflowY:    'auto',
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || isLoading || aiLimitReached}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
              aria-label="Send">
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
            {aiLimitReached
              ? `Monthly AI limit reached${subscription?.planName ? ` on ${subscription.planName}` : ''}. `
              : 'Press Enter to send · Shift+Enter for new line'}
            {aiLimitReached && <Link href="/billing" className="ml-1 font-semibold underline">Upgrade</Link>}
          </p>
        </div>
      </div>
    </div>
  );
}
