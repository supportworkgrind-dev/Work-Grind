'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { LANGUAGES, useI18n, type LangCode } from '@/lib/i18n';
import { getWorkspaceProfileForTheme } from '@/lib/workspaceProfiles';
import { normalizeTheme, THEME_OPTIONS, useThemeStore, type Theme } from '@/lib/themeStore';
import { User, Company } from '@/types';
import { Avatar } from '@/components/common/Avatar';
import {
  User as UserIcon,
  Building2,
  Users,
  Shield,
  CreditCard,
  FileText,
  Save,
  Check,
  HardDrive,
  AlertCircle,
  Copy,
  RefreshCw,
  UserPlus,
  Send,
  Trash2,
  Mail,
  Link as LinkIcon,
  CheckCircle2,
  X,
  Search,
  Filter,
  Clock,
  Sparkles,
  Palette,
  Bell,
  Globe2,
  CheckCheck,
  PhoneCall,
} from 'lucide-react';
import { formatBytes, formatDate, getInitials } from '@/lib/utils';
import { CountrySelect } from '@/components/common/CountrySelect';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

const NOTIFICATION_DEFAULTS = {
  taskAssigned: true,
  meetingReminder: true,
  newMessage: true,
  dealUpdate: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, company, subscription, fetchCurrentUser, setUser, setCompany, logout, isAtLimit, refreshSubscription } = useAuthStore();
  const memberLimitReached = isAtLimit('members');
  const { lang, setLang } = useI18n();
  const storeTheme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'workspace' | 'members' | 'security' | 'audit'>('profile');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') !== 'security') return;
    const timer = window.setTimeout(() => setActiveTab('security'), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [skills, setSkills] = useState(user?.skills?.join(', ') || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Workspace Form State
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [industry, setIndustry] = useState(company?.industry || 'Technology');
  const [size, setSize] = useState(company?.size || '11-50');
  const [timeZone, setTimeZone] = useState(company?.timeZone || 'UTC');
  const [country, setCountry] = useState(company?.country || 'United States');
  const [allowGuestAccess, setAllowGuestAccess] = useState(company?.settings?.allowGuestAccess || false);
  const [defaultRole, setDefaultRole] = useState(company?.settings?.defaultRole || 'employee');
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [inviteCode, setInviteCode] = useState(company?.inviteCode || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  // Members Management State
  const [members, setMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');

  // Pending Invites State
  const [pendingInvites, setPendingInvites] = useState<{
    email: string;
    token: string;
    expiresAt: string;
    role: string;
  }[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'employee' | 'manager' | 'admin' | 'guest'>('employee');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [notificationPrefs, setNotificationPrefs] = useState({ ...NOTIFICATION_DEFAULTS, ...user?.notificationPreferences });
  const [preferredLanguage, setPreferredLanguage] = useState<LangCode>(user?.preferredLanguage ?? lang);
  const [appearanceTheme, setAppearanceTheme] = useState<Theme>(normalizeTheme(user?.theme ?? storeTheme));
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const [callingId, setCallingId] = useState('');
  const [callingIdLoading, setCallingIdLoading] = useState(true);
  const [callingIdError, setCallingIdError] = useState('');
  const [callingIdCopied, setCallingIdCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/users/me/calling-id')
      .then((response) => { if (active) setCallingId(response.data.callingId || ''); })
      .catch((error: unknown) => { if (active) setCallingIdError(error instanceof Error ? error.message : 'Calling ID could not be loaded.'); })
      .finally(() => { if (active) setCallingIdLoading(false); });
    return () => { active = false; };
  }, []);

  const copyCallingId = async () => {
    if (!callingId) return;
    try {
      await navigator.clipboard.writeText(callingId);
      setCallingIdCopied(true);
      window.setTimeout(() => setCallingIdCopied(false), 1800);
    } catch {
      setCallingIdError('Clipboard access was denied. Select and copy your ID manually.');
    }
  };

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setJobTitle(user.jobTitle || '');
      setDepartment(user.department || '');
      setPhone(user.phone || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
      setSkills(user.skills?.join(', ') || '');
      setNotificationPrefs({ ...NOTIFICATION_DEFAULTS, ...user.notificationPreferences });
      setPreferredLanguage(user.preferredLanguage ?? lang);
      setAppearanceTheme(normalizeTheme(user.theme ?? storeTheme));
    }
    if (company) {
      setCompanyName(company.name || '');
      setIndustry(company.industry || 'Technology');
      setSize(company.size || '11-50');
      setTimeZone(company.timeZone || 'UTC');
      setCountry(company.country || 'United States');
      setInviteCode(company.inviteCode || '');
      if (company.settings) {
        setAllowGuestAccess(company.settings.allowGuestAccess || false);
        setDefaultRole(company.settings.defaultRole || 'employee');
      }
    }
  }, [user, company, storeTheme]);

  useEffect(() => {
    setAppearanceTheme(storeTheme);
  }, [storeTheme]);

  const handleSavePreferences = async () => {
    setPreferencesSaving(true);
    setPreferencesSaved(false);
    setPreferencesError('');
    try {
      const res = await api.patch('/users/me', {
        notificationPreferences: notificationPrefs,
        preferredLanguage,
        theme: appearanceTheme,
        ...(getWorkspaceProfileForTheme(appearanceTheme)
          ? { workspaceProfile: getWorkspaceProfileForTheme(appearanceTheme) }
          : {}),
      });

      if (res.data.success) {
        setTheme(appearanceTheme);
        setLang(preferredLanguage);
        if (res.data.user) setUser(res.data.user);
        else await fetchCurrentUser();
        setPreferencesSaved(true);
        setTimeout(() => setPreferencesSaved(false), 2000);
      } else {
        setPreferencesError(res.data.message || 'Unable to save preferences.');
      }
    } catch (err: any) {
      setPreferencesError(err.response?.data?.message || 'Unable to save preferences. Please try again.');
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleThemeSelect = (theme: Theme) => {
    setAppearanceTheme(theme);
    setTheme(theme);
    if (user) {
      const workspaceProfile = getWorkspaceProfileForTheme(theme);
      setUser({
        ...user,
        theme,
        ...(workspaceProfile ? { workspaceProfile } : {}),
      });
    }
    setPreferencesSaved(false);
    setPreferencesError('');
  };

  const handleLanguageSelect = (language: LangCode) => {
    setPreferredLanguage(language);
    setLang(language);
    setPreferencesSaved(false);
    setPreferencesError('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== user?.email?.trim().toLowerCase()) {
      setDeleteError('Please type your exact email to confirm deactivation.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await api.patch('/users/me/deactivate', {
        password: deletePassword,
        confirmEmail: user?.email,
      });

      if (res.data.success) {
        setDeleteModalOpen(false);
        await logout();
      }
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Unable to deactivate account.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await api.get('/admin/members');
      if (res.data.success) {
        setMembers(res.data.members);
      }
    } catch (err) {
      // If non-admin, fallback to company members list
      try {
        const fallbackRes = await api.get('/companies/members');
        if (fallbackRes.data.success) setMembers(fallbackRes.data.members);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchInvites = async () => {
    setInvitesLoading(true);
    try {
      const res = await api.get('/companies/invites');
      if (res.data.success) {
        setPendingInvites(res.data.invites || []);
        if (res.data.inviteCode) {
          setInviteCode(res.data.inviteCode);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
      fetchInvites();
    } else if (activeTab === 'workspace') {
      fetchInvites();
    } else if (activeTab === 'audit') {
      api.get('/admin/audit-logs').then((res) => {
        if (res.data.success) setAuditLogs(res.data.logs);
      });
    }
  }, [activeTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    if (!fullName.trim()) {
      setProfileError('Enter your name before saving your profile.');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await api.patch('/users/me', {
        fullName,
        jobTitle,
        department,
        phone,
        bio,
        avatar,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      });

      if (res.data.success) {
        if (res.data.user) {
          setUser(res.data.user);
        }
        setProfileSaved(true);
        if (!res.data.user) await fetchCurrentUser();
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        setProfileError(res.data.message || 'Unable to save your profile.');
      }
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Unable to save your profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedImageTypes.includes(file.type)) {
      setAvatarError('Choose a PNG, JPG, GIF, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Profile photo must be smaller than 2MB.');
      event.target.value = '';
      return;
    }

    setAvatarUploading(true);
    setAvatarError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.patch('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        const nextAvatar = res.data.avatar || res.data.user?.avatar || '';
        setAvatar(nextAvatar);
        await fetchCurrentUser();
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } catch (err: any) {
      console.error(err);
      setAvatarError(err?.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySaving(true);
    setCompanySaved(false);
    setCompanyError('');
    try {
      const res = await api.patch('/companies', {
        name: companyName,
        industry,
        size,
        country,
        timeZone,
        settings: {
          allowGuestAccess,
          defaultRole,
        },
      });

      if (res.data.success) {
        setCompany(res.data.company);
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 2000);
      } else {
        setCompanyError(res.data.message || 'Unable to save workspace settings.');
      }
    } catch (err: any) {
      setCompanyError(err.response?.data?.message || 'Unable to save workspace settings. Please try again.');
    } finally {
      setCompanySaving(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!confirm('Regenerating will invalidate the previous invite code and link. Any unsent links with the old code will no longer work. Continue?')) {
      return;
    }
    setRegeneratingCode(true);
    try {
      const res = await api.post('/companies/regenerate-invite-code');
      if (res.data.success) {
        setInviteCode(res.data.inviteCode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingCode(false);
    }
  };

  const copyShareableLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const link = `${origin}/join?code=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteSending(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const res = await api.post('/companies/invite', {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (res.data.success) {
        setInviteSuccess(`Invitation sent to ${inviteEmail}!`);
        setInviteEmail('');
        fetchInvites();
        void refreshSubscription();
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setInviteSuccess('');
        }, 1500);
      }
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Failed to send invite email.');
    } finally {
      setInviteSending(false);
    }
  };

  const handleRevokeInvite = async (token: string) => {
    if (!confirm('Are you sure you want to revoke this invitation? The recipient will no longer be able to use it.')) {
      return;
    }
    try {
      const res = await api.delete(`/companies/invites/${token}`);
      if (res.data.success) {
        setPendingInvites((prev) => prev.filter((i) => i.token !== token));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResendInvite = async (token: string) => {
    try {
      const res = await api.post(`/companies/invites/${token}/resend`);
      if (res.data.success) {
        alert('Invitation resent successfully with renewed 7-day expiration!');
        fetchInvites();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await api.patch(`/admin/members/${userId}/role`, { role: newRole });
      if (res.data.success) {
        setMembers((prev) => prev.map((m) => (m._id === userId ? res.data.member : m)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const action = currentActive ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this member's access to the workspace?`)) {
      return;
    }
    try {
      const res = await api.patch(`/admin/members/${userId}/status`, { isActive: !currentActive });
      if (res.data.success) {
        setMembers((prev) => prev.map((m) => (m._id === userId ? res.data.member : m)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to completely remove ${name} from this workspace? They will lose access to all channels, files, and projects.`)) {
      return;
    }
    try {
      const res = await api.delete(`/companies/members/${userId}`);
      if (res.data.success) {
        setMembers((prev) => prev.filter((m) => m._id !== userId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.department && m.department.toLowerCase().includes(memberSearch.toLowerCase()));

    const matchesRole = memberRoleFilter === 'all' || m.role === memberRoleFilter;
    return matchesSearch && matchesRole;
  });

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const allNavTabs = [
    { id: 'profile', label: 'My Profile', icon: UserIcon, adminOnly: false },
    { id: 'preferences', label: 'Preferences', icon: Palette, adminOnly: false },
    { id: 'security', label: 'Security & Password', icon: Shield, adminOnly: false },
    { id: 'workspace', label: 'Workspace Config', icon: Building2, adminOnly: true },
    { id: 'members', label: 'Members & Roles', icon: Users, adminOnly: true },
    // { id: 'billing', label: 'Billing & Plan', icon: CreditCard, adminOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: FileText, adminOnly: true },
  ];

  const navTabs = allNavTabs.filter((t) => !t.adminOnly || isOwnerOrAdmin);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'admin':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'manager':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'guest':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="page-hero-sm">
        <h1 className="page-title-lg">Account &amp; Workspace Settings</h1>
        <p className="page-subtitle mt-1">
          Manage your personal profile, security credentials, and organization configurations
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-5 lg:gap-6">
        {/* Settings Navigation Tabs */}
        <div className="w-full md:w-56 shrink-0 flex gap-1.5 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`min-w-max md:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? 'sidebar-active-premium' : 'theme-nav-inactive hover:theme-bg-hover'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 min-w-0 theme-card rounded-2xl border p-4 sm:p-6 shadow-[var(--shadow-card)] transition-colors">
          {/* PERMISSION DENIED FOR EMPLOYEES ON ADMIN TABS */}
          {!isOwnerOrAdmin && ['workspace', 'members', 'audit'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Administrator Privileges Required</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                This section is restricted to Workspace Owners and Admins. Please contact your organization administrator for modifications.
              </p>
              <button
                onClick={() => setActiveTab('profile')}
                className="btn-primary mt-2"
              >
                Return to My Profile
              </button>
            </div>
          )}

          {/* PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Personal Employee Profile
              </h3>

              {profileError && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSaved && (
                <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Profile changes saved.</span>
                </div>
              )}

              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={fullName || user?.fullName || 'User'} src={avatar || undefined} size="lg" shape="circle" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Profile photo</p>
                    <p className="text-[11px] text-slate-500">PNG, JPG, GIF, or WEBP up to 2MB</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {avatarUploading ? 'Uploading...' : 'Upload photo'}
                  </button>
                </div>
              </div>

              {avatarError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
                  {avatarError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Frontend Architect"
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Product Engineering"
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Product Strategy, UI Design"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell your team about your role, background, and focus..."
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {profileSaved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
                  <span>{profileSaved ? 'Profile Saved' : profileSaving ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold theme-text-primary">
                    <Palette className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    Appearance &amp; Preferences
                  </h3>
                  <p className="mt-1 text-[11px] theme-text-muted">Choose a workspace theme, language, and notification preferences.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={preferencesSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-on-accent)] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-sm)' }}
                >
                  {preferencesSaved ? <CheckCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {preferencesSaved ? 'Preferences saved' : preferencesSaving ? 'Saving…' : 'Save preferences'}
                </button>
              </div>

              {preferencesError && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{preferencesError}</span>
                </div>
              )}

              {preferencesSaved && (
                <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Theme, language, and notification preferences are synced to your account.</span>
                </div>
              )}

              <section className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }} aria-labelledby="calling-id-heading">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><PhoneCall className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <h4 id="calling-id-heading" className="text-xs font-bold theme-text-primary">WorkGrind Calling ID</h4>
                    <p className="mt-1 text-[10px] leading-relaxed theme-text-muted">Share this ID with teammates in your workspace so they can find your safe profile in the Calling directory. It does not start a call.</p>
                    {callingIdError && <p role="alert" className="mt-2 text-xs text-rose-600">{callingIdError}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <code className="min-h-10 min-w-28 rounded-lg border px-3 py-2 text-center text-sm font-bold tracking-wider theme-text-primary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }} aria-live="polite">
                    {callingIdLoading ? 'Loading…' : callingId || 'Unavailable'}
                  </code>
                  <button type="button" onClick={copyCallingId} disabled={!callingId || callingIdLoading} aria-label="Copy Calling ID" title="Copy Calling ID" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border theme-text-primary disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-color)' }}>
                    {callingIdCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </section>

              <section aria-labelledby="appearance-heading" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <div>
                    <h4 id="appearance-heading" className="text-xs font-bold theme-text-primary">Appearance</h4>
                    <p className="text-[10px] theme-text-muted">Changes apply throughout WorkGrind immediately.</p>
                  </div>
                </div>

                {(['classic', 'workspace'] as const).map((category) => (
                  <div key={category} className="space-y-2.5">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider theme-text-muted">
                      {category === 'classic' ? 'WorkGrind themes' : 'Workspace profiles'}
                    </h5>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {THEME_OPTIONS.filter((option) => option.category === category).map((option) => {
                    const selected = appearanceTheme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${option.label}${selected ? ', selected' : ''}. ${option.description}`}
                        onClick={() => handleThemeSelect(option.id)}
                        className="group overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                        style={{
                          borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
                          boxShadow: selected ? '0 0 0 2px var(--accent-glow)' : 'var(--shadow-xs)',
                          background: 'var(--bg-card)',
                        }}
                      >
                        <div className="h-16 p-2.5" style={{ background: option.swatches[0] }}>
                          <div className="flex h-full gap-1.5">
                            <div className="w-1/4 rounded-md" style={{ background: option.swatches[1] }} />
                            <div className="flex flex-1 flex-col gap-1.5 rounded-md p-1.5" style={{ background: option.swatches[1] }}>
                              <div className="h-2 w-2/3 rounded-full" style={{ background: option.swatches[2] }} />
                              <div className="flex gap-1">
                                <div className="h-4 flex-1 rounded-sm" style={{ background: option.swatches[0] }} />
                                <div className="h-4 flex-1 rounded-sm opacity-70" style={{ background: option.swatches[0] }} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block text-xs font-bold theme-text-primary">{option.label}</span>
                            <span className="mt-0.5 block truncate text-[10px] theme-text-muted">{option.description}</span>
                          </span>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-strong)', background: selected ? 'var(--accent)' : 'transparent' }}>
                            {selected && <Check className="h-3 w-3" style={{ color: 'var(--text-on-accent)' }} />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                    </div>
                  </div>
                ))}

                <div className="rounded-xl border p-4 transition-colors" style={{ background: 'var(--bg-sunken)', borderColor: 'var(--border-subtle)' }}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider theme-text-muted">Live preview</span>
                    <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>{THEME_OPTIONS.find((item) => item.id === appearanceTheme)?.label} selected</span>
                  </div>
                  <div className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg" style={{ background: 'var(--accent)' }} />
                      <div className="min-w-0 flex-1">
                        <div className="h-2 w-28 max-w-full rounded-full" style={{ background: 'var(--text-primary)', opacity: 0.8 }} />
                        <div className="mt-1.5 h-1.5 w-40 max-w-full rounded-full" style={{ background: 'var(--text-muted)', opacity: 0.6 }} />
                      </div>
                      <span className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>Action</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 border-t pt-5 md:grid-cols-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <label htmlFor="settings-language" className="mb-2 flex items-center gap-2 text-xs font-bold theme-text-primary">
                    <Globe2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />Language
                  </label>
                  <select
                    id="settings-language"
                    value={preferredLanguage}
                    onChange={(event) => handleLanguageSelect(event.target.value as LangCode)}
                    className="theme-input block w-full rounded-xl border px-3 py-2.5 text-xs focus:ring-2"
                  >
                    {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label} · {language.native}</option>)}
                  </select>
                  <p className="mt-1.5 text-[10px] theme-text-muted">The interface language updates immediately and syncs when you save.</p>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-bold theme-text-primary">
                    <Bell className="h-4 w-4" style={{ color: 'var(--accent)' }} />Notifications
                  </h4>
                  <div className="space-y-1.5">
                    {Object.entries(notificationPrefs).map(([key, enabled]) => {
                      const label = key.replace(/([A-Z])/g, ' $1').trim();
                      return (
                        <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs theme-text-secondary transition-colors hover:theme-bg-hover" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                          <span className="capitalize">{label}</span>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={label}
                            checked={enabled}
                            onChange={(event) => {
                              setNotificationPrefs((previous) => ({ ...previous, [key]: event.target.checked }));
                              setPreferencesSaved(false);
                              setPreferencesError('');
                            }}
                            className="h-4 w-4 shrink-0 rounded accent-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* WORKSPACE SETTINGS */}
          {activeTab === 'workspace' && (
            <div className="space-y-6">
              {companyError && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{companyError}</span>
                </div>
              )}
              {companySaved && (
                <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Workspace settings saved.</span>
                </div>
              )}
              {company?.accountType === 'individual' && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">Current Mode: Solo Workspace</h4>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                          Individual
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-xl">
                        Ready to collaborate? Upgrading unlocks full multi-user team invites, role permissions, and shared team channels.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.patch('/companies', { accountType: 'company' });
                        if (res.data.success) {
                          setCompany(res.data.company);
                          alert('Workspace upgraded to Company / Team mode! You can now invite members.');
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-all shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Upgrade to Team Workspace</span>
                  </button>
                </div>
              )}

              {/* Workspace Details Form */}
              <form onSubmit={handleSaveWorkspace} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Workspace Configuration
                  </h3>
                  <button
                    type="submit"
                    disabled={companySaving}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all disabled:opacity-50"
                  >
                    {companySaved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
                    <span>{companySaved ? 'Saved' : companySaving ? 'Saving...' : 'Update Workspace'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Workspace / Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Industry
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="Technology">Technology</option>
                      <option value="Design & Creative">Design & Creative</option>
                      <option value="Marketing & Media">Marketing & Media</option>
                      <option value="Finance & Fintech">Finance & Fintech</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Company Size
                    </label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="1-10">1-10 Employees</option>
                      <option value="11-50">11-50 Employees</option>
                      <option value="51-200">51-200 Employees</option>
                      <option value="500+">500+ Employees</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Country / Region
                    </label>
                    <CountrySelect
                      value={country}
                      onChange={(c) => setCountry(c)}
                      placeholder="Select country (e.g. Pakistan, USA)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Default TimeZone
                    </label>
                    <select
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Default Member Role
                    </label>
                    <select
                      value={defaultRole}
                      onChange={(e) => setDefaultRole(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="employee">Employee (Standard Member)</option>
                      <option value="manager">Manager (Project Lead)</option>
                      <option value="guest">Guest (Restricted Access)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={allowGuestAccess}
                      onChange={(e) => setAllowGuestAccess(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Allow external guest collaborators to join selected channels and projects</span>
                  </label>
                </div>
              </form>

              {/* Shareable Invite Code & Link Card */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-600 p-1.5 text-white">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Workspace Invitation Link & Code</h4>
                      <p className="text-[11px] text-slate-500">Anyone with this link or code can join this workspace</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateInviteCode}
                    disabled={regeneratingCode}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    <RefreshCw className={`h-3 w-3 ${regeneratingCode ? 'animate-spin' : ''}`} />
                    <span>Reset Code</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspace Code</span>
                    <div className="mt-1 flex items-center justify-between">
                      <code className="text-base font-extrabold tracking-wider text-indigo-600">{inviteCode || 'N/A'}</code>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy Code"
                      >
                        {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instant Join URL</span>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600 truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/join?code=${inviteCode}` : `/join?code=${inviteCode}`}
                      </span>
                      <button
                        type="button"
                        onClick={copyShareableLink}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition-all shrink-0"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MEMBERS & ROLES */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Header with Invite Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Workspace Members & Role Permissions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total {members.length} active members • Manage access levels and invitations
                  </p>
                </div>

                {isOwnerOrAdmin && (memberLimitReached ? (
                  <a href="/billing" className="shrink-0 text-xs font-semibold text-indigo-600 underline">Member limit reached · Upgrade</a>
                ) : (
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all shrink-0"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Invite Member</span>
                  </button>
                ))}
              </div>

              {/* Filters Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by name, email, or department..."
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <select
                  value={memberRoleFilter}
                  onChange={(e) => setMemberRoleFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-700 shadow-2xs"
                >
                  <option value="all">All Roles</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                  <option value="guest">Guest</option>
                </select>
              </div>

              {/* Members Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-slate-700 text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Role & Access</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {membersLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Loading workspace members...
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No members found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((m) => {
                          const isSelf = m._id === user?._id;
                          const isTargetOwner = m.role === 'owner';
                          const canEditThisMember = isOwnerOrAdmin && !isTargetOwner && !isSelf;

                          return (
                            <tr key={m._id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 font-bold text-indigo-700 text-xs shrink-0">
                                    {getInitials(m.fullName)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                      <span>{m.fullName}</span>
                                      {isSelf && (
                                        <span className="rounded bg-indigo-50 text-indigo-600 text-[9px] font-bold px-1.5 py-0.2">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-400">{m.email}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-slate-600">
                                {m.department || m.jobTitle || 'General'}
                              </td>

                              <td className="py-3 px-4">
                                {canEditThisMember ? (
                                  <select
                                    value={m.role}
                                    onChange={(e) => handleChangeRole(m._id, e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-600"
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="manager">Manager</option>
                                    <option value="employee">Employee</option>
                                    <option value="guest">Guest</option>
                                  </select>
                                ) : (
                                  <span
                                    className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeStyle(
                                      m.role
                                    )}`}
                                  >
                                    {m.role}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {canEditThisMember ? (
                                  <button
                                    onClick={() => handleToggleActive(m._id, m.isActive)}
                                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-colors ${
                                      m.isActive
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {m.isActive ? 'Active' : 'Suspended'}
                                  </button>
                                ) : (
                                  <span
                                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                                      m.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {m.isActive ? 'Active' : 'Suspended'}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right">
                                {canEditThisMember && (
                                  <button
                                    onClick={() => handleRemoveMember(m._id, m.fullName)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                    title="Remove from Workspace"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pending Invitations Section */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pending Email Invitations ({pendingInvites.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Invited users who have not yet accepted their invitation link
                    </p>
                  </div>
                  <button
                    onClick={fetchInvites}
                    className="p-1 rounded text-slate-400 hover:text-slate-600"
                    title="Refresh Invites"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {invitesLoading ? (
                  <p className="text-xs text-slate-400 py-3">Loading pending invitations...</p>
                ) : pendingInvites.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No pending invitations. Click "Invite Member" to bring teammates into this workspace.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.token}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <Mail className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{invite.email}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span className="capitalize font-semibold text-slate-600">{invite.role}</span>
                              <span>•</span>
                              <span>Expires {formatDate(invite.expiresAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => handleResendInvite(invite.token)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Resend Email
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(invite.token)}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BILLING & PLAN (Temporarily Disabled) */}
          {/* (activeTab as any) === 'billing' && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Subscription & Storage Usage
              </h3>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Active Plan</span>
                  <h4 className="text-xl font-extrabold text-slate-900 mt-0.5">WorkGrind Pro Workspace</h4>
                  <p className="text-xs text-slate-500 mt-1">Up to 5 members, 1 GB storage, 50 AI requests per month, meetings, and priority support</p>
                </div>
                <span className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs">
                  Active
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Drive Storage Consumption</span>
                  <span>{formatBytes(subscription?.usage.storageBytes ?? company?.storage?.used ?? 0)} / {formatBytes(subscription?.limits.storage ?? 1_073_741_824)}</span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-600 w-1/12" />
                </div>
              </div>
            </div>
          ) */}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPassError('');
                setPassSuccess('');

                if (newPassword !== confirmNewPassword) {
                  setPassError('The new password and confirmation do not match.');
                  return;
                }
                if (
                  newPassword.length < 8 ||
                  !/[A-Z]/.test(newPassword) ||
                  !/[a-z]/.test(newPassword) ||
                  !/[0-9]/.test(newPassword) ||
                  !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)
                ) {
                  setPassError('Use at least 8 characters with uppercase, lowercase, a number, and a special character.');
                  return;
                }
                setPassSaving(true);

                try {
                  const res = await api.post('/auth/change-password', {
                    currentPassword,
                    newPassword,
                  });

                  if (res.data.success) {
                    setPassSuccess(res.data.message || 'Password updated successfully!');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  } else {
                    setPassError(res.data.message || 'Unable to update your password.');
                  }
                } catch (err: any) {
                  setPassError(err.response?.data?.message || 'Failed to update password. Please check your credentials.');
                } finally {
                  setPassSaving(false);
                }
              }}
              className="space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Security & Authentication
              </h3>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-bold text-slate-900">Sign-in providers</h4>
                <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
                  Link a provider to this account. Its verified email must match your WorkGrind email.
                </p>
                <SocialAuthButtons intent="link" />
              </section>

              {passError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div>
                <label htmlFor="settingsCurrentPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="settingsCurrentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="settingsNewPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="settingsNewPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars: 1 upper, 1 lower, 1 number, 1 special char"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-hidden"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Must be at least 8 characters long and contain uppercase, lowercase, number, and special character (!@#$).
                </p>
              </div>

              <div>
                <label htmlFor="settingsConfirmNewPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="settingsConfirmNewPassword"
                  name="confirmNewPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-hidden"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={passSaving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-2xs disabled:opacity-60"
                >
                  {passSaving ? 'Verifying & Updating...' : 'Update Password'}
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Deactivate Account
                </button>
              </div>
            </form>
          )}

          {/* AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Administrative Audit Trail
              </h3>

              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.length === 0 ? (
                  <p className="py-6 text-center text-slate-400">No audit records logged yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log._id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{log.action}</span>
                        <span className="text-slate-500 ml-2">by {log.userId?.fullName || 'Admin'}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDate(log.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Deactivate account</h3>
                <p className="text-[11px] text-slate-500 mt-1">This disables your login and signs you out immediately.</p>
              </div>
              <button type="button" onClick={() => setDeleteModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">Confirm email</label>
                <input
                  type="email"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={user?.email || 'you@example.com'}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">Current password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDeleteModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={handleDeleteAccount} disabled={deleteLoading} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60">
                  {deleteLoading ? 'Processing...' : 'Confirm Deactivation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteError('');
                  setInviteSuccess('');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {inviteSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
            )}

            {inviteError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              {memberLimitReached && <p className="text-xs text-amber-700">This workspace has reached its member limit. <a href="/billing" className="font-semibold underline">Upgrade your plan</a>.</p>}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Colleague's Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Role & Access Level
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="employee">Employee — Standard tasks, channels, and projects</option>
                  <option value="manager">Manager — Lead teams, create projects, assign tasks</option>
                  <option value="admin">Admin — Manage workspace settings, members, and roles</option>
                  <option value="guest">Guest — Restricted to explicitly shared channels/projects</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSending || memberLimitReached}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{inviteSending ? 'Sending...' : 'Send Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
