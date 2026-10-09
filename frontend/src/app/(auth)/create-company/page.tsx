'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAuthValue, updateAuthTokens } from '@/lib/authSession';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { CountrySelect } from '@/components/common/CountrySelect';
import {
  Building2,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Users,
  Briefcase,
  AlertCircle,
  Globe2,
  ShieldCheck,
  Laptop,
} from 'lucide-react';

export default function CreateCompanyPage() {
  const router = useRouter();
  const { user, setCompany, fetchCurrentUser } = useAuthStore();

  // Step 1: Account Type selection | Step 2: Workspace details
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<'company' | 'individual' | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [size, setSize] = useState('11-50');
  const [country, setCountry] = useState('Pakistan');
  const [timeZone, setTimeZone] = useState('UTC');
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');

  const handleSelectType = (type: 'company' | 'individual') => {
    setAccountType(type);
    setError('');
    if (type === 'individual') {
      setName(user?.fullName ? `${user.fullName}'s Workspace` : 'Personal Workspace');
      setIndustry('Freelance / Solo Work');
      setSize('1-10');
    } else {
      setName('');
      setIndustry('Technology');
      setSize('11-50');
    }
  };

  const handleContinueToDetails = () => {
    if (!accountType) {
      setError('Please select how you plan to use WorkGrind to continue.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isRedirecting) return;
    setError('');
    setIsLoading(true);
    const currentToken = getAuthValue('workgrind_access_token');

    try {
      const res = await api.post('/auth/create-company', {
        name,
        industry,
        size,
        country,
        timeZone,
        accountType: accountType || 'company',
      });

      if (res.data.success) {
        setIsRedirecting(true);
        if (res.data.accessToken && currentToken) {
          updateAuthTokens(res.data.accessToken, currentToken);
        }
        setCompany(res.data.company);
        if (res.data.user) {
          useAuthStore.getState().setUser(res.data.user);
        }
        router.push('/onboarding');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create workspace. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="theme-scope theme-bg-base flex min-h-screen flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Logo Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <ThemeAwareLogo size="lg" showWordmark={true} />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white px-6 py-8 sm:p-10 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/80 rounded-3xl">
          {/* Progress / Step Pill */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Step {step} of 2</span>
            </span>

            <span className="text-xs text-slate-400 font-medium">
              {step === 1 ? 'Select Account Experience' : 'Workspace Configuration'}
            </span>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl bg-rose-50 p-4 text-xs font-medium text-rose-700 ring-1 ring-rose-200 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 1: ACCOUNT TYPE SELECTION (Company vs Individual)
             ══════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  WorkGrind ko kis tarah use karna chahte hain?
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                  Choose the workspace experience tailored to your exact workflow.
                </p>
              </div>

              {/* Two Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option 1: Company / Team */}
                <div
                  onClick={() => handleSelectType('company')}
                  className={`group relative cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col justify-between ${
                    accountType === 'company'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
                          accountType === 'company'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                        }`}
                      >
                        <Building2 className="h-6 w-6" />
                      </div>

                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                          accountType === 'company'
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {accountType === 'company' && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>

                    <div className="mt-4">
                      <span className="inline-block rounded-md bg-indigo-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        Multi-User Collaboration
                      </span>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">
                        Company / Team
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Apni team ke sath collaborate karein — projects, tasks, aur communication ek jagah manage karein.
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-indigo-600" />
                      <span>Team channels & direct messaging</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-indigo-600" />
                      <span>Role permissions & team invites</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-indigo-600" />
                      <span>Shared project roadmaps & drive</span>
                    </li>
                  </ul>
                </div>

                {/* Option 2: Individual / Personal Use */}
                <div
                  onClick={() => handleSelectType('individual')}
                  className={`group relative cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col justify-between ${
                    accountType === 'individual'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
                          accountType === 'individual'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
                        }`}
                      >
                        <User className="h-6 w-6" />
                      </div>

                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                          accountType === 'individual'
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {accountType === 'individual' && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>

                    <div className="mt-4">
                      <span className="inline-block rounded-md bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Solo & Freelance
                      </span>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">
                        Individual / Personal Use
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Apna kaam akele organize karein — tasks aur projects track karein without any team complexity.
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Streamlined personal Kanban board</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Solo deadline tracking & calendar</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Switch to team workspace anytime in Settings</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Continue Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleContinueToDetails}
                  disabled={!accountType}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 2: WORKSPACE CONFIGURATION (Dynamic for Company/Solo)
             ══════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <form className="space-y-4 animate-in fade-in" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {accountType === 'individual'
                      ? 'Personal Workspace Setup'
                      : 'Set Up Your Company Workspace'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {accountType === 'individual'
                      ? 'Customize your solo environment for projects, tasks, and notes.'
                      : 'Create your digital headquarters for team collaboration.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Change Plan</span>
                </button>
              </div>

              {/* Workspace / Company Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {accountType === 'individual' ? 'Workspace Display Name' : 'Company / Organization Name'}
                </label>
                <div className="relative mt-1.5 rounded-xl shadow-2xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    {accountType === 'individual' ? (
                      <Laptop className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Building2 className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={accountType === 'individual' ? "Maya's Creative Workspace" : 'Apex Technologies'}
                    className="block w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 text-xs sm:leading-6 transition-all"
                  />
                </div>
              </div>

              {/* Industry / Work Focus */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {accountType === 'individual' ? 'Primary Focus' : 'Industry'}
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:ring-2 focus:ring-indigo-600 text-xs transition-all"
                  >
                    {accountType === 'individual' ? (
                      <>
                        <option value="Freelance / Solo Work">Freelance & Client Services</option>
                        <option value="Software Development">Software & Web Development</option>
                        <option value="Design & Creative">Design & Creative Media</option>
                        <option value="Content & Marketing">Content & Marketing</option>
                        <option value="Personal Productivity">Personal Productivity & Study</option>
                        <option value="Consulting">Strategy & Consulting</option>
                        <option value="Other">Other</option>
                      </>
                    ) : (
                      <>
                        <option value="Technology">Technology / SaaS</option>
                        <option value="Design & Creative">Design & Creative</option>
                        <option value="Marketing & Media">Marketing & Media</option>
                        <option value="Finance & Fintech">Finance & Fintech</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="E-commerce">E-commerce</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>

                {accountType === 'company' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Team Size
                    </label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:ring-2 focus:ring-indigo-600 text-xs transition-all"
                    >
                      <option value="1-10">1 - 10 employees</option>
                      <option value="11-50">11 - 50 employees</option>
                      <option value="51-200">51 - 200 employees</option>
                      <option value="201-500">201 - 500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Workspace Mode
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Solo Mode (Can add team later)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Country & Timezone */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Country
                  </label>
                  <CountrySelect
                    value={country}
                    onChange={(val) => setCountry(val)}
                    placeholder="Select country (e.g. Pakistan, India, USA)"
                    disabled={isLoading || isRedirecting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Time Zone
                  </label>
                  <select
                    value={timeZone}
                    disabled={isLoading || isRedirecting}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:ring-2 focus:ring-indigo-600 text-xs transition-all disabled:opacity-60"
                  >
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                    <option value="America/New_York">Eastern Time (EST)</option>
                    <option value="America/Chicago">Central Time (CST)</option>
                    <option value="America/Denver">Mountain Time (MST)</option>
                    <option value="America/Los_Angeles">Pacific Time (PST)</option>
                    <option value="Europe/London">London (GMT+1)</option>
                    <option value="Europe/Paris">Berlin / Paris (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isLoading || isRedirecting}
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={isLoading || isRedirecting || !name.trim()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRedirecting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Workspace ready! Loading...</span>
                    </>
                  ) : isLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Creating workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
