'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Smartphone,
  Copy,
  Check,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';

interface MfaStatus {
  mfaEnabled: boolean;
  verifiedAt?: string;
  remainingRecoveryCodes: number;
}

export default function AdminSecurityPage() {
  const [status, setStatus] = useState<MfaStatus>({
    mfaEnabled: false,
    remainingRecoveryCodes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Setup Modal State
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'codes'>('qr');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [hasCopiedKey, setHasCopiedKey] = useState(false);
  const [hasCopiedCodes, setHasCopiedCodes] = useState(false);

  // Regenerate Codes Modal State
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [isSubmittingRegen, setIsSubmittingRegen] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [showRegenSuccessCodes, setShowRegenSuccessCodes] = useState(false);

  // Disable Modal State
  const [isDisableOpen, setIsDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isSubmittingDisable, setIsSubmittingDisable] = useState(false);
  const [disableError, setDisableError] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.get('/mfa/status');
      if (res.data.success) {
        setStatus({
          mfaEnabled: Boolean(res.data.mfaEnabled),
          verifiedAt: res.data.verifiedAt,
          remainingRecoveryCodes: res.data.remainingRecoveryCodes || 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to load MFA status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Start MFA Setup Flow
  const handleStartSetup = async () => {
    setSetupError('');
    setVerifyCode('');
    setIsSubmittingSetup(true);
    try {
      const res = await adminApi.post('/mfa/setup');
      if (res.data.success) {
        setQrCodeUrl(res.data.qrCodeUrl);
        setManualKey(res.data.manualKey);
        setSetupStep('qr');
        setIsSetupOpen(true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to initialize MFA setup', 'error');
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // Verify and Enable MFA
  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    setIsSubmittingSetup(true);
    setSetupError('');

    try {
      const res = await adminApi.post('/mfa/enable', {
        code: verifyCode.trim(),
      });

      if (res.data.success) {
        setRecoveryCodes(res.data.recoveryCodes || []);
        setSetupStep('codes');
        setStatus((prev) => ({
          ...prev,
          mfaEnabled: true,
          verifiedAt: new Date().toISOString(),
          remainingRecoveryCodes: res.data.recoveryCodes?.length || 8,
        }));
        showToast('Two-Factor Authentication successfully enabled!');
      }
    } catch (err: any) {
      setSetupError(
        err.response?.data?.message ||
          'Invalid verification code. Please check your Authenticator app and try again.'
      );
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // Regenerate Recovery Codes
  const handleRegenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenPassword) return;

    setIsSubmittingRegen(true);
    setRegenError('');

    try {
      const res = await adminApi.post('/mfa/regenerate-recovery-codes', {
        password: regenPassword,
        code: regenCode.trim() || undefined,
      });

      if (res.data.success) {
        setRecoveryCodes(res.data.recoveryCodes || []);
        setShowRegenSuccessCodes(true);
        setStatus((prev) => ({
          ...prev,
          remainingRecoveryCodes: res.data.recoveryCodes?.length || 8,
        }));
        showToast('New recovery codes generated. Previous codes invalidated.');
      }
    } catch (err: any) {
      setRegenError(
        err.response?.data?.message || 'Failed to regenerate codes. Check your password.'
      );
    } finally {
      setIsSubmittingRegen(false);
    }
  };

  // Disable MFA
  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) return;

    setIsSubmittingDisable(true);
    setDisableError('');

    try {
      const res = await adminApi.post('/mfa/disable', {
        password: disablePassword,
        code: disableCode.trim() || undefined,
      });

      if (res.data.success) {
        setIsDisableOpen(false);
        setDisablePassword('');
        setDisableCode('');
        setStatus({
          mfaEnabled: false,
          remainingRecoveryCodes: 0,
        });
        showToast('Two-Factor Authentication has been disabled.');
      }
    } catch (err: any) {
      setDisableError(
        err.response?.data?.message || 'Failed to disable MFA. Check your password and code.'
      );
    } finally {
      setIsSubmittingDisable(false);
    }
  };

  // Download recovery codes as text file
  const downloadCodesFile = () => {
    const text = [
      'WORKGRIND PLATFORM SUPER ADMIN RECOVERY CODES',
      '=============================================',
      'Generated: ' + new Date().toLocaleString(),
      '',
      'Keep these one-time codes in a secure, encrypted location.',
      'Each code can only be used once if you lose access to your Authenticator app.',
      '',
      ...recoveryCodes.map((c, i) => `${i + 1}. ${c}`),
      '',
      '=============================================',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workgrind-superadmin-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCodesToClipboard = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setHasCopiedCodes(true);
    setTimeout(() => setHasCopiedCodes(false), 2500);
  };

  const copyKeyToClipboard = () => {
    navigator.clipboard.writeText(manualKey);
    setHasCopiedKey(true);
    setTimeout(() => setHasCopiedKey(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/90 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Security & Authentication
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage multi-factor authentication (MFA) and master platform security credentials
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 self-start cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main MFA Card */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                status.mfaEnabled
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              {status.mfaEnabled ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white">Authenticator App</h2>
                {status.mfaEnabled ? (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Enabled
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    Not Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                {status.mfaEnabled
                  ? 'Your account is protected with a dynamic 6-digit verification code generated by your Authenticator app.'
                  : 'Protect your admin account with a 6-digit verification code from Google Authenticator, Microsoft Authenticator, Authy, or 1Password.'}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="shrink-0">
            {status.mfaEnabled ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRegenPassword('');
                    setRegenCode('');
                    setRegenError('');
                    setShowRegenSuccessCodes(false);
                    setIsRegenerateOpen(true);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Regenerate Recovery Codes
                </button>
                <button
                  onClick={() => {
                    setDisablePassword('');
                    setDisableCode('');
                    setDisableError('');
                    setIsDisableOpen(true);
                  }}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  Disable MFA
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartSetup}
                disabled={isSubmittingSetup}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmittingSetup ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Preparing Setup...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Set Up Authenticator</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Enabled Details Box */}
        {status.mfaEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                MFA Configuration Date
              </span>
              <p className="text-xs font-semibold text-slate-200">
                {status.verifiedAt
                  ? new Date(status.verifiedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Active'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                One-Time Recovery Codes
              </span>
              <p className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <span>{status.remainingRecoveryCodes} codes remaining</span>
                {status.remainingRecoveryCodes <= 2 && (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                    Low
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Informative Guidance */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-400" />
            <span>Supported Authenticator Apps</span>
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            WorkGrind uses standard RFC 6238 Time-based One-Time Passwords (TOTP). You can use any
            compatible mobile application:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {['Google Authenticator', 'Microsoft Authenticator', 'Authy by Twilio', '1Password / Bitwarden'].map(
              (app) => (
                <div
                  key={app}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-2.5 text-center text-[11px] font-medium text-slate-300"
                >
                  {app}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: MFA SETUP FLOW ── */}
      {isSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {setupStep === 'qr' ? 'Set Up Authenticator App' : 'Save Recovery Codes'}
                </h3>
              </div>
              {setupStep === 'qr' && (
                <button
                  onClick={() => setIsSetupOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {setupStep === 'qr' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 font-medium">
                    1. Scan this QR code with your Authenticator app (Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app):
                  </p>

                  {/* QR Code Container */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white max-w-[240px] mx-auto shadow-md">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="TOTP MFA QR Code"
                        className="w-48 h-48 rounded-lg"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Key Fallback */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">
                    Cannot scan QR code? Enter this manual setup key in your app:
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center text-xs font-mono font-bold text-indigo-300 tracking-wider select-all">
                      {manualKey}
                    </code>
                    <button
                      type="button"
                      onClick={copyKeyToClipboard}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {hasCopiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{hasCopiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Verification Code Input */}
                <form onSubmit={handleVerifySetup} className="space-y-4 pt-2">
                  {setupError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <span>{setupError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      2. Enter the 6-digit code from your app to verify:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="000000"
                      className="w-full rounded-xl border border-indigo-500/50 bg-slate-950 p-3 text-center text-lg font-mono font-bold tracking-widest text-white placeholder:text-slate-600 focus:border-indigo-400 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSetupOpen(false)}
                      className="rounded-xl border border-slate-800 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSetup || verifyCode.trim().length !== 6}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmittingSetup ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Verify & Enable 2FA</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Step 2: Display Recovery Codes */
              <div className="space-y-5 animate-in fade-in">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Important: Save these one-time recovery codes
                  </p>
                  <p className="text-amber-200/90 leading-relaxed text-[11px]">
                    If you lose access to your phone or authenticator app, these codes are the only way to recover access to your administrative account. Each code can only be used once.
                  </p>
                </div>

                {/* Codes Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-4 rounded-2xl border border-slate-800 bg-slate-950 font-mono text-sm font-bold text-indigo-300 text-center select-all">
                  {recoveryCodes.map((c, i) => (
                    <div key={i} className="py-1.5 px-3 rounded-lg bg-slate-900/80 border border-slate-800/60">
                      {c}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyCodesToClipboard}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {hasCopiedCodes ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{hasCopiedCodes ? 'Copied' : 'Copy All'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadCodesFile}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download .txt</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSetupOpen(false)}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer shadow-md shadow-emerald-600/30"
                  >
                    I Have Saved My Codes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: REGENERATE RECOVERY CODES ── */}
      {isRegenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Regenerate Recovery Codes</h3>
              <button
                onClick={() => setIsRegenerateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!showRegenSuccessCodes ? (
              <form onSubmit={handleRegenerateCodes} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generating new recovery codes will invalidate all previous codes immediately. Please confirm your administrator password to proceed.
                </p>

                {regenError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{regenError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={regenPassword}
                    onChange={(e) => setRegenPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Authenticator Code <span className="text-slate-500 lowercase font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={regenCode}
                    onChange={(e) => setRegenCode(e.target.value)}
                    placeholder="000000"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegenerateOpen(false)}
                    className="rounded-xl border border-slate-800 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRegen || !regenPassword}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmittingRegen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>Generate New Codes</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Success View */
              <div className="space-y-4 animate-in fade-in">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>8 new recovery codes generated! Previous codes are now invalid.</span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl border border-slate-800 bg-slate-950 font-mono text-xs font-bold text-indigo-300 text-center select-all">
                  {recoveryCodes.map((c, i) => (
                    <div key={i} className="py-1 px-2 rounded bg-slate-900 border border-slate-800/60">
                      {c}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={copyCodesToClipboard}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    {hasCopiedCodes ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{hasCopiedCodes ? 'Copied' : 'Copy Codes'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegenerateOpen(false)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DISABLE MFA ── */}
      {isDisableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Disable Two-Factor Authentication</h3>
              <button
                onClick={() => setIsDisableOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDisableMfa} className="space-y-4">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>
                  Warning: Disabling MFA reduces the security of your Super Admin account.
                </span>
              </div>

              {disableError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {disableError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Admin Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current Authenticator Code <span className="text-slate-500 lowercase font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisableOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDisable || !disablePassword}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingDisable ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Confirm & Disable MFA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}