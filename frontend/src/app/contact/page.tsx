'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { useI18n } from '@/lib/i18n';
import { Send, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function ContactPage() {
  const { t } = useI18n();
  const [submitted, setSubmitted]     = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: 'Sales Inquiry', message: '' });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('subject') === 'Technical Support') {
      setForm((current) => ({ ...current, subject: 'Technical Support' }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null);
    try {
      const res = await api.post('/contact', form);
      if (res.data?.success) {
        setSubmittedMessage(res.data.message || 'Your message was recorded.');
        setSubmitted(true);
      }
      else { setError(res.data?.message || t('common.errorGeneric')); }
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.errorGeneric'));
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      <PublicNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />{t('common.backToHome')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left — info */}
          <div className="lg:col-span-5 space-y-7">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
                {t('contact.badge')}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{t('contact.headline')}</h1>
              <p className="mt-3 text-slate-600 text-sm leading-relaxed">{t('contact.sub')}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Send a request</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Use the form to send a message to the WorkGrind team. Avoid including passwords, access tokens, or full payment-card details.
              </p>
            </div>
          </div>

          {/* Right — form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 shadow-sm">
              {submitted ? (
                <div className="text-center py-10 space-y-4">
                  <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">{t('contact.success.heading')}</h2>
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">{submittedMessage}</p>
                  <button onClick={() => setSubmitted(false)}
                    className="mt-4 rounded-xl bg-slate-100 px-6 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all">
                    {t('contact.success.another')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">{t('contact.form.heading')}</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('contact.form.name')}</label>
                      <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder={t('contact.form.namePH')}
                        className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('contact.form.email')}</label>
                      <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder={t('contact.form.emailPH')}
                        className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('contact.form.company')}</label>
                      <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                        placeholder={t('contact.form.companyPH')}
                        className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('contact.form.subject')}</label>
                      <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                        className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all">
                        <option value="Sales Inquiry">{t('contact.form.subjects.sales')}</option>
                        <option value="Technical Support">{t('contact.form.subjects.support')}</option>
                        <option value="Partnership">{t('contact.form.subjects.partner')}</option>
                        <option value="General Question">{t('contact.form.subjects.general')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('contact.form.message')}</label>
                    <textarea rows={5} required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                      placeholder={t('contact.form.messagePH')}
                      className="w-full rounded-xl border-0 py-3 px-4 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white outline-none transition-all resize-none" />
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                  )}

                  <button type="submit" disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                    {isSubmitting
                      ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('contact.form.submitting')}</>
                      : <><Send className="h-4 w-4" />{t('contact.form.submit')}</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
