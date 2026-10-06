'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { adminApi } from '@/lib/adminApi';
import { User, Company } from '@/types';
import {
  Search,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Trash2,
  Eye,
  RefreshCw,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

function getWorkspace(user: User): Company | null {
  return typeof user.companyId === 'object' && user.companyId !== null ? user.companyId : null;
}

function getWorkspaceName(user: User, company: Company | null): string {
  if (company?.name) return company.name;
  const isSolo = user.accountType === 'individual' || company?.accountType === 'individual';
  if (isSolo) return `${user.fullName}'s Workspace`;
  return 'No workspace assigned';
}

function getSubscriptionDetails(user: User, company: Company | null) {
  const status = company?.subscriptionStatus ?? user.subscriptionStatus ?? 'never_subscribed';
  const plan = company?.subscriptionPlan ?? user.subscriptionPlan ?? company?.plan ?? 'free';
  const trialEndDate = company?.trialEndDate ?? user.trialEndDate;

  return { status, plan, trialEndDate };
}

function formatSignupDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatLastActivity(value?: string): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getAccountStatus(user: User): 'Active' | 'Suspended' | 'Inactive' {
  if (!user.isActive) return 'Suspended';
  if (!user.isVerified) return 'Inactive';
  return 'Active';
}

function TrialRemaining({ endDate }: { endDate: string }) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const endTime = new Date(endDate).getTime();
      setDaysLeft(Number.isNaN(endTime) ? -1 : Math.max(0, Math.ceil((endTime - Date.now()) / 86_400_000)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [endDate]);

  if (daysLeft === null) return <span className="text-[11px] text-slate-400">Checking trial...</span>;
  if (daysLeft < 0) return <span className="text-[11px] text-slate-400">End date unavailable</span>;
  return (
    <span className="text-[11px] text-slate-400">
      {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
    </span>
  );
}

function SubscriptionBadge({ user, company }: { user: User; company: Company | null }) {
  const { status, trialEndDate } = getSubscriptionDetails(user, company);
  const label = status === 'trialing'
    ? 'Trial'
    : status === 'active' || status === 'lifetime'
      ? 'Active'
      : status === 'expired'
        ? 'Expired'
        : status === 'cancelled'
          ? 'Cancelled'
          : status === 'past_due'
            ? 'Past due'
            : status === 'unpaid'
              ? 'Payment due'
              : status === 'paused'
                ? 'Paused'
                : status === 'incomplete'
                  ? 'Incomplete'
                  : 'No subscription';
  const tone = status === 'trialing'
    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
    : status === 'active' || status === 'lifetime'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : status === 'expired' || status === 'cancelled'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : status === 'past_due' || status === 'unpaid'
          ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
          : status === 'paused' || status === 'incomplete'
            ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
            : 'border-slate-700 bg-slate-800/70 text-slate-400';
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>
        {label}
      </span>
      {status === 'trialing' && trialEndDate && <TrialRemaining endDate={trialEndDate} />}
      {status === 'trialing' && !trialEndDate && <span className="text-[11px] text-slate-400">End date unavailable</span>}
    </div>
  );
}

function PlanBadge({ user, company }: { user: User; company: Company | null }) {
  const { plan } = getSubscriptionDetails(user, company);
  const label = plan === 'starter' ? 'Starter' : plan === 'pro' ? 'Pro' : 'Free';
  const tone = plan === 'starter'
    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
    : plan === 'pro'
      ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
      : 'border-slate-700 bg-slate-800/70 text-slate-300';

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{label}</span>;
}

function WorkspaceTypeBadge({ isSolo }: { isSolo: boolean }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
      isSolo
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    }`}>
      {isSolo ? 'Solo Workspace' : 'Company Team'}
    </span>
  );
}

function AccountStatusBadge({ user }: { user: User }) {
  const status = getAccountStatus(user);
  const tone = status === 'Active'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : status === 'Suspended'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{status}</span>;
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');   // trialing | starter | pro | expired | cancelled
  const [sortBy, setSortBy] = useState('newest');

  // Modals & Drawers
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);

  const [planChangeUser, setPlanChangeUser] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'starter' | 'pro'>('pro');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  const [deleteUserModal, setDeleteUserModal] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page:        page.toString(),
        limit:       '12',
        q:           search.trim(),
        accountType: accountTypeFilter,
        status:      statusFilter,
        sort:        sortBy,
      });
      if (subFilter !== 'all') params.set('subscriptionPlan', subFilter);

      const res = await adminApi.get(`/users?${params.toString()}`);
      if (res.data.success) {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, accountTypeFilter, statusFilter, subFilter, sortBy]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // View User Details Drawer
  const handleOpenDetails = async (user: User) => {
    setSelectedUser(user);
    setLoadingDetails(true);
    try {
      const res = await adminApi.get(`/users/${user._id}`);
      if (res.data.success) {
        setUserDetails(res.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load user details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Toggle Suspend / Activate
  const handleToggleStatus = async (user: User) => {
    const action = user.isActive ? 'suspend' : 'activate';
    try {
      const res = await adminApi.patch(`/users/${user._id}/status`, {
        isActive: !user.isActive,
      });
      if (res.data.success) {
        setUsers((prev) =>
          prev.map((u) => (u._id === user._id ? { ...u, isActive: !user.isActive } : u))
        );
        if (selectedUser?._id === user._id) {
          setSelectedUser({ ...selectedUser, isActive: !user.isActive });
        }
        showToast(`User ${user.fullName} successfully ${action}ed!`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to ${action} user.`, 'error');
    }
  };

  // Reset Password
  const handleResetPassword = async () => {
    if (!passwordResetUser) return;
    setIsResettingPass(true);
    try {
      const res = await adminApi.post(`/users/${passwordResetUser._id}/reset-password`, {});
      if (res.data.success) {
        setTemporaryPassword(res.data.temporaryPassword);
        showToast(`Password successfully reset for ${passwordResetUser.fullName}!`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Password reset failed.', 'error');
    } finally {
      setIsResettingPass(false);
    }
  };

  // Change Plan
  const handleChangePlan = async () => {
    if (!planChangeUser) return;
    setIsUpdatingPlan(true);
    try {
      const res = await adminApi.patch(`/users/${planChangeUser._id}/plan`, {
        plan: selectedPlan,
      });
      if (res.data.success) {
        showToast(`Workspace plan upgraded to ${selectedPlan.toUpperCase()}!`);
        setPlanChangeUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Plan update failed.', 'error');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!deleteUserModal) return;
    setIsDeleting(true);
    try {
      const res = await adminApi.delete(`/users/${deleteUserModal._id}`);
      if (res.data.success) {
        setUsers((prev) => prev.filter((u) => u._id !== deleteUserModal._id));
        setTotal((prev) => prev - 1);
        showToast(res.data.message || 'User deleted successfully.');
        setDeleteUserModal(null);
        if (selectedUser?._id === deleteUserModal._id) setSelectedUser(null);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Deletion failed.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderUserActions = (user: User) => {
    const company = getWorkspace(user);
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleOpenDetails(user)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
        <button
          type="button"
          onClick={() => handleToggleStatus(user)}
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
            user.isActive
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
          }`}
        >
          Manage
        </button>
        <details className="group/more relative">
          <summary
            aria-label={`More actions for ${user.fullName}`}
            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white [&::-webkit-details-marker]:hidden"
          >
            <MoreVertical className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setPasswordResetUser(user);
                setTemporaryPassword('');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Reset password
            </button>
            <button
              type="button"
              onClick={() => {
                setPlanChangeUser(user);
                setSelectedPlan(company?.subscriptionPlan ?? user.subscriptionPlan ?? 'free');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Change plan
            </button>
            <button
              type="button"
              onClick={() => setDeleteUserModal(user)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </button>
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top ${
            actionMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/90 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Registered Users Directory</h1>
          <p className="mt-1 text-xs text-slate-400">
            Total {total} platform accounts &bull; Search, inspect workspaces, enforce security suspensions
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, or role..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        {/* Account Type Filter */}
        <select
          value={accountTypeFilter}
          onChange={(e) => {
            setAccountTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-300 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Account Types</option>
          <option value="company">🏢 Company Teams</option>
          <option value="individual">👤 Solo / Individual</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-300 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Accounts</option>
          <option value="suspended">Suspended Accounts</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-300 focus:border-indigo-500 outline-none"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="name_desc">Name (Z-A)</option>
          <option value="last_active">Last Active</option>
        </select>
      </div>

      {/* Subscription plan filter chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all',       label: 'All Plans',  color: 'slate'   },
          { key: 'trialing',  label: 'Trial',       color: 'blue'    },
          { key: 'starter',   label: 'Starter',     color: 'indigo'  },
          { key: 'pro',       label: 'Pro',         color: 'violet'  },
          { key: 'expired',   label: 'Expired',     color: 'amber'   },
          { key: 'cancelled', label: 'Cancelled',   color: 'rose'    },
        ] as const).map(({ key, label, color }) => {
          const active = subFilter === key;
          const styles: Record<string, string> = {
            slate:  active ? 'bg-slate-700  border-slate-500  text-white'        : 'border-slate-800 text-slate-400 hover:bg-slate-800',
            blue:   active ? 'bg-blue-600/20 border-blue-500  text-blue-300'     : 'border-slate-800 text-slate-400 hover:bg-slate-800',
            indigo: active ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300': 'border-slate-800 text-slate-400 hover:bg-slate-800',
            violet: active ? 'bg-violet-600/20 border-violet-500 text-violet-300': 'border-slate-800 text-slate-400 hover:bg-slate-800',
            amber:  active ? 'bg-amber-600/20 border-amber-500  text-amber-300'  : 'border-slate-800 text-slate-400 hover:bg-slate-800',
            rose:   active ? 'bg-rose-600/20 border-rose-500    text-rose-300'   : 'border-slate-800 text-slate-400 hover:bg-slate-800',
          };
          return (
            <button key={key} onClick={() => { setSubFilter(key); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${styles[color]}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Users Data Table */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 2xl:hidden">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 2xl:hidden">No users found matching current filters.</div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4 2xl:hidden">
            {users.map((user) => {
              const company = getWorkspace(user);
              const isSolo = user.accountType === 'individual' || company?.accountType === 'individual';
              const lastActivity = user.lastSeen ?? user.lastLogin;
              return (
                <article key={user._id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-600/20 text-sm font-bold text-indigo-300">
                        {user.avatar
                          ? <Image src={user.avatar} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
                          : (user.fullName.trim()[0] || user.email[0] || 'U').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-bold text-white">{user.fullName}</h2>
                          {user.isSuperAdmin && <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-300">Super Admin</span>}
                        </div>
                        <a href={`mailto:${user.email}`} className="block truncate text-xs text-slate-400 hover:text-indigo-300">{user.email}</a>
                      </div>
                    </div>
                    {renderUserActions(user)}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
                    <div className="col-span-2 min-w-0 sm:col-span-3">
                      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Workspace</div>
                      <div className="truncate text-xs font-semibold text-slate-200" title={getWorkspaceName(user, company)}>{getWorkspaceName(user, company)}</div>
                      <div className="mt-1.5"><WorkspaceTypeBadge isSolo={isSolo} /></div>
                    </div>
                    <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Plan</div><PlanBadge user={user} company={company} /></div>
                    <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Subscription</div><SubscriptionBadge user={user} company={company} /></div>
                    <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Signup Date</div><div className="text-xs text-slate-300">{formatSignupDate(user.createdAt)}</div></div>
                    <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Activity</div><div className="text-xs text-slate-300">{formatLastActivity(lastActivity)}</div></div>
                    <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Status</div><AccountStatusBadge user={user} /></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="hidden overflow-x-auto 2xl:block">
          <table className="w-full min-w-[1480px] table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[250px]" />
              <col className="w-[110px]" />
              <col className="w-[145px]" />
              <col className="w-[130px]" />
              <col className="w-[145px]" />
              <col className="w-[120px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead className="border-b border-slate-800 bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Account</th>
                <th className="px-5 py-4">Workspace</th>
                <th className="px-5 py-4">Plan</th>
                <th className="px-5 py-4">Subscription</th>
                <th className="px-5 py-4">Signup Date</th>
                <th className="px-5 py-4">Last Activity</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    Loading registered users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const companyObj = getWorkspace(u);
                  const isSolo = u.accountType === 'individual' || companyObj?.accountType === 'individual';
                  const lastActivity = u.lastSeen ?? u.lastLogin;

                  return (
                    <tr
                      key={u._id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 font-bold text-xs border border-indigo-500/20">
                            {u.avatar ? (
                              <Image src={u.avatar} alt="Avatar" width={36} height={36} unoptimized className="h-9 w-9 rounded-xl object-cover" />
                            ) : (
                              (u.fullName.trim()[0] || u.email[0] || 'U').toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white truncate">{u.fullName}</span>
                              {u.isSuperAdmin && (
                                <span className="rounded bg-indigo-500/20 border border-indigo-500/40 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300 uppercase">
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <a href={`mailto:${u.email}`} className="block truncate text-[11px] text-slate-400 hover:text-indigo-300" title={u.email}>
                              {u.email}
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Workspace */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-200" title={getWorkspaceName(u, companyObj)}>
                            {getWorkspaceName(u, companyObj)}
                          </div>
                          <div className="mt-1.5"><WorkspaceTypeBadge isSolo={isSolo} /></div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3.5 px-4">
                        <PlanBadge user={u} company={companyObj} />
                      </td>

                      {/* Subscription */}
                      <td className="py-3.5 px-4">
                        <SubscriptionBadge user={u} company={companyObj} />
                      </td>

                      {/* Signup Date */}
                      <td className="whitespace-nowrap py-3.5 px-4 text-slate-300 text-[11px]">
                        {formatSignupDate(u.createdAt)}
                      </td>

                      {/* Last Activity */}
                      <td className="whitespace-nowrap py-3.5 px-4 text-slate-300 text-[11px]">
                        {formatLastActivity(lastActivity)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <AccountStatusBadge user={u} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex justify-end">{renderUserActions(u)}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 bg-slate-950/40 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-white">{users.length}</span> of{' '}
            <span className="font-semibold text-white">{total}</span> users
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

      {/* ── USER DETAIL SLIDE-OVER DRAWER ── */}
      {selectedUser && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">User Dossier</span>
            <button
              onClick={() => setSelectedUser(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {loadingDetails ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
              Querying platform databases...
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {/* Profile Card */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 font-bold text-lg border border-indigo-500/30">
                  {selectedUser.fullName[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedUser.fullName}</h3>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        selectedUser.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {selectedUser.isActive ? 'Active' : 'Suspended'}
                    </span>
                    <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300 capitalize">
                      {selectedUser.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Engagement Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Tasks Total</span>
                  <p className="text-base font-bold text-white mt-1">{userDetails?.stats?.assignedTasks ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Tasks Done</span>
                  <p className="text-base font-bold text-emerald-400 mt-1">
                    {userDetails?.stats?.completedTasks ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Projects</span>
                  <p className="text-base font-bold text-indigo-400 mt-1">
                    {userDetails?.stats?.createdProjects ?? 0}
                  </p>
                </div>
              </div>

              {/* Workspace Details */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Workspace Affiliation</h4>                {userDetails?.user?.companyId ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="font-semibold text-white">{userDetails.user.companyId.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Industry:</span>
                      <span className="font-semibold text-slate-200">
                        {userDetails.user.companyId.industry || 'Technology'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Plan:</span>
                      <span className="font-bold text-indigo-400 uppercase">
                        {userDetails.user.companyId.plan}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Country:</span>
                      <span className="font-semibold text-slate-200">
                        {userDetails.user.companyId.country || 'Not set'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No workspace connected</p>
                )}
              </div>

              {/* Subscription Details */}
              {userDetails?.user && (userDetails.user.subscriptionStatus || userDetails.user.trialStartDate) && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">Subscription</h4>
                  {[
                    { label: 'Plan',            value: userDetails.user.subscriptionPlan || '—' },
                    { label: 'Status',          value: userDetails.user.subscriptionStatus || '—' },
                    { label: 'Trial Start',     value: userDetails.user.trialStartDate ? new Date(userDetails.user.trialStartDate).toLocaleDateString() : '—' },
                    { label: 'Trial End',       value: userDetails.user.trialEndDate   ? new Date(userDetails.user.trialEndDate).toLocaleDateString()   : '—' },
                    { label: 'Sub Start',       value: userDetails.user.subscriptionStartDate ? new Date(userDetails.user.subscriptionStartDate).toLocaleDateString() : '—' },
                    { label: 'Sub End',         value: userDetails.user.subscriptionEndDate   ? new Date(userDetails.user.subscriptionEndDate).toLocaleDateString()   : '—' },
                    { label: 'Polar Sub ID',    value: userDetails.user.polarSubscriptionId   || '—' },
                    { label: 'Polar Customer',  value: userDetails.user.polarCustomerId       || '—' },
                    { label: 'Cancel at End',   value: userDetails.user.cancelAtPeriodEnd ? 'Yes' : 'No' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-400">{label}:</span>
                      <span className="font-semibold text-slate-200 text-right max-w-[200px] truncate">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons in Drawer */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => handleToggleStatus(selectedUser)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                    selectedUser.isActive
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {selectedUser.isActive ? 'Suspend User Access' : 'Restore / Activate User Access'}
                </button>

                <button
                  onClick={() => {
                    setPasswordResetUser(selectedUser);
                    setTemporaryPassword('');
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all"
                >
                  Trigger Security Password Reset
                </button>

                <button
                  onClick={() => setDeleteUserModal(selectedUser)}
                  className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                  Delete Account Permanently
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PASSWORD RESET MODAL ── */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-400" />
                <span>Reset User Password</span>
              </h3>
              <button
                onClick={() => setPasswordResetUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Reset password for <strong className="text-white">{passwordResetUser.fullName}</strong> (
              {passwordResetUser.email}). This will terminate all active login sessions for this account.
            </p>

            {temporaryPassword ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 space-y-2 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-400">New Temporary Password</span>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-base font-extrabold text-white tracking-wider font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-emerald-500/40">
                    {temporaryPassword}
                  </code>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Share this password securely with the user. They will be required to change it on next login.
                </p>
              </div>
            ) : (
              <button
                onClick={handleResetPassword}
                disabled={isResettingPass}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition-all"
              >
                {isResettingPass ? 'Generating New Credentials...' : 'Generate New Password'}
              </button>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPasswordResetUser(null)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAN CHANGE MODAL ── */}
      {planChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>Change Workspace Subscription Tier</span>
              </h3>
              <button
                onClick={() => setPlanChangeUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upgrade or downgrade the platform tier for{' '}
              <strong className="text-white">{planChangeUser.fullName}</strong>.
            </p>

            <div className="space-y-2">
              {(['free', 'starter', 'pro'] as const).map((tier) => (
                <label
                  key={tier}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                    selectedPlan === tier
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="plan"
                      checked={selectedPlan === tier}
                      onChange={() => setSelectedPlan(tier)}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">{tier}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {tier === 'pro' ? '100 GB storage, unlimited AI and members' : tier === 'starter' ? '10 GB storage, 200 AI requests and 20 members' : '1 GB storage, 50 AI requests and 5 members'}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setPlanChangeUser(null)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePlan}
                disabled={isUpdatingPlan}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50"
              >
                {isUpdatingPlan ? 'Updating...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PERMANENT DELETE MODAL ── */}
      {deleteUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Permanent Account Deletion</h3>
                <p className="text-xs text-rose-400/90 font-medium">Irreversible destructive action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{deleteUserModal.fullName}</strong> (
              {deleteUserModal.email})? All profile data, session tokens, and workspace ties will be erased.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteUserModal(null)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-500 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting Account...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
