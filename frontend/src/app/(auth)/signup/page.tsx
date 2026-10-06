'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (fullName.trim().length > 100) {
      setError('Your name must be 100 characters or fewer.');
      return;
    }
    const phoneNumber = parsePhoneNumberFromString(phone.trim());
    if (!phoneNumber?.isValid()) {
      setError('Enter a valid mobile number with its international country code, for example +1 415 555 2671.');
      return;
    }
    if (password !== confirm) {
      setError('Your passwords do not match.');
      return;
    }
    if (!checks.every(Boolean)) {
      setError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', { fullName: fullName.trim(), email: email.trim(), phone: phoneNumber.number, password });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'We could not start your signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-step"><b>01&nbsp; DETAILS</b><i /><span>02&nbsp; VERIFY EMAIL</span><i /><span>03&nbsp; WORKSPACE</span></div>
      <h1 className="auth-form-title">Start with a clear slate.</h1>
      <p className="auth-form-subtitle">Create your account. We’ll send a one-time code before your workspace is activated.</p>

      <SocialAuthButtons className="mt-5" />
      <div className="my-5 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />or create with email<span className="h-px flex-1 bg-stone-200" />
      </div>

      {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-name">Your name</label>
          <div className="auth-input-wrap">
            <UserRound size={16} className="auth-icon" />
            <input id="signup-name" className="auth-input" type="text" required maxLength={100}
              autoComplete="name" placeholder="Jordan Lee" value={fullName}
              onChange={(event) => setFullName(event.target.value)} />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-email">Work email</label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-icon" />
            <input id="signup-email" className="auth-input" type="email" required autoComplete="email"
              placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-phone">Mobile number</label>
          <div className="auth-input-wrap">
            <input id="signup-phone" className="auth-input !pl-4" type="tel" required inputMode="tel"
              autoComplete="tel" placeholder="+1 415 555 2671" value={phone}
              aria-describedby="signup-phone-help"
              onChange={(event) => setPhone(event.target.value)} />
          </div>
          <p id="signup-phone-help" className="mt-1.5 text-[10px] leading-relaxed text-stone-500">
            Include your country code. We’ll text a one-time verification code.
          </p>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-password">Password</label>
          <div className="auth-password-wrap auth-input-wrap">
            <Lock size={16} className="auth-icon" />
            <input id="signup-password" className="auth-input" type={showPassword ? 'text' : 'password'}
              required autoComplete="new-password" placeholder="Create a strong password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && <div className="auth-strength" aria-label={`Password strength ${strength} out of 4`}>
            {checks.map((met, index) => <i key={index} data-on={met} />)}
            <span>{strength <= 1 ? 'Needs work' : strength < 4 ? 'Getting stronger' : 'Strong'}</span>
          </div>}
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-confirm">Confirm password</label>
          <div className="auth-password-wrap auth-input-wrap">
            <Lock size={16} className="auth-icon" />
            <input id="signup-confirm" className="auth-input" type={showConfirmPassword ? 'text' : 'password'} required
              autoComplete="new-password" placeholder="Enter it once more" value={confirm}
              onChange={(event) => setConfirm(event.target.value)} />
            <button type="button" className="auth-password-toggle" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirmPassword((visible) => !visible)}>
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button className="auth-primary" type="submit" disabled={loading}>
          {loading ? 'Sending verification code…' : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>

      <p className="mt-7 text-center text-xs text-stone-500">
        Already have an account? <Link href="/login" className="auth-link">Sign in</Link>
      </p>
      <p className="mt-5 text-center text-[10px] leading-relaxed text-stone-400">
        By continuing, you agree to WorkGrind’s terms and privacy policy.
      </p>
    </AuthShell>
  );
}
