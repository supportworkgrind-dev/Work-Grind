'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/adminApi';
import {
  Sparkles,
  BarChart2,
  Users,
  RefreshCw,
  TrendingUp,
  Bot,
  Zap,
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
} from 'lucide-react';

function sanitizeAIMessage(message: unknown): string {
  return String(message ?? '')
    .replace(/\bGemini\b/gi, 'Tavro AI')
    .replace(/\bLocal AI\b/gi, 'Tavro AI')
    .replace(/\bWebGPU\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function SuperAdminAiAnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ platform?: any; company?: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [limitDays, setLimitDays] = useState<number>(30);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId) params.append('companyId', selectedCompanyId);
      params.append('limitDays', String(limitDays));

      const res = await adminApi.get(`/ai/analytics?${params.toString()}`);
      if (res.data.success) {
        setStats({
          platform: res.data.platform,
          company: res.data.company,
        });
      } else {
        setError(sanitizeAIMessage(res.data.message) || 'Failed to load AI analytics');
      }
    } catch (err: any) {
      setError(sanitizeAIMessage(err?.response?.data?.message || err.message) || 'Failed to load AI analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedCompanyId, limitDays]);

  const activeData = stats?.company || stats?.platform;
  const total = activeData?.total || 0;
  const localCount = activeData?.byProvider?.local || 0;
  const geminiCount = activeData?.byProvider?.gemini || 0;
  const fallbackCount = activeData?.byProvider?.fallback || 0;
  const localPct = total > 0 ? Math.round((localCount / total) * 100) : 0;
  const estimatedSavings = stats?.company?.estimatedGeminiCostSavedByLocal
    ?? (stats?.platform
      ? (stats.platform.byProvider?.local || 0) * 0.0012
      : 0);

  const byFeatureEntries = Object.entries(activeData?.byFeature || {}) as [string, number][];
  const maxFeatureCount = Math.max(1, ...byFeatureEntries.map(([, c]) => c));

  const recentErrors = stats?.company?.recentErrors || [];
  const topCompanies = stats?.platform?.topCompanies || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-violet-400" />
            Tavro AI Usage Analytics
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Platform-wide and per-company AI feature utilization, provider mix, and cost savings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={limitDays}
            onChange={(e) => setLimitDays(parseInt(e.target.value))}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-violet-500/50"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <input
            type="text"
            placeholder="Filter by Company ID (optional)"
            value={selectedCompanyId || ''}
            onChange={(e) => setSelectedCompanyId(e.target.value.trim() || null)}
            className="w-64 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
          />

          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total AI Requests</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{isLoading ? '—' : total.toLocaleString()}</span>
            <span className="text-xs font-semibold text-slate-400">requests</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last {limitDays} days
            </span>
            <span>
              {selectedCompanyId ? 'Single Workspace' : 'All Workspaces'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tavro AI Optimized Requests</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{isLoading ? '—' : `${localPct}%`}</span>
            <span className="text-xs font-semibold text-emerald-400">
              {localCount.toLocaleString()} requests
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60">
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${localPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tavro AI Requests</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{isLoading ? '—' : geminiCount.toLocaleString()}</span>
            <span className="text-xs font-semibold text-blue-400">
              {total > 0 ? `${Math.round((geminiCount / total) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Tavro AI cloud requests</span>
            <span>
              {fallbackCount > 0 ? `${fallbackCount.toLocaleString()} fallback` : 'No fallbacks'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated Savings</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {isLoading ? '—' : `$${estimatedSavings.toFixed(2)}`}
            </span>
            <span className="text-xs font-semibold text-emerald-400">saved</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Estimated request savings</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Optimized responses
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-violet-400" />
                <span>Usage by Feature</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Request volume distribution across AI-powered features
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {byFeatureEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No feature usage data for selected period
              </div>
            ) : (
              byFeatureEntries
                .sort(([, a], [, b]) => b - a)
                .map(([feature, count]) => {
                  const pct = Math.max(2, Math.round((count / maxFeatureCount) * 100));
                  const totalAll = byFeatureEntries.reduce((s, [, c]) => s + c, 0);
                  const share = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;
                  return (
                    <div key={feature}>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-300 capitalize">{feature.replace(/_/g, ' ')}</span>
                        <span className="text-violet-400 font-bold">
                          {count.toLocaleString()} ({share}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-400" />
                <span>Tavro AI Response Distribution</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tavro AI responses and alternate processing
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Tavro AI Optimized
                </span>
                <span className="text-emerald-400 font-bold">
                  {localCount.toLocaleString()} ({total > 0 ? Math.round((localCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (localCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Tavro AI
                </span>
                <span className="text-blue-400 font-bold">
                  {geminiCount.toLocaleString()} ({total > 0 ? Math.round((geminiCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (geminiCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Fallback Providers
                </span>
                <span className="text-amber-400 font-bold">
                  {fallbackCount.toLocaleString()} ({total > 0 ? Math.round((fallbackCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (fallbackCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Success Rate:</span>
              <span className={`font-bold ${
                activeData && (activeData.successCount || (total - (activeData.errorCount || 0))) / total >= 0.98
                  ? 'text-emerald-400'
                  : activeData && (activeData.successCount || (total - (activeData.errorCount || 0))) / total >= 0.95
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}>
                {total > 0
                  ? `${Math.round(((activeData?.successCount ?? (total - (activeData?.errorCount ?? stats?.platform?.totalErrors ?? 0))) / total) * 100)}%`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span>Recent Errors</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Failed AI requests with error details
              </p>
            </div>
            <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-300">
              {recentErrors.length} issues
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800/60">
            {recentErrors.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                {selectedCompanyId ? 'No errors recorded for this workspace' : 'Filter by workspace to view recent errors'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900/80 sticky top-0">
                    <tr className="text-left text-slate-400 uppercase tracking-wider">
                      <th className="px-3 py-2 font-semibold">Timestamp</th>
                      <th className="px-3 py-2 font-semibold">Feature</th>
                      <th className="px-3 py-2 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentErrors.map((err: any, idx: number) => (
                      <tr key={idx} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                          {new Date(err.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-violet-400 font-semibold capitalize">
                          {err.feature?.replace(/_/g, ' ') || 'unknown'}
                        </td>
                        <td
                          className="px-3 py-2 text-rose-300 max-w-xs truncate"
                          title={sanitizeAIMessage(err.errorMessage) || 'Unknown error'}
                        >
                          {sanitizeAIMessage(err.errorMessage) || 'Unknown error'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {stats?.platform ? (
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  <span>Top Companies by Usage</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Workspaces with highest AI request volume
                </p>
              </div>
              <span className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-300">
                Top {topCompanies.length}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800/60">
              {topCompanies.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No usage data available
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900/80 sticky top-0">
                      <tr className="text-left text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Workspace</th>
                        <th className="px-3 py-2 font-semibold text-right">Requests</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCompanies.map((c: any, idx: number) => (
                        <tr key={c.companyId} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-500 font-semibold w-8">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-slate-200 font-medium">
                            <button
                              onClick={() => setSelectedCompanyId(c.companyId)}
                              className="hover:text-violet-400 transition-colors text-left"
                              title={`Filter: ${c.companyId}`}
                            >
                              {c.companyName}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right text-violet-400 font-bold">
                            {c.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : stats?.company ? (
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-400" />
                  <span>Workspace Summary</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Per-workspace breakdown for filter: {selectedCompanyId}
                </p>
              </div>
              <button
                onClick={() => setSelectedCompanyId(null)}
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              >
                Clear Filter
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Successful</div>
                <div className="mt-1 text-xl font-extrabold text-emerald-400">
                  {(stats.company.successCount || 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Failed</div>
                <div className="mt-1 text-xl font-extrabold text-rose-400">
                  {(stats.company.errorCount || 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Estimated Savings</div>
                <div className="mt-1 text-xl font-extrabold text-amber-400">
                  ${(stats.company.estimatedGeminiCostSavedByLocal || 0).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Recent Records</div>
                <div className="mt-1 text-xl font-extrabold text-indigo-400">
                  {(stats.company.recentRecords?.length || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
