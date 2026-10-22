'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
  FileText,
  Save,
  Check,
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
  Sparkles,
  Palette,
  Bell,
  Globe2,
  CheckCheck,
  PhoneCall,
} from 'lucide-react';
import { formatDate, getInitials } from '@/lib/utils';
import { CountrySelect } from '@/components/common/CountrySelect';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import {
  canAccessOrganizationFeature,
  canAccessRoute,
  getAssignableRoles,
  getWorkspaceExperience,
  isWorkspaceOwnerRole,
} from '@/lib/organizationAccess';
import { LinkedInConnectionCard } from '@/components/automation/LinkedInConnectionCard';
import { getAuthValue, updateAuthTokens } from '@/lib/authSession';
import { refreshSocketAuthLazily } from '@/lib/socketLoader';

const NOTIFICATION_DEFAULTS = {
  taskAssigned: true,
  meetingReminder: true,
  newMessage: true,
  dealUpdate: true,
};

type NotificationKey = keyof typeof NOTIFICATION_DEFAULTS;

// Each toggle maps to the in-app notification type the backend checks before
// delivering (utils/notificationPreferences.ts). A toggle is shown only when the
// user can reach the feature that produces it.
const NOTIFICATION_OPTIONS: { key: NotificationKey; label: string; description: string; route: string }[] = [
  { key: 'taskAssigned', label: 'Tasks assigned to me', description: 'When a teammate assigns you a task.', route: '/tasks' },
  { key: 'meetingReminder', label: 'Meeting invitations', description: 'When you are invited to a meeting.', route: '/meetings' },
  { key: 'newMessage', label: 'Direct messages', description: 'When someone sends you a direct message.', route: '/chat' },
  { key: 'dealUpdate', label: 'CRM deal updates', description: 'When a deal you own is updated.', route: '/crm' },
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const INDUSTRY_OPTIONS = ['Technology', 'Design & Creative', 'Marketing & Media', 'Finance & Fintech', 'Other'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Notice = { tone: 'success' | 'error'; text: string } | null;
type PendingAction =
  | { kind: 'regenerate' }
  | { kind: 'upgrade' }
  | { kind: 'revoke'; token: string; email: string }
  | { kind: 'toggle'; userId: string; name: string; isActive: boolean }
  | { kind: 'remove'; userId: string; name: string };

type AuditLogEntry = {
  _id: string;
  action: string;
  createdAt: string;
  userId?: { fullName?: string } | null;
};

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function SettingsPage() {
  const { user, company, fetchCurrentUser, setUser, setCompany, logout, isAtLimit, refreshSubscription } = useAuthStore();
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

  // Workspace Form State — initialized only from the saved workspace; fields the
  // workspace has never set stay empty instead of being filled with guesses.
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [industry, setIndustry] = useState(company?.industry || '');
  const [size, setSize] = useState(company?.size || '');
  const [timeZone, setTimeZone] = useState(company?.timeZone || '');
  const [country, setCountry] = useState(company?.country || '');
  const [currency, setCurrency] = useState(company?.currency || '');
  const [academicYearStartMonth, setAcademicYearStartMonth] = useState(company?.academicSettings?.academicYearStartMonth || 8);
  const [gradingScale, setGradingScale] = useState<NonNullable<Company['academicSettings']>['gradingScale']>(company?.academicSettings?.gradingScale || 'percentage');
  const [defaultRole, setDefaultRole] = useState(company?.settings?.defaultRole || 'employee');
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<Notice>(null);

  // Inline confirmation replaces window.confirm for destructive actions.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Members Management State
  const [members, setMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');
  const [memberNotice, setMemberNotice] = useState<Notice>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyInviteToken, setBusyInviteToken] = useState<string | null>(null);

  // Pending Invites State
  const [pendingInvites, setPendingInvites] = useState<{
    email: string;
    token: string;
    expiresAt: string;
    role: string;
  }[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState('');

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditHasMore, setAuditHasMore] = useState(false);

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
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState('');
  const appearanceRequest = useRef(0);
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

  const applyProfileFields = (source: User) => {
    setFullName(source.fullName || '');
    setJobTitle(source.jobTitle || '');
    setDepartment(source.department || '');
    setPhone(source.phone || '');
    setBio(source.bio || '');
    setAvatar(source.avatar || '');
    setSkills(source.skills?.join(', ') || '');
  };

  const applyWorkspaceFields = (source: Company) => {
    setCompanyName(source.name || '');
    setIndustry(source.industry || '');
    setSize(source.size || '');
    setTimeZone(source.timeZone || '');
    setCountry(source.country || '');
    setCurrency(source.currency || '');
    setAcademicYearStartMonth(source.academicSettings?.academicYearStartMonth || 8);
    setGradingScale(source.academicSettings?.gradingScale || 'percentage');
    setDefaultRole(source.settings?.defaultRole || 'employee');
  };

  // Seed the forms when the signed-in user or workspace changes, not on every
  // store update: saving one section must not wipe unsaved edits in another.
  const userId = user?._id;
  const companyId = company?._id;
  useEffect(() => {
    const current = useAuthStore.getState().user;
    if (!current) return;
    applyProfileFields(current);
    setNotificationPrefs({ ...NOTIFICATION_DEFAULTS, ...current.notificationPreferences });
    if (current.preferredLanguage) setPreferredLanguage(current.preferredLanguage);
    setAppearanceTheme(normalizeTheme(current.theme ?? useThemeStore.getState().theme));
  }, [userId]);

  useEffect(() => {
    const current = useAuthStore.getState().company;
    if (current) applyWorkspaceFields(current);
  }, [companyId]);

  useEffect(() => {
    setAppearanceTheme(storeTheme);
  }, [storeTheme]);

  const handleSavePreferences = async () => {
    setPreferencesSaving(true);
    setPreferencesSaved(false);
    setPreferencesError('');
    try {
      // Theme and language are saved when they are picked; this saves notifications.
      const res = await api.patch('/users/me', { notificationPreferences: notificationPrefs });
      if (!res.data.success || !res.data.user) {
        setPreferencesError(res.data.message || 'Unable to save notification preferences.');
        return;
      }
      setUser(res.data.user);
      setNotificationPrefs({ ...NOTIFICATION_DEFAULTS, ...res.data.user.notificationPreferences });
      setPreferencesSaved(true);
      setTimeout(() => setPreferencesSaved(false), 2000);
    } catch (err) {
      setPreferencesError(errorMessage(err, 'Unable to save notification preferences. Please try again.'));
    } finally {
      setPreferencesSaving(false);
    }
  };

  /**
   * Theme and language apply immediately, so they are persisted immediately too;
   * a failed save restores the previous value instead of leaving the UI showing
   * a choice the account does not have. Only the latest pick may settle state.
   */
  const persistAppearance = async (
    body: Record<string, unknown>,
    apply: () => void,
    restore: () => void,
    savedText: string,
  ) => {
    const request = ++appearanceRequest.current;
    apply();
    setAppearanceSaving(true);
    setAppearanceSaved('');
    setPreferencesError('');
    try {
      const res = await api.patch('/users/me', body);
      if (request !== appearanceRequest.current) return;
      if (!res.data.success || !res.data.user) throw new Error(res.data.message);
      setUser(res.data.user);
      setAppearanceSaved(savedText);
      window.setTimeout(() => setAppearanceSaved((current) => (current === savedText ? '' : current)), 2500);
    } catch (err) {
      if (request !== appearanceRequest.current) return;
      restore();
      setPreferencesError(errorMessage(err, 'That change could not be saved, so your previous setting was restored.'));
    } finally {
      if (request === appearanceRequest.current) setAppearanceSaving(false);
    }
  };

  const handleThemeSelect = (theme: Theme) => {
    const previous = appearanceTheme;
    const workspaceProfile = getWorkspaceProfileForTheme(theme);
    void persistAppearance(
      { theme, ...(workspaceProfile ? { workspaceProfile } : {}) },
      () => { setAppearanceTheme(theme); setTheme(theme); },
      () => { setAppearanceTheme(previous); setTheme(previous); },
      'Theme saved to your account.',
    );
  };

  const handleLanguageSelect = (language: LangCode) => {
    const previous = preferredLanguage;
    void persistAppearance(
      { preferredLanguage: language },
      () => { setPreferredLanguage(language); setLang(language); },
      () => { setPreferredLanguage(previous); setLang(previous); },
      'Language saved to your account.',
    );
  };

  // ── Workspace context: from the authenticated session (/auth/me), which the
  // server derives from the database. Controls are hidden here for clarity, but
  // every action is authorized again by the API.
  const organization = company ?? (
    user?.companyId && typeof user.companyId === 'object' ? user.companyId : null
  );
  const experience = getWorkspaceExperience(organization);
  const isSolo = experience === 'solo';
  const isEducation = experience === 'school' || experience === 'college' || experience === 'university';
  const ownsWorkspace = Boolean(user && organization && 'ownerId' in organization && organization.ownerId === user._id) ||
    isWorkspaceOwnerRole(user?.role);
  const canManageWorkspace = canAccessOrganizationFeature(organization, user?.role, 'workspaceSettings');
  // Workspace administration (roles, suspension, removal, invite code, audit) is
  // limited to owners/admins (and principals in education) on the server.
  const canAdministerWorkspace = canManageWorkspace && !isSolo;
  const canManageMembers = canAccessOrganizationFeature(organization, user?.role, 'memberDirectory');
  const canViewAudit = canAdministerWorkspace;
  const assignableRoles = getAssignableRoles(organization, user?.role, ownsWorkspace);
  const visibleNotificationOptions = NOTIFICATION_OPTIONS.filter((option) =>
    canAccessRoute(organization, user?.role, option.route));
  const isOwnerAccount = ownsWorkspace;

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteConfirm('');
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== user?.email?.trim().toLowerCase()) {
      setDeleteError('Please type your exact email to confirm deactivation.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Enter your current password to confirm.');
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
        closeDeleteModal();
        await logout();
      } else {
        setDeleteError(res.data.message || 'Unable to deactivate account.');
      }
    } catch (err) {
      setDeleteError(errorMessage(err, 'Unable to deactivate account.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    setMembersError('');
    const fetchAllMembers = async (endpoint: string): Promise<User[]> => {
      const allMembers: User[] = [];
      for (let page = 1; page <= 501; page += 1) {
        const response = await api.get(endpoint, { params: { page, limit: 200 } });
        if (!response.data.success) throw new Error('Unable to load workspace members.');
        allMembers.push(...response.data.members);
        if (!response.data.hasMore) return allMembers;
      }
      throw new Error('The workspace has more members than can be loaded at once.');
    };

    try {
      // Administrators also see suspended members; other member managers see the
      // active directory they are allowed to read.
      setMembers(await fetchAllMembers(canAdministerWorkspace ? '/admin/members' : '/companies/members'));
    } catch (err) {
      setMembers([]);
      setMembersError(errorMessage(err, 'Workspace members could not be loaded.'));
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchInvites = async () => {
    setInvitesLoading(true);
    setInvitesError('');
    try {
      const res = await api.get('/companies/invites');
      if (!res.data.success) throw new Error('Invitations could not be loaded.');
      setPendingInvites(res.data.invites || []);
      setInviteCode(res.data.inviteCode || '');
    } catch (err) {
      setInvitesError(errorMessage(err, 'Invitations could not be loaded.'));
    } finally {
      setInvitesLoading(false);
    }
  };

  const auditRequest = useRef(0);
  const fetchAuditLogs = async (page: number) => {
    const request = ++auditRequest.current;
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await api.get('/admin/audit-logs', { params: { page, limit: 50 } });
      if (request !== auditRequest.current) return;
      if (!res.data.success) throw new Error('Audit records could not be loaded.');
      setAuditLogs((previous) => (page === 1 ? res.data.logs : [...previous, ...res.data.logs]));
      setAuditPage(page);
      setAuditHasMore(Boolean(res.data.hasMore));
    } catch (err) {
      if (request !== auditRequest.current) return;
      setAuditError(errorMessage(err, 'Audit records could not be loaded.'));
    } finally {
      if (request === auditRequest.current) setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members' && canManageMembers) {
      void fetchMembers();
      void fetchInvites();
    } else if (activeTab === 'workspace' && canAdministerWorkspace) {
      void fetchInvites();
    } else if (activeTab === 'audit' && canViewAudit) {
      void fetchAuditLogs(1);
    }
  }, [activeTab, canManageMembers, canAdministerWorkspace, canViewAudit]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    if (!fullName.trim()) {
      setProfileError('Enter your name before saving your profile.');
      return;
    }
    const skillList = [...new Set(skills.split(',').map((s) => s.trim()).filter(Boolean))];
    if (skillList.length > 30 || skillList.some((skill) => skill.length > 50)) {
      setProfileError('List up to 30 skills of at most 50 characters each.');
      return;
    }
    setProfileSaving(true);
    try {
      // The photo is managed by the upload control and is not resent here.
      const res = await api.patch('/users/me', {
        fullName,
        jobTitle,
        department,
        phone,
        bio,
        skills: skillList,
      });

      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        applyProfileFields(res.data.user);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        setProfileError(res.data.message || 'Unable to save your profile.');
      }
    } catch (err) {
      setProfileError(errorMessage(err, 'Unable to save your profile. Please try again.'));
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
      } else {
        setAvatarError(res.data.message || 'Failed to upload profile photo.');
      }
    } catch (err) {
      setAvatarError(errorMessage(err, 'Failed to upload profile photo.'));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySaved(false);
    setCompanyError('');
    if (!companyName.trim()) {
      setCompanyError('Enter a workspace name.');
      return;
    }
    if (timeZone && !isValidTimeZone(timeZone)) {
      setCompanyError('Enter a valid IANA time zone, such as Asia/Karachi.');
      return;
    }
    setCompanySaving(true);
    try {
      // Organization and account type are not sent: changing them affects plans
      // and member roles, so they are not editable from this form.
      const res = await api.patch('/companies', {
        name: companyName.trim(),
        country,
        currency,
        ...(timeZone ? { timeZone } : {}),
        ...(!isEducation ? { industry } : {}),
        ...(size ? { size } : {}),
        ...(isEducation ? { academicSettings: { academicYearStartMonth, gradingScale } } : {}),
        ...(!isSolo ? { settings: { defaultRole } } : {}),
      });

      if (res.data.success && res.data.company) {
        setCompany(res.data.company);
        applyWorkspaceFields(res.data.company);
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 2000);
      } else {
        setCompanyError(res.data.message || 'Unable to save workspace settings.');
      }
    } catch (err) {
      setCompanyError(errorMessage(err, 'Unable to save workspace settings. Please try again.'));
    } finally {
      setCompanySaving(false);
    }
  };

  const handleUpgradeWorkspace = async () => {
    setPendingAction(null);
    setUpgrading(true);
    setWorkspaceNotice(null);
    try {
      const res = await api.patch('/companies', { accountType: 'company' });
      if (!res.data.success || !res.data.company) throw new Error(res.data.message);
      setCompany(res.data.company);
      setWorkspaceNotice({ tone: 'success', text: 'This workspace is now a team workspace. You can invite members from Members & Roles.' });
    } catch (err) {
      setWorkspaceNotice({ tone: 'error', text: errorMessage(err, 'The workspace could not be converted. Nothing was changed.') });
    } finally {
      setUpgrading(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    setPendingAction(null);
    setRegeneratingCode(true);
    setWorkspaceNotice(null);
    try {
      const res = await api.post('/companies/regenerate-invite-code');
      if (!res.data.success || !res.data.inviteCode) throw new Error(res.data.message);
      setInviteCode(res.data.inviteCode);
      setWorkspaceNotice({ tone: 'success', text: 'A new invite code was issued. The previous code and link no longer work.' });
    } catch (err) {
      setWorkspaceNotice({ tone: 'error', text: errorMessage(err, 'The invite code could not be reset. The current code still works.') });
    } finally {
      setRegeneratingCode(false);
    }
  };

  const copyText = async (text: string, onCopied: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      setWorkspaceNotice({ tone: 'error', text: 'Clipboard access was denied. Select and copy the text manually.' });
    }
  };

  const inviteLink = inviteCode && typeof window !== 'undefined' ? `${window.location.origin}/join?code=${inviteCode}` : '';

  const copyShareableLink = () => {
    if (!inviteLink) return;
    void copyText(inviteLink, () => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const copyCode = () => {
    if (!inviteCode) return;
    void copyText(inviteCode, () => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setInviteError('');
    setInviteSuccess('');
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;

    setInviteSending(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const res = await api.post('/companies/invite', { email, role: inviteRole });

      if (res.data.success) {
        setInviteSuccess(`Invitation sent to ${email}.`);
        setInviteEmail('');
        void fetchInvites();
        void refreshSubscription();
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setInviteSuccess('');
        }, 1500);
      } else {
        setInviteError(res.data.message || 'Failed to send invite email.');
      }
    } catch (err) {
      setInviteError(errorMessage(err, 'Failed to send invite email.'));
    } finally {
      setInviteSending(false);
    }
  };

  const handleRevokeInvite = async (token: string) => {
    setPendingAction(null);
    setBusyInviteToken(token);
    setMemberNotice(null);
    try {
      const res = await api.delete(`/companies/invites/${token}`);
      if (!res.data.success) throw new Error(res.data.message);
      setPendingInvites((prev) => prev.filter((i) => i.token !== token));
      void refreshSubscription();
      setMemberNotice({ tone: 'success', text: 'Invitation revoked.' });
    } catch (err) {
      setMemberNotice({ tone: 'error', text: errorMessage(err, 'The invitation could not be revoked.') });
    } finally {
      setBusyInviteToken(null);
    }
  };

  const handleResendInvite = async (token: string, email: string) => {
    setBusyInviteToken(token);
    setMemberNotice(null);
    try {
      const res = await api.post(`/companies/invites/${token}/resend`);
      if (!res.data.success) throw new Error(res.data.message);
      setMemberNotice({ tone: 'success', text: `Invitation resent to ${email}. It now expires in 7 days.` });
      void fetchInvites();
    } catch (err) {
      setMemberNotice({ tone: 'error', text: errorMessage(err, 'The invitation could not be resent.') });
    } finally {
      setBusyInviteToken(null);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setBusyMemberId(userId);
    setMemberNotice(null);
    try {
      const res = await api.patch(`/admin/members/${userId}/role`, { role: newRole });
      if (!res.data.success || !res.data.member) throw new Error(res.data.message);
      setMembers((prev) => prev.map((m) => (m._id === userId ? res.data.member : m)));
      setMemberNotice({ tone: 'success', text: `${res.data.member.fullName}'s role is now ${formatRole(res.data.member.role)}.` });
    } catch (err) {
      // The select is controlled by the stored role, so it stays on the old value.
      setMemberNotice({ tone: 'error', text: errorMessage(err, 'The role could not be changed.') });
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    setPendingAction(null);
    setBusyMemberId(userId);
    setMemberNotice(null);
    try {
      const res = await api.patch(`/admin/members/${userId}/status`, { isActive: !currentActive });
      if (!res.data.success || !res.data.member) throw new Error(res.data.message);
      setMembers((prev) => prev.map((m) => (m._id === userId ? res.data.member : m)));
      setMemberNotice({ tone: 'success', text: `${res.data.member.fullName} was ${currentActive ? 'suspended' : 'reactivated'}.` });
    } catch (err) {
      setMemberNotice({ tone: 'error', text: errorMessage(err, 'The member status could not be changed.') });
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    setPendingAction(null);
    setBusyMemberId(userId);
    setMemberNotice(null);
    try {
      const res = await api.delete(`/companies/members/${userId}`);
      if (!res.data.success) throw new Error(res.data.message);
      setMembers((prev) => prev.filter((m) => m._id !== userId));
      void refreshSubscription();
      setMemberNotice({ tone: 'success', text: `${name} was removed from this workspace.` });
    } catch (err) {
      setMemberNotice({ tone: 'error', text: errorMessage(err, 'The member could not be removed.') });
    } finally {
      setBusyMemberId(null);
    }
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    switch (pendingAction.kind) {
      case 'regenerate': void handleRegenerateInviteCode(); break;
      case 'upgrade': void handleUpgradeWorkspace(); break;
      case 'revoke': void handleRevokeInvite(pendingAction.token); break;
      case 'toggle': void handleToggleActive(pendingAction.userId, pendingAction.isActive); break;
      case 'remove': void handleRemoveMember(pendingAction.userId, pendingAction.name); break;
    }
  };

  const pendingActionText = (action: PendingAction): { title: string; body: string; confirm: string } => {
    switch (action.kind) {
      case 'regenerate':
        return { title: 'Reset the invite code?', body: 'The current code and join link stop working immediately.', confirm: 'Reset code' };
      case 'upgrade':
        return { title: 'Convert to a team workspace?', body: 'This switches the workspace from Solo to Team mode so you can invite members. Solo-only pages such as Daily Focus are replaced by the team workspace.', confirm: 'Convert workspace' };
      case 'revoke':
        return { title: `Revoke the invitation for ${action.email}?`, body: 'The invitation link will stop working.', confirm: 'Revoke invitation' };
      case 'toggle':
        return action.isActive
          ? { title: `Suspend ${action.name}?`, body: 'They will lose access to this workspace until reactivated.', confirm: 'Suspend member' }
          : { title: `Reactivate ${action.name}?`, body: 'They will regain access to this workspace.', confirm: 'Reactivate member' };
      case 'remove':
        return { title: `Remove ${action.name} from this workspace?`, body: 'They will lose access to its channels, files, and projects.', confirm: 'Remove member' };
    }
  };

  const renderNotice = (notice: Notice) => notice && (
    notice.tone === 'error' ? (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{notice.text}</span>
      </div>
    ) : (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
        <Check className="h-4 w-4 shrink-0" />
        <span>{notice.text}</span>
      </div>
    )
  );

  const renderPendingAction = (kinds: PendingAction['kind'][]) => {
    if (!pendingAction || !kinds.includes(pendingAction.kind)) return null;
    const text = pendingActionText(pendingAction);
    return (
      <div role="alertdialog" aria-labelledby="settings-confirm-title" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p id="settings-confirm-title" className="font-bold text-slate-900">{text.title}</p>
          <p className="mt-0.5 text-slate-600">{text.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setPendingAction(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={confirmPendingAction} className="rounded-xl bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500">
            {text.confirm}
          </button>
        </div>
      </div>
    );
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.department && m.department.toLowerCase().includes(memberSearch.toLowerCase()));

    const matchesRole = memberRoleFilter === 'all' || m.role === memberRoleFilter;
    return matchesSearch && matchesRole;
  });

  const activeMemberCount = members.filter((m) => m.isActive).length;
  const suspendedMemberCount = members.length - activeMemberCount;

  const allNavTabs = [
    { id: 'profile', label: 'My Profile', icon: UserIcon, adminOnly: false },
    { id: 'preferences', label: 'Preferences', icon: Palette, adminOnly: false },
    { id: 'security', label: 'Security & Password', icon: Shield, adminOnly: false },
    { id: 'workspace', label: 'Workspace Config', icon: Building2, adminOnly: true },
    { id: 'members', label: 'Members & Roles', icon: Users, adminOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: FileText, adminOnly: true },
  ];

  const navTabs = allNavTabs.filter((tab) => {
    if (tab.id === 'workspace') return canManageWorkspace;
    if (tab.id === 'members') return canManageMembers;
    if (tab.id === 'audit') return canViewAudit;
    return true;
  });

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
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  setPendingAction(null);
                }}
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
          {((activeTab === 'workspace' && !canManageWorkspace) ||
            (activeTab === 'members' && !canManageMembers) ||
            (activeTab === 'audit' && !canViewAudit)) && (
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
                Personal Profile
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
                    maxLength={100}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={isEducation ? 'e.g. Mathematics Teacher' : 'e.g. Senior Frontend Architect'}
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
                    maxLength={100}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={isEducation ? 'e.g. Science' : 'e.g. Product Engineering'}
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
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={isSolo ? 'A short note about you and your work...' : 'Tell your team about your role, background, and focus...'}
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
                {visibleNotificationOptions.length > 0 && <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={preferencesSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-on-accent)] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-sm)' }}
                >
                  {preferencesSaved ? <CheckCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {preferencesSaved ? 'Notifications saved' : preferencesSaving ? 'Saving…' : 'Save notifications'}
                </button>}
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
                  <span>Notification preferences saved to your account.</span>
                </div>
              )}

              {appearanceSaved && (
                <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{appearanceSaved}</span>
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
                    <p className="text-[10px] theme-text-muted" aria-live="polite">
                      {appearanceSaving ? 'Saving…' : 'Changes apply immediately and are saved to your account.'}
                    </p>
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
                  <p className="mt-1.5 text-[10px] theme-text-muted">The interface language updates immediately and is saved to your account.</p>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-bold theme-text-primary">
                    <Bell className="h-4 w-4" style={{ color: 'var(--accent)' }} />Notifications
                  </h4>
                  <p className="mb-2 text-[10px] theme-text-muted">In-app notifications in WorkGrind. Email and push delivery are not controlled here.</p>
                  <div className="space-y-1.5">
                    {visibleNotificationOptions.length === 0 ? (
                      <p className="rounded-xl border px-3 py-2.5 text-xs theme-text-muted" style={{ borderColor: 'var(--border-subtle)' }}>
                        No configurable notification types apply to your workspace.
                      </p>
                    ) : visibleNotificationOptions.map(({ key, label, description }) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs theme-text-secondary transition-colors hover:theme-bg-hover" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                        <span>
                          <span className="block font-semibold theme-text-primary">{label}</span>
                          <span className="block text-[10px] theme-text-muted">{description}</span>
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label={label}
                          checked={notificationPrefs[key]}
                          onChange={(event) => {
                            setNotificationPrefs((previous) => ({ ...previous, [key]: event.target.checked }));
                            setPreferencesSaved(false);
                            setPreferencesError('');
                          }}
                          className="h-4 w-4 shrink-0 rounded accent-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* WORKSPACE SETTINGS */}
          {activeTab === 'workspace' && canManageWorkspace && (
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
              {renderNotice(workspaceNotice)}
              {renderPendingAction(['upgrade', 'regenerate'])}
              {isSolo && ownsWorkspace && (
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
                    onClick={() => setPendingAction({ kind: 'upgrade' })}
                    disabled={upgrading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-all shrink-0 disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{upgrading ? 'Converting…' : 'Upgrade to Team Workspace'}</span>
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
                  <label htmlFor="settings-workspace-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {isEducation ? 'Institution Name' : 'Workspace / Organization Name'}
                  </label>
                  <input
                    id="settings-workspace-name"
                    type="text"
                    required
                    maxLength={120}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!isEducation && (
                    <div>
                      <label htmlFor="settings-industry" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Industry
                      </label>
                      <select
                        id="settings-industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="">Not set</option>
                        {industry && !INDUSTRY_OPTIONS.includes(industry) && <option value={industry}>{industry}</option>}
                        {INDUSTRY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                  )}

                  {!isSolo && (
                    <div>
                      <label htmlFor="settings-size" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        {isEducation ? 'Institution Size' : 'Company Size'}
                      </label>
                      <select
                        id="settings-size"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                      >
                        {!size && <option value="">Not set</option>}
                        {COMPANY_SIZES.map((option) => (
                          <option key={option} value={option}>{option} {isEducation ? 'people' : 'Employees'}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                    <label htmlFor="settings-time-zone" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Default time zone (IANA)
                    </label>
                    <input
                      id="settings-time-zone"
                      type="text"
                      maxLength={64}
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      placeholder="e.g. Asia/Karachi"
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Organization type</span>
                    <p className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-slate-700">
                      {isSolo ? 'Solo workspace' : formatRole(organization?.organizationType || 'business')}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">Set when the workspace was created; it determines plans and available roles.</p>
                  </div>
                  <div>
                    <label htmlFor="settings-currency" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Workspace currency</label>
                    <input id="settings-currency" required pattern="[A-Za-z]{3}" minLength={3} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="e.g. USD" className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600" />
                  </div>
                </div>

                {isEducation && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-academic-year" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Academic year starts</label>
                      <select id="settings-academic-year" value={academicYearStartMonth} onChange={(e) => setAcademicYearStartMonth(Number(e.target.value))} className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600">
                        {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="settings-grading-scale" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Default grading scale</label>
                      <select id="settings-grading-scale" value={gradingScale} onChange={(e) => setGradingScale(e.target.value as typeof gradingScale)} className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600">
                        <option value="percentage">Percentage</option>
                        <option value="letter">Letter grade</option>
                        <option value="points">Points</option>
                        <option value="pass_fail">Pass / fail</option>
                      </select>
                    </div>
                  </div>
                )}

                {!isSolo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-default-role" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Default Member Role
                      </label>
                      <select
                        id="settings-default-role"
                        value={defaultRole}
                        onChange={(e) => setDefaultRole(e.target.value)}
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                      >
                        {isEducation ? (
                          <>
                            <option value="student">Student</option>
                            <option value="employee">Employee / Staff</option>
                            <option value="guest">Guest (Restricted Access)</option>
                          </>
                        ) : (
                          <>
                            <option value="employee">Employee (Standard Member)</option>
                            <option value="guest">Guest (Restricted Access)</option>
                          </>
                        )}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400">Given to people who join with the workspace invite code.</p>
                    </div>
                  </div>
                )}
              </form>

              {canAccessOrganizationFeature(organization, user?.role, 'billingAdmin') && (
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Billing &amp; plan</h4>
                    <p className="mt-0.5 text-slate-500">Plans, payments, and subscription status are managed on the Billing page.</p>
                  </div>
                  <Link href="/billing" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                    Open billing
                  </Link>
                </div>
              )}

              {/* Shareable Invite Code & Link Card */}
              {canAdministerWorkspace && (
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
                      onClick={() => setPendingAction({ kind: 'regenerate' })}
                      disabled={regeneratingCode || !inviteCode}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${regeneratingCode ? 'animate-spin' : ''}`} />
                      <span>Reset Code</span>
                    </button>
                  </div>

                  {invitesError ? (
                    <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{invitesError}</span>
                      <button type="button" onClick={() => void fetchInvites()} className="font-semibold underline">Retry</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1 rounded-xl border border-slate-200 bg-white p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspace Code</span>
                        <div className="mt-1 flex items-center justify-between">
                          <code className="text-base font-extrabold tracking-wider text-indigo-600">{invitesLoading ? 'Loading…' : inviteCode || 'Unavailable'}</code>
                          <button
                            type="button"
                            onClick={copyCode}
                            disabled={!inviteCode}
                            className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
                            title="Copy Code"
                            aria-label="Copy workspace code"
                          >
                            {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instant Join URL</span>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-600 truncate">
                            {inviteLink || (invitesLoading ? 'Loading…' : 'Unavailable')}
                          </span>
                          <button
                            type="button"
                            onClick={copyShareableLink}
                            disabled={!inviteLink}
                            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition-all shrink-0 disabled:opacity-50"
                          >
                            {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MEMBERS & ROLES */}
          {activeTab === 'members' && canManageMembers && (
            <div className="space-y-6">
              {/* Header with Invite Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Workspace Members & Role Permissions
                  </h3>
                  <p className="text-xs text-slate-500">
                    {membersLoading || membersError
                      ? 'Manage access levels and invitations'
                      : `${activeMemberCount} active${suspendedMemberCount ? ` · ${suspendedMemberCount} suspended` : ''} • Manage access levels and invitations`}
                  </p>
                </div>

                {assignableRoles.length > 0 && (memberLimitReached ? (
                  <a href="/billing" className="shrink-0 text-xs font-semibold text-indigo-600 underline">Member limit reached · Upgrade</a>
                ) : (
                  <button
                    onClick={() => {
                      setInviteRole(assignableRoles[0]);
                      setInviteError('');
                      setInviteSuccess('');
                      setIsInviteModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all shrink-0"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Invite Member</span>
                  </button>
                ))}
              </div>

              {renderNotice(memberNotice)}
              {renderPendingAction(['toggle', 'remove', 'revoke'])}

              {/* Filters Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by name, email, or department..."
                    aria-label="Search members"
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <select
                  value={memberRoleFilter}
                  onChange={(e) => setMemberRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                  className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-700 shadow-2xs"
                >
                  <option value="all">All Roles</option>
                  {[...new Set(members.map((member) => member.role))].map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
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
                      ) : membersError ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center">
                            <p role="alert" className="text-rose-600">{membersError}</p>
                            <button type="button" onClick={() => void fetchMembers()} className="mt-2 text-xs font-semibold text-indigo-600 underline">
                              Try again
                            </button>
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            {members.length === 0 ? 'No members found in this workspace.' : 'No members found matching your search.'}
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((m) => {
                          const isSelf = m._id === user?._id;
                          const isTargetOwner = ['owner', 'founder'].includes(m.role);
                          const isTargetElevated = [
                            'admin', 'manager', 'principal', 'director', 'dean', 'hod',
                          ].includes(m.role);
                          const canEditThisMember = canAdministerWorkspace && !isTargetOwner && !isSelf &&
                            (ownsWorkspace || !isTargetElevated);
                          const isBusy = busyMemberId === m._id;

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
                                {m.department || m.jobTitle || '—'}
                              </td>

                              <td className="py-3 px-4">
                                {canEditThisMember && assignableRoles.length > 0 ? (
                                  <select
                                    value={m.role}
                                    disabled={isBusy}
                                    aria-label={`Role for ${m.fullName}`}
                                    onChange={(e) => void handleChangeRole(m._id, e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-600 disabled:opacity-60"
                                  >
                                    {!assignableRoles.includes(m.role) && (
                                      <option value={m.role} disabled>{m.role}</option>
                                    )}
                                    {assignableRoles.map((role) => (
                                      <option key={role} value={role}>
                                        {formatRole(role)}
                                      </option>
                                    ))}
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
                                    type="button"
                                    disabled={isBusy}
                                    aria-label={`${m.isActive ? 'Suspend' : 'Reactivate'} ${m.fullName}`}
                                    onClick={() => setPendingAction({ kind: 'toggle', userId: m._id, name: m.fullName, isActive: m.isActive })}
                                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-60 ${
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
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setPendingAction({ kind: 'remove', userId: m._id, name: m.fullName })}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-60"
                                    title="Remove from Workspace"
                                    aria-label={`Remove ${m.fullName} from workspace`}
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
                      Pending Email Invitations{invitesLoading || invitesError ? '' : ` (${pendingInvites.length})`}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Invited users who have not yet accepted their invitation link
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchInvites()}
                    disabled={invitesLoading}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    title="Refresh Invites"
                    aria-label="Refresh invitations"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${invitesLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {invitesLoading ? (
                  <p className="text-xs text-slate-400 py-3">Loading pending invitations...</p>
                ) : invitesError ? (
                  <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{invitesError}</span>
                    <button type="button" onClick={() => void fetchInvites()} className="font-semibold underline">Retry</button>
                  </div>
                ) : pendingInvites.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    {assignableRoles.length > 0
                      ? 'No pending invitations. Click "Invite Member" to bring people into this workspace.'
                      : 'No pending invitations.'}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {pendingInvites.map((invite) => {
                      const canResend = ownsWorkspace || assignableRoles.includes(invite.role);
                      const isBusy = busyInviteToken === invite.token;
                      return (
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

                          {(canResend || canAdministerWorkspace) && (
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {canResend && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleResendInvite(invite.token, invite.email)}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                                >
                                  {isBusy ? 'Working…' : 'Resend Email'}
                                </button>
                              )}
                              {canAdministerWorkspace && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setPendingAction({ kind: 'revoke', token: invite.token, email: invite.email })}
                                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
                    // The server revoked every session and issued a new one for this device.
                    const previousToken = getAuthValue('workgrind_access_token');
                    if (typeof res.data.accessToken === 'string' && previousToken) {
                      updateAuthTokens(res.data.accessToken, previousToken);
                      refreshSocketAuthLazily(res.data.accessToken);
                    }
                    setPassSuccess(res.data.message || 'Password updated successfully.');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  } else {
                    setPassError(res.data.message || 'Unable to update your password.');
                  }
                } catch (err) {
                  setPassError(errorMessage(err, 'Failed to update password. Please check your credentials.'));
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
                  Connect a provider for WorkGrind sign-in. This does not connect Google Drive, Calendar, or other Google services.
                </p>
                <SocialAuthButtons intent="link" connectedProviders={user?.authProviders} />
              </section>
              {company?.accountType === 'company' &&
                company.organizationType === 'business' &&
                ['owner', 'admin', 'manager'].includes(user?.role ?? '') && (
                  <LinkedInConnectionCard canDisconnect={user?.role === 'owner' || user?.role === 'admin'} />
                )}

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

                {isOwnerAccount ? (
                  <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
                    Workspace owners can&apos;t deactivate their account while they own the workspace.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Deactivate Account
                  </button>
                )}
              </div>
            </form>
          )}

          {/* AUDIT LOGS */}
          {activeTab === 'audit' && canViewAudit && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Administrative Audit Trail
              </h3>

              {auditError && (
                <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{auditError}</span>
                  <button type="button" onClick={() => void fetchAuditLogs(auditLogs.length ? auditPage + 1 : 1)} className="font-semibold underline">Retry</button>
                </div>
              )}

              <div className="divide-y divide-slate-100 text-xs">
                {auditLoading && auditLogs.length === 0 ? (
                  <p className="py-6 text-center text-slate-400">Loading audit records…</p>
                ) : auditLogs.length === 0 ? (
                  !auditError && <p className="py-6 text-center text-slate-400">No audit records logged yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log._id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-900">{log.action}</span>
                        <span className="text-slate-500 ml-2">by {log.userId?.fullName || 'a removed user'}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatDate(log.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>

              {auditHasMore && !auditError && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void fetchAuditLogs(auditPage + 1)}
                    disabled={auditLoading}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {auditLoading ? 'Loading…' : 'Load older records'}
                  </button>
                </div>
              )}
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
              <button type="button" onClick={closeDeleteModal} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
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
                <button type="button" onClick={closeDeleteModal} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
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
                <h3 className="text-sm font-bold text-slate-900">Invite Member</h3>
              </div>
              <button
                type="button"
                onClick={closeInviteModal}
                aria-label="Close"
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
                <label htmlFor="settings-invite-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  id="settings-invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label htmlFor="settings-invite-role" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Role & Access Level
                </label>
                <select
                  id="settings-invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-600"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeInviteModal}
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
