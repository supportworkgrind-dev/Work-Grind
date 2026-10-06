'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import type { EntitlementId } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import {
  LogOut,
  ChevronDown,
  ChevronRight,
  UserCircle,
  LayoutDashboard,
  Users,
  Target,
  MessageSquare,
  Calendar,
  CheckSquare,
  FolderKanban,
  Folder,
  FileText,
  Sparkles,
  BarChart3,
  Workflow,
  ShieldCheck,
  Users2,
  Bell,
  CreditCard,
  Settings,
  Paintbrush2,
  Table2,
  Phone,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react';
import { premiumIconClass } from '@/components/common/AppIcons';
import { getInitials } from '@/lib/utils';
import { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';

type SidebarNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  entitlement?: EntitlementId;
  managerOrAbove?: boolean;
  ownerOrAdmin?: boolean;
};

type SidebarSection = { name: string; items: readonly SidebarNavItem[] };

const navSections: readonly SidebarSection[] = [
  {
    name: 'WORKSPACE',
    items: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Daily Focus', href: '/daily-focus', icon: Target, entitlement: 'aiAssistant' },
      { name: 'Tasks', href: '/tasks', icon: CheckSquare, entitlement: 'tasksProjects' },
      { name: 'Projects', href: '/projects', icon: FolderKanban, entitlement: 'tasksProjects' },
      { name: 'Calendar', href: '/calendar', icon: Calendar, entitlement: 'meetingsCalendar' },
    ],
  },
  {
    name: 'CUSTOMERS',
    items: [
      { name: 'CRM', href: '/crm', icon: Users, entitlement: 'crm' },
      { name: 'Client Portal', href: '/client-portal-mgmt', icon: ShieldCheck, managerOrAbove: true },
    ],
  },
  {
    name: 'COLLABORATE',
    items: [
      { name: 'Chat', href: '/chat', icon: MessageSquare, entitlement: 'teamChat' },
      { name: 'Meetings', href: '/meetings', icon: Calendar, entitlement: 'meetingsCalendar' },

      { name: 'Global Calling', href: '/calling', icon: PhoneCall },
      { name: 'Whiteboard', href: '/whiteboard', icon: Paintbrush2 },
      { name: 'Docs', href: '/docs', icon: FileText, entitlement: 'fileStorage' },
    ],
  },
  {
    name: 'RESOURCES',
    items: [
      { name: 'Files', href: '/files', icon: Folder, entitlement: 'fileStorage' },
      { name: 'Sheets', href: '/sheets', icon: Table2, entitlement: 'fileStorage' },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, entitlement: 'advancedAnalytics' },
      { name: 'Automation', href: '/workflows', icon: Workflow },
    ],
  },
  {
    name: 'INTELLIGENCE',
    items: [
      { name: 'Tavro AI', href: '/ai', icon: Sparkles, entitlement: 'aiAssistant' },
    ],
  },
  {
    name: 'ADMIN',
    items: [
      { name: 'Team', href: '/team', icon: Users2 },
      { name: 'Notifications', href: '/notifications', icon: Bell },
      { name: 'Billing', href: '/billing', icon: CreditCard },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const statusColors = {
  online:  'bg-emerald-500',
  away:    'bg-amber-400',
  busy:    'bg-rose-500',
  offline: 'bg-slate-300',
} as const;

const statusLabels = {
  online:  'Online',
  away:    'Away',
  busy:    'Do not disturb',
  offline: 'Appear offline',
} as const;

// ── Granular selectors — each sub-component only re-renders for its own data ─
export const Sidebar = memo(function Sidebar() {
  const pathname       = usePathname();
  // Granular selectors: Sidebar only re-renders when these specific values change
  const user           = useAuthStore((s) => s.user);
  const company        = useAuthStore((s) => s.company);
  const subscription   = useAuthStore((s) => s.subscription);
  const canUse         = useAuthStore((s) => s.canUse);
  const logout         = useAuthStore((s) => s.logout);
  const updateUserStatus = useAuthStore((s) => s.updateUserStatus);
  const isSidebarOpen  = useAppStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023.98px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      media.removeEventListener?.('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  const userStatus = (user?.status ?? 'online') as keyof typeof statusColors;
  const canManageClientPortal = ['owner', 'admin', 'manager'].includes(user?.role ?? '');

  // Keep section visibility and item permissions derived from one navigation config.
  const visibleSections = useMemo(
    () => navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          (!item.managerOrAbove || canManageClientPortal) && (!item.ownerOrAdmin || ['owner', 'admin'].includes(user?.role ?? '')) && (!item.entitlement || canUse(item.entitlement)),
        ),
      }))
      .filter((section) => section.items.length > 0),
    [canManageClientPortal, canUse, subscription, user?.role],
  );

  const handleStatusChange = useCallback(
    (st: 'online' | 'away' | 'busy' | 'offline') => {
      updateUserStatus(st);
      setShowStatusMenu(false);
    },
    [updateUserStatus],
  );

  return (
    <>
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
        />
      )}
      <aside
        className={`workspace-sidebar fixed inset-y-0 left-0 z-40 flex flex-col border-r theme-bg-sidebar theme-border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isMobile ? 'w-[82vw] max-w-[280px]' : isSidebarOpen ? 'w-64' : 'w-[4.5rem]'}
          ${isMobile ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}`}
        style={{ boxShadow: isSidebarOpen ? 'var(--shadow-sm)' : 'none' }}
      >
      {/* ── WORKSPACE HEADER ── */}
      <div className="flex h-16 items-center border-b theme-border px-3 gap-3 overflow-hidden"
        style={{ background: 'var(--bg-sidebar)' }}>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center"
        >
          {company?.logo ? (
            <img src={company.logo} alt="Workspace logo" className="h-9 w-9 object-contain" />
          ) : (
            <ThemeAwareLogo size="sm" showWordmark={false} surface="auto" />
          )}
        </div>

        {isSidebarOpen && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold theme-text-primary leading-tight">
              {company?.name || 'WorkGrind'}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider leading-tight mt-0.5 theme-text-muted">
              {company?.accountType === 'individual' ? 'Personal workspace' : user?.role ?? 'Workspace'}
            </span>
          </div>
        )}

        {isSidebarOpen && (
          <ChevronRight className="h-3.5 w-3.5 theme-text-muted shrink-0 opacity-40" />
        )}
      </div>

      {/* ── NAVIGATION ── */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin"
        style={{ padding: isSidebarOpen ? '0.75rem 0.625rem' : '0.75rem 0.5rem' }}
      >
        <div className="space-y-2">
          {visibleSections.map((section) => (
            <section key={section.name}>
              {isSidebarOpen && (
                <span className="section-label block px-3 pb-1 pt-1.5 text-[9px] font-semibold">
                  {section.name}
                </span>
              )}
              <div className="space-y-0.5">
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                title={!isSidebarOpen ? item.name : undefined}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  group relative flex items-center gap-3 rounded-xl
                  transition-all duration-150 focus-ring nav-item-motion
                  ${isSidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                  ${isActive ? 'sidebar-active-premium' : 'theme-nav-inactive hover:theme-bg-hover'}
                `}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}

                <Icon
                  className={`${premiumIconClass} shrink-0 transition-colors duration-150
                    ${isSidebarOpen ? 'h-[1.125rem] w-[1.125rem]' : 'h-5 w-5'}
                    ${isActive ? 'text-[var(--accent)]' : 'theme-text-muted group-hover:theme-text-secondary'}`}
                />

                {isSidebarOpen && (
                  <span className="flex-1 truncate text-[13px] font-medium">{item.name}</span>
                )}

                {!isSidebarOpen && (
                  <span className="nav-tooltip">{item.name}</span>
                )}
              </Link>
            );
          })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      {/* ── USER PROFILE FOOTER ── */}
      <div className="border-t theme-border p-2.5">
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu((p) => !p)}
            aria-expanded={showStatusMenu}
            aria-haspopup="menu"
            className={`
              flex w-full items-center gap-3 rounded-xl p-2
              transition-all duration-150 hover:theme-bg-hover
              ${!isSidebarOpen ? 'justify-center' : ''}
            `}
          >
            <div className="relative shrink-0">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden font-semibold text-xs"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
              >
                {user?.avatar
                  ? <img src={user.avatar} alt="Avatar" className="h-8 w-8 object-cover" />
                  : <span>{getInitials(user?.fullName || 'U')}</span>
                }
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ${statusColors[userStatus]}`}
                style={{ '--tw-ring-color': 'var(--bg-sidebar)' } as React.CSSProperties}
              />
            </div>

            {isSidebarOpen && (
              <>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] font-semibold theme-text-primary leading-tight">
                    {user?.fullName || 'My Account'}
                  </span>
                  <span className="truncate text-[10px] theme-text-muted leading-tight capitalize">
                    {user?.jobTitle || user?.role || 'Team Member'}
                  </span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 theme-text-muted shrink-0 transition-transform duration-150 ${showStatusMenu ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>

          {showStatusMenu && (
            <div
              className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl border p-2 shadow-xl z-50 animate-scale-in"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              role="menu"
            >
              <div className="flex items-center gap-2.5 px-2.5 py-2 border-b mb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden text-xs font-bold"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
                >
                  {user?.avatar
                    ? <img src={user.avatar} alt="" className="h-8 w-8 object-cover" />
                    : getInitials(user?.fullName || 'U')
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate theme-text-primary">{user?.fullName}</p>
                  <p className="text-[10px] truncate theme-text-muted">{user?.email}</p>
                </div>
              </div>

              <p className="section-label px-2.5 py-1.5">Set status</p>

              {(['online', 'away', 'busy', 'offline'] as const).map((st) => (
                <button
                  key={st}
                  role="menuitem"
                  onClick={() => handleStatusChange(st)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-100
                    ${userStatus === st ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColors[st]}`} />
                  <span className="flex-1 text-left">{statusLabels[st]}</span>
                  {userStatus === st && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  )}
                </button>
              ))}

              <div className="my-1.5 h-px" style={{ background: 'var(--border-subtle)' }} />

              <button
                role="menuitem"
                onClick={() => logout()}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-500 hover:bg-rose-50 transition-all"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
});
