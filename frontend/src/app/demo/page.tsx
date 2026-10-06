'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { useI18n } from '@/lib/i18n';
import { Video, CheckCircle2, ArrowLeft, Send, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function DemoPage() {
  const { t } = useI18n();
  const [submitted, setSubmitted]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [form, setForm]               = useState({ name: '', email: '', company: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null);
    try {
      let res;
      try { res = await api.post('/demo', form); }
      catch { res = await api.post('/contact', { ...form, type: 'demo', subject: `Demo Request from ${form.name}` }); }
      if (res.data?.success) { setSubmitted(true); }
      else { setError(res.data?.message || t('common.errorGeneric')); }
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.errorGeneric'));
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      <PublicNavbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />{t('common.backToHome')}
        </Link>

        {/* Hero */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
            <Video className="h-3.5 w-3.5" />{t('demo.badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{t('demo.headline')}</h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">{t('demo.subheadline')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 shadow-sm">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t('demo.success.heading')}</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t('demo.success.sub', { email: form.email })}
              </p>
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/" className="w-full sm:w-auto rounded-xl bg-indigo-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-indigo-500 transition-all text-center">
                  {t('demo.success.home')}
                </Link>
                <button type="button"
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', company: '', message: '' }); }}
                  className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white text-slate-700 px-6 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-all">
                  {t('demo.success.another')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('demo.form.name')} <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={t('demo.form.namePH')}
                  className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('demo.form.email')} <span className="text-rose-500">*</span>
                </label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder={t('demo.form.emailPH')}
                  className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('demo.form.company')} <span className="text-slate-400 font-normal normal-case">({t('common.optional')})</span>
                </label>
                <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                  placeholder={t('demo.form.companyPH')}
                  className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('demo.form.message')} <span className="text-slate-400 font-normal normal-case">({t('common.optional')})</span>
                </label>
                <textarea rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder={t('demo.form.messagePH')}
                  className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all resize-none" />
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{t('demo.form.submitting')}</>
                  : <><Send className="h-4 w-4" />{t('demo.form.submit')}</>}
              </button>
            </form>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
