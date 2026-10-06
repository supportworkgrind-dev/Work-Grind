'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import {
  LayoutDashboard,
  Users,
  Building2,
  LifeBuoy,
  Server,
  LogOut,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Bell,
  CheckCircle2,
  Mail,
  TrendingUp,
} from 'lucide-react';
import { WorkGrindLogo } from '@/components/common/WorkGrindLogo';
import { adminApi } from '@/lib/adminApi';

const navItems = [
  { name: 'Platform Overview', href: '/admin-portal',          icon: LayoutDashboard, exact: true },
  { name: 'Contact Inbox',     href: '/admin-portal/inbox',    icon: Mail,            isInbox: true },
  { name: 'Users Directory',   href: '/admin-portal/users',    icon: Users },
  { name: 'Workspaces',        href: '/admin-portal/workspaces', icon: Building2 },
  { name: 'CRM Inspector',     href: '/admin-portal/crm',      icon: TrendingUp },
  { name: 'Support Tickets',   href: '/admin-portal/support',  icon: LifeBuoy },
  { name: 'System Diagnostics',href: '/admin-portal/system',   icon: Server },
  { name: 'Admin Security',    href: '/admin-portal/security', icon: ShieldCheck },
];

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { adminUser, isAuthenticated, isLoading, fetchAdminMe, logout } = useAdminAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);

  // If on login page, render children directly without dashboard shell
  const isLoginPage = pathname === '/admin-portal/login';
  const adminWorkspace = pathname.split('/').filter(Boolean).slice(1).join('-') || 'overview';

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await adminApi.get('/tickets?limit=1');
      if (res.data?.success && res.data.counts) {
        setUnreadInboxCount(res.data.counts.unread || 0);
      }
    } catch {
      // Silently ignore background polling errors
    }
  }, []);

  useEffect(() => {
    if (!isLoginPage) {
      fetchAdminMe().then((authorized) => {
        if (!authorized) {
          router.replace('/admin-portal/login');
        } else {
          fetchUnreadCount();
        }
      });
    }
  }, [isLoginPage, fetchAdminMe, router, fetchUnreadCount]);

  // Periodically refresh unread count every 30 seconds
  useEffect(() => {
    if (isLoginPage) return;
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isLoginPage, fetchUnreadCount]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading || (!isAuthenticated && !adminUser)) {
    return (
      <div className="admin-portal-loading theme-scope flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-2xl border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Verifying Super Admin Authorization...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal-shell theme-scope min-h-screen flex" data-admin-workspace={adminWorkspace}>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shrink-0">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-tight">Super Admin</span>
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                Platform Console
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span>{item.name}</span>
                </div>
                {item.isInbox && unreadInboxCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {unreadInboxCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom User Area */}
        <div className="border-t border-slate-800/80 p-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 font-bold text-xs border border-indigo-500/30">
              {adminUser?.fullName?.[0] || 'A'}
            </div>
            <div className="flex flex-col truncate flex-1">
              <span className="text-xs font-bold text-white truncate">{adminUser?.fullName || 'Super Admin'}</span>
              <span className="text-[10px] text-slate-400 truncate">{adminUser?.email}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              title="Open standard workspace"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Workspace</span>
            </Link>
            <button
              onClick={() => {
                logout();
                router.push('/admin-portal/login');
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 sm:px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Operations
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white">{adminUser?.fullName}</p>
              <p className="text-[10px] text-slate-400">Master Super Administrator</p>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-800 bg-slate-900 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </div>
                {item.isInbox && unreadInboxCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadInboxCount}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={() => {
                logout();
                router.push('/admin-portal/login');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
