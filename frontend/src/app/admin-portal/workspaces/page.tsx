'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import {
  Building2,
  Search,
  Users,
  Briefcase,
  HardDrive,
  Calendar,
  AlertTriangle,
  Sparkles,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function SuperAdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');

  const [planChangeWs, setPlanChangeWs] = useState<any | null>(null);
  const [newPlan, setNewPlan] = useState<'free' | 'starter' | 'pro'>('pro');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  const [deleteWsModal, setDeleteWsModal] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        q: search.trim(),
        plan: planFilter,
        accountType: accountTypeFilter,
      });

      const res = await adminApi.get(`/workspaces?${params.toString()}`);
      if (res.data.success) {
        setWorkspaces(res.data.workspaces);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch (err: any) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, planFilter, accountTypeFilter]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleUpdatePlan = async () => {
    if (!planChangeWs) return;
    setIsUpdatingPlan(true);
    try {
      const res = await adminApi.patch(`/workspaces/${planChangeWs._id}/plan`, {
        plan: newPlan,
      });
      if (res.data.success) {
        showToast(`Workspace "${planChangeWs.name}" updated to ${newPlan.toUpperCase()}`);
        setPlanChangeWs(null);
        fetchWorkspaces();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Plan update failed', 'error');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteWsModal) return;
    setIsDeleting(true);
    try {
      const res = await adminApi.delete(`/workspaces/${deleteWsModal._id}`);
      if (res.data.success) {
        showToast(`Workspace "${deleteWsModal.name}" deleted successfully.`);
        setDeleteWsModal(null);
        fetchWorkspaces();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Deletion failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/90 text-rose-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Workspaces & Organizations</h1>
          <p className="mt-1 text-xs text-slate-400">
            Total {total} workspaces &bull; Monitor organization capacity, storage consumption, and dormant tenants
          </p>
        </div>

        <button
          onClick={fetchWorkspaces}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search organization by name, country, or industry..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-300 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Plans</option>
          <option value="free">Free Tier</option>
          <option value="starter">Starter Tier</option>
          <option value="pro">Pro Tier</option>
        </select>

        <select
          value={accountTypeFilter}
          onChange={(e) => {
            setAccountTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-300 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Modes</option>
          <option value="company">🏢 Company Teams</option>
          <option value="individual">👤 Solo Workspaces</option>
        </select>
      </div>

      {/* Workspaces Table */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Owner</th>
                <th className="py-3.5 px-4">Members</th>
                <th className="py-3.5 px-4">Projects</th>
                <th className="py-3.5 px-4">Storage Used</th>
                <th className="py-3.5 px-4">AI Requests</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Activity Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    Loading workspaces...
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    No workspaces found matching search criteria.
                  </td>
                </tr>
              ) : (
                workspaces.map((ws) => (
                  <tr key={ws._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 font-bold text-xs border border-purple-500/20">
                          {ws.name[0]}
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="font-bold text-white truncate">{ws.name}</span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {ws.industry || 'General'} &bull; {ws.country || 'Global'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-semibold">{ws.ownerId?.fullName || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-500">{ws.ownerId?.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                        <Users className="h-3 w-3 text-slate-400" />
                        {ws.membersCount} / {ws.subscription?.limits?.members === -1 ? 'Unlimited' : ws.subscription?.limits?.members}
                      </span>
                      {ws.usage?.pendingInvites > 0 && <div className="mt-1 text-[10px] text-slate-500">{ws.usage.pendingInvites} invite(s) reserved</div>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                        <Briefcase className="h-3 w-3 text-slate-400" />
                        {ws.projectsCount}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {formatBytes(ws.usage?.storageBytes || 0)} / {formatBytes(ws.subscription?.limits?.storage || 0)}
                    </td>

                    <td className="py-3.5 px-4">
                      {ws.usage?.aiRequests || 0} / {ws.subscription?.limits?.aiRequests === -1 ? 'Unlimited' : ws.subscription?.limits?.aiRequests}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          ws.subscription?.plan === 'pro'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : ws.subscription?.plan === 'starter'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {ws.subscription?.plan || 'free'}
                      </span>
                      <div className="mt-1 text-[10px] capitalize text-slate-500">
                        {ws.subscription?.status === 'none' ? 'No subscription' : ws.subscription?.status || 'No subscription'}
                      </div>
                      {ws.subscription?.status === 'trialing' && ws.subscription.trialEndDate && (
                        <div className="mt-1 text-[10px] text-amber-400">
                          Trial ends {new Date(ws.subscription.trialEndDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {ws.isInactive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          <Clock className="h-3 w-3" />
                          Idle (30d+)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setPlanChangeWs(ws);
                            setNewPlan(ws.subscription?.plan || 'free');
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-purple-400 transition-colors"
                          title="Change Plan"
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteWsModal(ws)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                          title="Delete Workspace"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 bg-slate-950/40 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-white">{workspaces.length}</span> of{' '}
            <span className="font-semibold text-white">{total}</span> organizations
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-medium text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {planChangeWs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Adjust Subscription Plan</h3>
              <button onClick={() => setPlanChangeWs(null)} className="text-slate-400 hover:bg-slate-800 rounded p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Change subscription tier for workspace <strong className="text-white">{planChangeWs.name}</strong>:
            </p>
            <div className="space-y-2">
              {(['free', 'starter', 'pro'] as const).map((tier) => (
                <label
                  key={tier}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer ${
                    newPlan === tier
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="plan"
                      checked={newPlan === tier}
                      onChange={() => setNewPlan(tier)}
                      className="text-indigo-600 h-4 w-4"
                    />
                    <span className="text-xs font-bold uppercase">{tier}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPlanChangeWs(null)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={isUpdatingPlan}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isUpdatingPlan ? 'Saving...' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteWsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Workspace</h3>
                <p className="text-xs text-rose-400 font-medium">Permanent destruction</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently erase workspace <strong className="text-white">{deleteWsModal.name}</strong>?
              All company documents and associations will be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteWsModal(null)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
