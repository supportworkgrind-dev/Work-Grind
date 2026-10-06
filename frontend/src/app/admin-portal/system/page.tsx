'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/adminApi';
import {
  Server,
  Database,
  Mail,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  ShieldCheck,
  Send,
} from 'lucide-react';

export default function SuperAdminSystemPage() {
  const [systemData, setSystemData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSystemData = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.get('/system/health');
      if (res.data.success) {
        setSystemData(res.data.system);
      }
    } catch (err: any) {
      console.error('Failed to load system health:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const res = await adminApi.post('/system/test-email', {});
      setEmailTestResult({ success: res.data.success, message: res.data.message });
    } catch (err: any) {
      setEmailTestResult({
        success: false,
        message: err.response?.data?.message || 'SMTP connection verification failed.',
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Diagnostics & Operations</h1>
          <p className="mt-1 text-xs text-slate-400">
            Node runtime environment, MongoDB Atlas replica state, and messaging gateway telemetry
          </p>
        </div>

        <button
          onClick={fetchSystemData}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Server Runtime */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Cpu className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Server Runtime</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Online
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Uptime:</span>
              <span className="font-semibold text-white">
                {systemData?.server ? formatUptime(systemData.server.uptimeSeconds) : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Memory RSS:</span>
              <span className="font-semibold text-slate-200">{systemData?.server?.memoryUsedMB} MB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Heap Allocation:</span>
              <span className="font-semibold text-slate-200">
                {systemData?.server?.heapUsedMB} / {systemData?.server?.heapTotalMB} MB
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Node Engine:</span>
              <span className="font-mono text-slate-300">{systemData?.server?.nodeVersion}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Environment:</span>
              <span className="font-semibold text-indigo-400 uppercase">{systemData?.server?.environment}</span>
            </div>
          </div>
        </div>

        {/* Database Collections */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Database className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-white">MongoDB Cluster</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Connected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Users</span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {systemData?.database?.collections?.users ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Companies</span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {systemData?.database?.collections?.companies ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Tasks</span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {systemData?.database?.collections?.tasks ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Projects</span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {systemData?.database?.collections?.projects ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Messages</span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {systemData?.database?.collections?.messages ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Files</span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {systemData?.database?.collections?.files ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Email Gateway */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Mail className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Email Subsystem</h3>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  systemData?.email?.isConfigured
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                {systemData?.email?.isConfigured ? 'Configured' : 'Dev / Test'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Gateway:</span>
                <span className="font-semibold text-slate-300">{systemData?.email?.host}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Sender:</span>
                <span className="font-semibold text-slate-300 truncate max-w-[150px]">
                  {systemData?.email?.sender}
                </span>
              </div>
            </div>

            {emailTestResult && (
              <div
                className={`mt-3 rounded-xl border p-2.5 text-xs font-semibold ${
                  emailTestResult.success
                    ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-950/40 text-rose-300'
                }`}
              >
                {emailTestResult.message}
              </div>
            )}
          </div>

          <button
            onClick={handleTestEmail}
            disabled={testingEmail}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-all"
          >
            <Send className={`h-3.5 w-3.5 ${testingEmail ? 'animate-pulse text-indigo-400' : ''}`} />
            <span>{testingEmail ? 'Pinging Gateway...' : 'Verify SMTP Connection'}</span>
          </button>
        </div>
      </div>

      {/* Recent Activity Audit Logs Stream */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <span>Platform Audit Trail (Recent Security Events)</span>
        </h3>

        {systemData?.recentLogs?.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No recent security events logged.</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {systemData?.recentLogs?.map((log: any) => (
              <div key={log._id} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-200">{log.action}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Target: {log.resource} ({log.resourceId})
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0">
                  {new Date(log.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
