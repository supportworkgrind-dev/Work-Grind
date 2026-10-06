'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { normalizeTheme, useThemeStore } from '@/lib/themeStore';
import { getWorkspaceProfile, WORKSPACE_PROFILES, type WorkspaceProfile } from '@/lib/workspaceProfiles';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Users,
  Briefcase,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Rocket,
  Layers,
  Smile,
  ShieldCheck,
  User,
  Laptop,
  Code2,
  Palette,
  Megaphone,
  TrendingUp,
  ListChecks,
  GraduationCap,
} from 'lucide-react';

const PROFILE_ICONS: Record<WorkspaceProfile, LucideIcon> = {
  developer: Code2,
  creative: Palette,
  marketing: Megaphone,
  sales: TrendingUp,
  project_manager: ListChecks,
  freelancer: Briefcase,
  executive: Building2,
  student: GraduationCap,
  professional: Sparkles,
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, company, isLoading, fetchCurrentUser, setUser } = useAuthStore();
  const setTheme = useThemeStore((state) => state.setTheme);
  const isIndividual = company?.accountType === 'individual' || user?.accountType === 'individual';
  const totalSteps = isIndividual ? 2 : 3;
  const [hasHydratedAuth, setHasHydratedAuth] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [workspaceName, setWorkspaceName] = useState(company?.name || 'My Workspace');
  const [selectedProfile, setSelectedProfile] = useState<WorkspaceProfile>(getWorkspaceProfile(user?.workspaceProfile).id);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>(['']);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [projectTemplate, setProjectTemplate] = useState<string>(getWorkspaceProfile(user?.workspaceProfile).starterProject);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    setHasHydratedAuth(true);
  }, []);

  useEffect(() => {
    if (company?.name) setWorkspaceName(company.name);
  }, [company?.name]);

  const handleAddEmailRow = () => setInviteEmails((emails) => [...emails, '']);

  const handleEmailChange = (index: number, value: string) => {
    setInviteEmails((emails) => emails.map((email, row) => row === index ? value : email));
  };

  const handleRemoveEmail = (index: number) => {
    setInviteEmails((emails) => emails.filter((_, row) => row !== index));
  };

  const handleProfileSelect = async (profileId: WorkspaceProfile) => {
    if (profileSaving || (profileId === selectedProfile && useThemeStore.getState().theme === profileId && user?.workspaceProfile === profileId)) return;
    const previousProfile = selectedProfile;
    const previousTheme = useThemeStore.getState().theme;
    const profile = getWorkspaceProfile(profileId);

    setSelectedProfile(profileId);
    setProjectTemplate(profile.starterProject);
    setTheme(profileId);
    setProfileSaving(true);
    setProfileError('');

    try {
      const res = await api.patch('/users/me', { workspaceProfile: profileId, theme: profileId });
      if (!res.data.success || !res.data.user) throw new Error(res.data.message || 'Unable to save workspace style.');
      setUser(res.data.user);
    } catch (err: any) {
      setSelectedProfile(previousProfile);
      setProjectTemplate(getWorkspaceProfile(previousProfile).starterProject);
      setTheme(normalizeTheme(previousTheme));
      setProfileError(err.response?.data?.message || err.message || 'Unable to save workspace style.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleStep1Next = async () => {
    if (user?.workspaceProfile !== selectedProfile) {
      try {
        const profileRes = await api.patch('/users/me', { workspaceProfile: selectedProfile });
        if (!profileRes.data.success || !profileRes.data.user) {
          throw new Error(profileRes.data.message || 'Unable to save your workspace profile.');
        }
        setUser(profileRes.data.user);
      } catch (err: any) {
        setProfileError(err.response?.data?.message || err.message || 'Unable to save your workspace profile.');
        return;
      }
    }
    if (workspaceName.trim() && workspaceName !== company?.name) {
      await api.patch('/companies', { name: workspaceName.trim() }).catch(() => {});
    }
    setStep(isIndividual ? 3 : 2);
  };

  const handleSendInvitesAndNext = async () => {
    const validEmails = inviteEmails.map((email) => email.trim()).filter((email) => email && email.includes('@'));
    if (validEmails.length && company?._id) {
      setIsSendingInvites(true);
      try {
        for (const email of validEmails) await api.post('/companies/invite', { email, role: 'employee' });
      } catch (err) {
        console.error(err);
      } finally {
        setIsSendingInvites(false);
      }
    }
    setStep(3);
  };

  const handleFinishOnboarding = async () => {
    setIsCompleting(true);
    try {
      if (company?._id && projectTemplate !== 'Welcome to WorkGrind') {
        const profile = getWorkspaceProfile(selectedProfile);
        await api.post('/projects', {
          name: projectTemplate,
          description: projectTemplate === profile.starterProject
            ? profile.starterDescription
            : `${isIndividual ? 'Personal project workspace' : 'Core tracking roadmap'} for ${projectTemplate.toLowerCase()}`,
          color: profile.projectColor,
          priority: 'high',
        });
      }
      await fetchCurrentUser();
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      router.push('/dashboard');
    } finally {
      setIsCompleting(false);
    }
  };

  const COMPANY_TEMPLATES = [
    {
      title: 'Welcome to WorkGrind',
      badge: 'Recommended',
      desc: 'Interactive starter project with 4 pre-made onboarding tasks.',
      icon: Sparkles,
    },
    {
      title: 'Product Roadmap',
      badge: 'Tech & SaaS',
      desc: 'Quarterly feature goals, sprint milestones, and bug triage.',
      icon: Layers,
    },
    {
      title: 'Marketing Campaign',
      badge: 'Growth',
      desc: 'Content calendar, brand rollout, launch checklist, and asset reviews.',
      icon: Rocket,
    },
  ];

  const INDIVIDUAL_TEMPLATES = [
    {
      title: 'Personal Productivity & Goals',
      badge: 'Solo Best',
      desc: 'Daily task board, habits, priorities, and personal deliverables.',
      icon: Sparkles,
    },
    {
      title: 'Freelance Client Deliverables',
      badge: 'Client Work',
      desc: 'Client milestones, deliverables timeline, feedback rounds, and invoicing.',
      icon: Briefcase,
    },
    {
      title: 'Content & Portfolio Tracker',
      badge: 'Creative',
      desc: 'Publishing schedule, portfolio assets, drafts, and creative review.',
      icon: Rocket,
    },
  ];

  const currentDisplayStep = isIndividual ? (step === 1 ? 1 : 2) : step;
  const firstName = hasHydratedAuth && !isLoading
    ? user?.fullName?.trim().split(/\s+/)[0] || undefined
    : undefined;
  const templatesToDisplay = isIndividual ? INDIVIDUAL_TEMPLATES : COMPANY_TEMPLATES;
  const activeProfile = getWorkspaceProfile(selectedProfile);
  const profileTemplate = {
    title: activeProfile.starterProject,
    badge: 'Matched to your workspace',
    desc: activeProfile.starterDescription,
    icon: PROFILE_ICONS[activeProfile.id],
  };
  const starterTemplates = [
    profileTemplate,
    ...templatesToDisplay.filter((template) => template.title !== profileTemplate.title),
  ].slice(0, 3);

  return (
    <div className="theme-scope min-h-screen theme-bg-base flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8" style={{ color: 'var(--text-primary)' }}>
      {/* Top Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="flex justify-center mb-3">
          <ThemeAwareLogo size="lg" showWordmark />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
          {isIndividual ? 'Personal Workspace Setup' : 'Guided Workspace Setup'}
        </p>
      </div>

      {/* Main Wizard Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="rounded-3xl border p-6 sm:p-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-xl)' }}>
          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold theme-text-primary">
                Step {currentDisplayStep} of {totalSteps}:{' '}
                <span className="theme-text-muted font-normal">
                  {step === 1 && (isIndividual ? 'Personal Workspace & Theme' : 'Workspace Name & Theme')}
                  {step === 2 && 'Invite Team Members'}
                  {step === 3 && (isIndividual ? 'Select Starter Template' : 'Starter Project Roadmap')}
                </span>
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--accent-text)' }}>
                {Math.round((currentDisplayStep / totalSteps) * 100)}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-sunken)' }}>
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentDisplayStep / totalSteps) * 100}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>

          {/* ── STEP 1: Workspace & Branding ── */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h2 className="text-xl font-bold theme-text-primary">Welcome{firstName ? `, ${firstName}` : ''}!</h2>
                <p className="mt-1 text-xs theme-text-secondary">
                  {isIndividual
                    ? "Let's personalize your private workspace and color palette."
                    : "Let's configure your team's workspace name and visual branding."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider theme-text-secondary">
                  {isIndividual ? 'Personal Workspace Name' : 'Workspace Name'}
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    {isIndividual ? (
                      <Laptop className="h-4 w-4 theme-text-muted" />
                    ) : (
                      <Building2 className="h-4 w-4 theme-text-muted" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder={isIndividual ? "Maya's Workspace" : 'Apex Technologies'}
                    className="block w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                  What best describes your work?
                </label>
                <p className="mb-3 text-xs theme-text-muted">WorkGrind will tune the workspace style and starter project. You can change the theme any time.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {WORKSPACE_PROFILES.map((profile) => {
                    const Icon = PROFILE_ICONS[profile.id];
                    const isSelected = selectedProfile === profile.id;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => void handleProfileSelect(profile.id)}
                        disabled={profileSaving}
                        aria-pressed={isSelected}
                        className="flex min-h-[88px] items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-wait disabled:opacity-70"
                        style={{
                          borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                          background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                          boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'var(--shadow-xs)',
                        }}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: profile.swatches[2], color: ['developer', 'executive'].includes(profile.id) ? '#17211a' : '#ffffff' }}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold theme-text-primary">{profile.label}</span>
                          <span className="mt-1 block text-[10px] leading-relaxed theme-text-muted">{profile.description}</span>
                        </span>
                        <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2" style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border-strong)', background: isSelected ? 'var(--accent)' : 'transparent' }} />
                      </button>
                    );
                  })}
                </div>
                {profileSaving && <p role="status" className="mt-2 text-[11px] theme-text-muted">Saving your workspace style…</p>}
                {profileError && <p role="alert" className="mt-2 text-xs text-rose-600">{profileError}</p>}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={!workspaceName.trim() || profileSaving}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
                >
                  <span>{isIndividual ? 'Continue to Projects' : 'Continue to Invites'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Invite Team Members (COMPANY ONLY) ── */}
          {step === 2 && !isIndividual && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h2 className="text-xl font-bold theme-text-primary">Invite Your Teammates</h2>
                <p className="mt-1 text-xs theme-text-secondary">
                  WorkGrind is designed for collaboration. Invite colleagues now or skip this step.
                </p>
              </div>

              <div className="space-y-2.5">
                {inviteEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(idx, e.target.value)}
                      placeholder="colleague@company.com"
                      className="block w-full rounded-xl border py-2 px-3 text-xs focus:outline-none focus:ring-2"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                    {inviteEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(idx)}
                        className="p-2 theme-text-muted hover:text-rose-600 rounded-lg hover:bg-[var(--bg-hover)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddEmailRow}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:brightness-90"
                style={{ color: 'var(--accent-text)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add another email</span>
              </button>

              <div className="pt-4 flex items-center justify-between border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-semibold theme-text-muted hover:theme-text-primary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-xl border px-4 py-2 text-xs font-semibold theme-text-secondary hover:bg-[var(--bg-hover)]"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleSendInvitesAndNext}
                    disabled={isSendingInvites}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
                  >
                    <span>{isSendingInvites ? 'Sending...' : 'Invite & Continue'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Select Starter Project ── */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h2 className="text-xl font-bold theme-text-primary">
                  {isIndividual ? 'Pick Your Starter Project' : 'Create Your First Project'}
                </h2>
                <p className="mt-1 text-xs theme-text-secondary">
                  {isIndividual
                    ? 'Start with a structured template to organize your tasks, goals, and freelance work.'
                    : 'Projects keep your team organized with Kanban boards, deadlines, and milestones.'}
                </p>
              </div>

              <div className="space-y-3">
                  {starterTemplates.map((tpl) => {
                  const Icon = tpl.icon;
                  const isSelected = projectTemplate === tpl.title;

                  return (
                    <div
                      key={tpl.title}
                      onClick={() => setProjectTemplate(tpl.title)}
                      className="cursor-pointer rounded-2xl border p-4 transition-all flex items-start gap-3.5"
                      style={{
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                        background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                        boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'var(--shadow-xs)',
                      }}
                    >
                      <div
                        className="rounded-xl p-2.5 transition-colors"
                        style={{ background: isSelected ? 'var(--accent)' : 'var(--bg-sunken)', color: isSelected ? 'var(--text-on-accent)' : 'var(--text-secondary)' }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold theme-text-primary">{tpl.title}</h4>
                          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold theme-text-secondary" style={{ background: 'var(--bg-sunken)' }}>
                            {tpl.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-xs theme-text-secondary leading-relaxed">{tpl.desc}</p>
                      </div>
                      <div
                        className="h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-1"
                        style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border-strong)', background: isSelected ? 'var(--accent)' : 'transparent', color: 'var(--text-on-accent)' }}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setStep(isIndividual ? 1 : 2)}
                  className="inline-flex items-center gap-1 text-xs font-semibold theme-text-muted hover:theme-text-primary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={isCompleting}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold shadow-md transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--text-on-accent)', boxShadow: 'var(--shadow-md)' }}
                >
                  <span>{isCompleting ? 'Launching...' : 'Complete & Open Dashboard'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
