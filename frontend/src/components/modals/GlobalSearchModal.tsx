'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api, aiRouter } from '@/lib/api';
import {
  Search,
  X,
  User,
  CheckSquare,
  Briefcase,
  Hash,
  MessageSquare,
  FileText,
  FolderClosed,
  Loader2,
  ArrowRight,
  Code2,
} from 'lucide-react';

export function GlobalSearchModal() {
  const router = useRouter();
  const { isSearchOpen, setSearchOpen } = useAppStore();
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    users: any[];
    tasks: any[];
    projects: any[];
    channels: any[];
    messages: any[];
    files: any[];
    documents: any[];
    meetings?: any[];
    contacts?: any[];
    deals?: any[];
    crmCompanies?: any[];
  }>({
    users: [],
    tasks: [],
    projects: [],
    channels: [],
    messages: [],
    files: [],
    documents: [],
  });
  const [localAIStatus, setLocalAIStatus] = useState<'idle'|'detecting'|'ready'|'local'|'degraded'>('idle');
  const [intentHint, setIntentHint] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (typeof window !== 'undefined' && localAIStatus === 'idle') {
        setLocalAIStatus('detecting');
        (async () => {
          try {
            // Directly check local AI capabilities via lazy import.
            // Import only capabilityService (no modelManager / @xenova/transformers)
            // so Webpack never traces into the native .node binary path.
            const { getLocalAICapabilities } = await import('@/services/localAI/capabilityService');
            const caps = await getLocalAICapabilities();
            setLocalAIStatus(caps.localAI ? 'ready' : 'degraded');
          } catch {
            setLocalAIStatus('degraded');
          }
        })();
      }
    } else {
      setQuery('');
      setResults({ users: [], tasks: [], projects: [], channels: [], messages: [], files: [], documents: [] });
      setIntentHint(null);
    }
  }, [isSearchOpen, localAIStatus]);

  /**
   * Run a feature locally via aiRouter.tryLocal().
   * aiRouter.decide() only returns a routing decision — no result.
   * aiRouter.tryLocal() actually executes the local model and returns { success, result, wasLocal }.
   */
  const tryLocal = async (feature: string, payload: any) => {
    try {
      // Use aiRouter.tryLocal which calls processLocalIfPossible internally
      const r = await (aiRouter as any)?.tryLocal?.(
        feature as import('@/services/aiRequestRouter').AIFeature,
        payload,
      );
      if (r && r.success) {
        return { success: true, result: r.result, wasLocal: r.wasLocal ?? true };
      }
      return { success: false, result: null, wasLocal: false };
    } catch {
      return { success: false, result: null, wasLocal: false };
    }
  };

  const buildRankItems = (res: any) => {
    const items: { id: string; text: string; category: string; idx: number }[] = [];
    (res.tasks || []).forEach((t: any, idx: number) => t?.title && items.push({ id: `task_${t._id || idx}`, text: t.title, category: 'tasks', idx }));
    (res.projects || []).forEach((p: any, idx: number) => p?.name && items.push({ id: `proj_${p._id || idx}`, text: p.name, category: 'projects', idx }));
    (res.users || []).forEach((u: any, idx: number) => u?.fullName && items.push({ id: `user_${u._id || idx}`, text: u.fullName, category: 'users', idx }));
    (res.channels || []).forEach((c: any, idx: number) => c?.name && items.push({ id: `chan_${c._id || idx}`, text: c.name, category: 'channels', idx }));
    (res.documents || []).forEach((d: any, idx: number) => d?.title && items.push({ id: `doc_${d._id || idx}`, text: d.title, category: 'documents', idx }));
    (res.meetings || []).forEach((m: any, idx: number) => m?.title && items.push({ id: `meet_${m._id || idx}`, text: m.title, category: 'meetings', idx }));
    (res.files || []).forEach((f: any, idx: number) => f?.name && items.push({ id: `file_${f._id || idx}`, text: f.name, category: 'files', idx }));
    (res.contacts || []).forEach((c: any, idx: number) => ((c?.firstName || c?.lastName) && items.push({ id: `cnt_${c._id || idx}`, text: `${c.firstName || ''} ${c.lastName || ''}`.trim(), category: 'contacts', idx })));
    (res.deals || []).forEach((d: any, idx: number) => d?.title && items.push({ id: `deal_${d._id || idx}`, text: d.title, category: 'deals', idx }));
    (res.crmCompanies || []).forEach((c: any, idx: number) => c?.name && items.push({ id: `crmc_${c._id || idx}`, text: c.name, category: 'crmCompanies', idx }));
    return items;
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], tasks: [], projects: [], channels: [], messages: [], files: [], documents: [] });
      setIntentHint(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
        if (res.data.success) {
          const backendResults = res.data.results;
          const normalizedResults = {
            ...backendResults,
            users: backendResults.users ?? backendResults.people ?? [],
          };
          setResults(normalizedResults);

          (async () => {
            if (localAIStatus !== 'ready' && localAIStatus !== 'local') return;
            try {
              try {
                const intent = await tryLocal('search_intent', { query });
                if (intent.success && intent.result?.intent) {
                  setIntentHint(intent.result.intent);
                }
              } catch {}

              if (query.length >= 3 && localAIStatus === 'ready') {
                const hasAny = (Object.values(backendResults || {}) as any[][]).some((arr) => arr?.length > 0);
                if (hasAny) {
                  try {
                    const items = buildRankItems(normalizedResults);
                    if (items.length > 0) {
                      const rankResult = await tryLocal('similarity_ranking', { query, items });
                      if (rankResult.success && rankResult.wasLocal && rankResult.result?.ranked) {
                        // ranked = [{id, score, rank}, ...] sorted by score desc
                        const scoreMap: Record<string, number> = {};
                        for (const entry of rankResult.result.ranked as Array<{ id: string; score: number }>) {
                          scoreMap[entry.id] = entry.score;
                        }
                        setLocalAIStatus('local');
                        setResults((prev) => {
                          const next: any = { ...prev };
                          const categoryOrder: [string, (x: any) => string | undefined][] = [
                            ['tasks', (t) => `task_${t._id}`],
                            ['projects', (p) => `proj_${p._id}`],
                            ['users', (u) => `user_${u._id}`],
                            ['channels', (c) => `chan_${c._id}`],
                            ['documents', (d) => `doc_${d._id}`],
                            ['meetings', (m) => `meet_${m._id}`],
                            ['files', (f) => `file_${f._id}`],
                            ['contacts', (c) => `cnt_${c._id}`],
                            ['deals', (d) => `deal_${d._id}`],
                            ['crmCompanies', (c) => `crmc_${c._id}`],
                          ];
                          for (const [cat, getId] of categoryOrder) {
                            const arr = next[cat];
                            if (arr?.length) {
                              next[cat] = [...arr].sort((a, b) => {
                                const sa = scoreMap[getId(a) ?? ''] ?? 0;
                                const sb = scoreMap[getId(b) ?? ''] ?? 0;
                                return sb - sa;
                              });
                            }
                          }
                          return next;
                        });
                      }
                    }
                  } catch {}
                }
              }
            } catch {}
          })();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, localAIStatus]);

  if (!isSearchOpen) return null;

  const handleSelect = (url: string) => {
    setSearchOpen(false);
    router.push(url);
  };

  const developerQuery = query.trim().length >= 2 && 'developer'.includes(query.trim().toLowerCase());
  const hasResults =
    results.users.length > 0 ||
    results.tasks.length > 0 ||
    results.projects.length > 0 ||
    results.channels.length > 0 ||
    results.messages.length > 0 ||
    results.files.length > 0 ||
    results.documents.length > 0 ||
    (results.meetings?.length ?? 0) > 0 ||
    (results.contacts?.length ?? 0) > 0 ||
    (results.deals?.length ?? 0) > 0 ||
    (results.crmCompanies?.length ?? 0) > 0 ||
    (['owner', 'admin'].includes(user?.role ?? '') && developerQuery);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Search Input */}
        <div className="flex items-center border-b border-slate-200 px-4">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, people, messages, files..."
            className="h-14 w-full border-0 bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-0"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
          <button
            onClick={() => setSearchOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query.trim() && (
            <div className="py-12 text-center text-xs text-slate-400">
              Type anything to search across the entire WorkGrind workspace
            </div>
          )}

          {query.trim() && !loading && !hasResults && (
            <div className="py-12 text-center text-xs text-slate-500">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {/* People */}
          {results.users.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">People</span>
              <div className="mt-1 space-y-1">
                {results.users.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleSelect('/team')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-semibold text-indigo-700">
                        {u.fullName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{u.fullName}</p>
                        <p className="text-slate-500 truncate">{u.jobTitle || u.email}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {results.tasks.length > 0 && (
            <div>
              {intentHint === 'task_lookup' && (
                <div className="mb-1 px-2">
                  <span className="text-[10px] text-indigo-500">Filtering tasks</span>
                </div>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Tasks</span>
              <div className="mt-1 space-y-1">
                {results.tasks.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => handleSelect('/tasks')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{t.title}</p>
                        <p className="text-slate-500 capitalize truncate">{t.status} • {t.priority} priority</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {results.projects.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Projects</span>
              <div className="mt-1 space-y-1">
                {results.projects.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => handleSelect('/projects')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Briefcase className="h-4 w-4 text-purple-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-slate-500 truncate">{p.progress}% progress • {p.status}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Channels */}
          {results.channels.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Channels</span>
              <div className="mt-1 space-y-1">
                {results.channels.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => handleSelect('/chat')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Hash className="h-4 w-4 text-emerald-600" />
                      <p className="font-semibold text-slate-900">#{c.name}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {results.documents.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Docs</span>
              <div className="mt-1 space-y-1">
                {results.documents.map((d) => (
                  <button
                    key={d._id}
                    onClick={() => handleSelect('/docs')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="font-semibold text-slate-900 truncate">{d.title}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CRM Companies */}
          {results.crmCompanies && (results.crmCompanies?.length ?? 0) > 0 && (
            <div>
              {intentHint === 'crm_lookup' && (
                <div className="mb-1 px-2">
                  <span className="text-[10px] text-indigo-500">Filtering CRM contacts & deals</span>
                </div>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Companies</span>
              <div className="mt-1 space-y-1">
                {results.crmCompanies.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => handleSelect('/crm')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Briefcase className="h-4 w-4 text-sky-600 shrink-0" />
                      <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deals */}
          {results.deals && (results.deals?.length ?? 0) > 0 && (
            <div>
              {intentHint === 'crm_lookup' && !results.crmCompanies?.length && (
                <div className="mb-1 px-2">
                  <span className="text-[10px] text-indigo-500">Filtering CRM contacts & deals</span>
                </div>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Deals</span>
              <div className="mt-1 space-y-1">
                {results.deals.map((d) => (
                  <button
                    key={d._id}
                    onClick={() => handleSelect('/crm')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <CheckSquare className="h-4 w-4 text-green-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{d.title}</p>
                        {d.value && <p className="text-slate-500 truncate">${d.value.toLocaleString()}</p>}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contacts */}
          {results.contacts && (results.contacts?.length ?? 0) > 0 && (
            <div>
              {intentHint === 'crm_lookup' && !results.crmCompanies?.length && !results.deals?.length && (
                <div className="mb-1 px-2">
                  <span className="text-[10px] text-indigo-500">Filtering CRM contacts & deals</span>
                </div>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Contacts</span>
              <div className="mt-1 space-y-1">
                {results.contacts.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => handleSelect('/crm')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 font-semibold text-sky-700">
                        {(c.firstName?.[0] || c.lastName?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{`${c.firstName || ''} ${c.lastName || ''}`.trim()}</p>
                        {c.email && <p className="text-slate-500 truncate">{c.email}</p>}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meetings */}
          {results.meetings && (results.meetings?.length ?? 0) > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Meetings</span>
              <div className="mt-1 space-y-1">
                {results.meetings.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => handleSelect('/meetings')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className="h-4 w-4 text-rose-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{m.title}</p>
                        {m.date && <p className="text-slate-500 truncate">{new Date(m.date).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {['owner', 'admin'].includes(user?.role ?? '') && developerQuery && (
              <div>
                <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace tools</span>
                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSelect('/developer')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Code2 className="h-4 w-4 shrink-0 text-indigo-600" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">Developer</span>
                        <span className="block truncate text-slate-500">Manage API keys and webhooks</span>
                      </span>
                    </span>
                    <ArrowRight className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* Footer tip */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with mouse or keyboard</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
