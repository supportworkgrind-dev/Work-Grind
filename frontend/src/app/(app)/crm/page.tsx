'use client';

import { useState, useEffect, useCallback } from 'react';
import { Company360Drawer } from '@/components/crm/Company360Drawer';
import { api } from '@/lib/api';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { StatCard } from '@/components/common/StatCard';
import { PageSkeleton } from '@/components/common/LoadingSkeleton';
import {
  CrmContact, CrmCompany, CrmDeal, CrmPipelineStats, DealStage, ContactStatus,
} from '@/types';
import {
  Building2, Users, TrendingUp, Plus, Search, X, ChevronDown,
  Phone, Mail, Globe, MapPin, Briefcase, Tag, DollarSign,
  CheckCircle2, Circle, Target, AlertCircle, Edit2, Trash2,
  BarChart2, Star, ArrowRight, Loader2,
} from 'lucide-react';
import { formatDate, getInitials } from '@/lib/utils';

// ─── constants ────────────────────────────────────────────────────────────────

const DEAL_STAGES: { key: DealStage; label: string; color: string; bg: string }[] = [
  { key: 'new_lead',     label: 'New Lead',     color: 'text-slate-600',   bg: 'bg-slate-100'   },
  { key: 'qualified',    label: 'Qualified',    color: 'text-blue-600',    bg: 'bg-blue-50'     },
  { key: 'proposal',     label: 'Proposal',     color: 'text-violet-600',  bg: 'bg-violet-50'   },
  { key: 'negotiation',  label: 'Negotiation',  color: 'text-amber-600',   bg: 'bg-amber-50'    },
  { key: 'won',          label: 'Won',          color: 'text-emerald-700', bg: 'bg-emerald-50'  },
  { key: 'lost',         label: 'Lost',         color: 'text-rose-600',    bg: 'bg-rose-50'     },
];

const CONTACT_STATUSES: { key: ContactStatus; label: string; color: string }[] = [
  { key: 'lead',      label: 'Lead',      color: 'badge-slate'   },
  { key: 'prospect',  label: 'Prospect',  color: 'badge-blue'    },
  { key: 'customer',  label: 'Customer',  color: 'badge-emerald' },
  { key: 'churned',   label: 'Churned',   color: 'badge-rose'    },
  { key: 'inactive',  label: 'Inactive',  color: 'badge-amber'   },
];

const stageStyle = (key: DealStage) =>
  DEAL_STAGES.find((s) => s.key === key) ?? DEAL_STAGES[0];

const statusStyle = (key: ContactStatus) =>
  CONTACT_STATUSES.find((s) => s.key === key) ?? CONTACT_STATUSES[0];

function formatCurrency(value?: number, currency = 'USD') {
  if (!value) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

// ─── modal types ──────────────────────────────────────────────────────────────

type ModalType =
  | { type: 'contact'; data?: CrmContact }
  | { type: 'company'; data?: CrmCompany }
  | { type: 'deal';    data?: CrmDeal    }
  | null;

// ─── sub-components ───────────────────────────────────────────────────────────

/** Pill tabs */
function Tabs({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
      {(['contacts', 'companies', 'pipeline'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-150
            ${active === tab ? 'shadow-sm' : 'hover:bg-[var(--bg-hover)]'}`}
          style={
            active === tab
              ? { background: 'var(--accent)', color: 'var(--text-on-accent)' }
              : { color: 'var(--text-secondary)' }
          }
        >
          {tab === 'contacts'  && <Users      className="h-3.5 w-3.5" />}
          {tab === 'companies' && <Building2  className="h-3.5 w-3.5" />}
          {tab === 'pipeline'  && <TrendingUp className="h-3.5 w-3.5" />}
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}

/** Generic text input */
function Field({ label, name, value, onChange, type = 'text', required, placeholder }: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="input-field h-9 text-sm"
      />
    </div>
  );
}

// ─── Contact Modal ─────────────────────────────────────────────────────────────

function ContactModal({
  initial,
  companies,
  onClose,
  onSaved,
}: {
  initial?: CrmContact;
  companies: CrmCompany[];
  onClose: () => void;
  onSaved: (c: CrmContact) => void;
}) {
  const [form, setForm] = useState({
    firstName:    initial?.firstName    ?? '',
    lastName:     initial?.lastName     ?? '',
    email:        initial?.email        ?? '',
    phone:        initial?.phone        ?? '',
    jobTitle:     initial?.jobTitle     ?? '',
    department:   initial?.department   ?? '',
    crmCompanyId: typeof initial?.crmCompanyId === 'object' ? (initial?.crmCompanyId as any)?._id ?? '' : initial?.crmCompanyId ?? '',
    status:       initial?.status       ?? 'lead',
    notes:        initial?.notes        ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form, crmCompanyId: form.crmCompanyId || undefined };
      const res = initial
        ? await api.patch(`/crm/contacts/${initial._id}`, payload)
        : await api.post('/crm/contacts', payload);
      onSaved(res.data.contact);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Something went wrong');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={initial ? 'Edit Contact' : 'New Contact'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" name="firstName" value={form.firstName} onChange={change} required />
          <Field label="Last name"  name="lastName"  value={form.lastName}  onChange={change} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" value={form.email} onChange={change} type="email" />
          <Field label="Phone" name="phone" value={form.phone} onChange={change} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Job title"  name="jobTitle"   value={form.jobTitle}   onChange={change} />
          <Field label="Department" name="department" value={form.department} onChange={change} />
        </div>
        {/* Company select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Company</label>
          <select name="crmCompanyId" value={form.crmCompanyId} onChange={change} className="input-field h-9 text-sm">
            <option value="">— None —</option>
            {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</label>
          <select name="status" value={form.status} onChange={change} className="input-field h-9 text-sm">
            {CONTACT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Notes</label>
          <textarea name="notes" value={form.notes} onChange={change} rows={3}
            className="input-field text-sm resize-none" placeholder="Add a note…" />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary h-9 px-4">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-9 px-5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {initial ? 'Save changes' : 'Create contact'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Company Modal ─────────────────────────────────────────────────────────────

function CompanyModal({
  initial, onClose, onSaved,
}: { initial?: CrmCompany; onClose: () => void; onSaved: (c: CrmCompany) => void }) {
  const [form, setForm] = useState({
    name:          initial?.name          ?? '',
    domain:        initial?.domain        ?? '',
    website:       initial?.website       ?? '',
    industry:      initial?.industry      ?? '',
    employeeCount: initial?.employeeCount?.toString() ?? '',
    country:       initial?.country       ?? '',
    city:          initial?.city          ?? '',
    phone:         initial?.phone         ?? '',
    notes:         initial?.notes         ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        employeeCount: form.employeeCount ? parseInt(form.employeeCount) : undefined,
      };
      const res = initial
        ? await api.patch(`/crm/companies/${initial._id}`, payload)
        : await api.post('/crm/companies', payload);
      onSaved(res.data.company);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Something went wrong');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={initial ? 'Edit Company' : 'New Company'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company name" name="name"   value={form.name}   onChange={change} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Domain"  name="domain"  value={form.domain}  onChange={change} placeholder="acme.com" />
          <Field label="Website" name="website" value={form.website} onChange={change} placeholder="https://…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Industry"   name="industry"      value={form.industry}      onChange={change} />
          <Field label="Employees"  name="employeeCount" value={form.employeeCount} onChange={change} type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country" name="country" value={form.country} onChange={change} />
          <Field label="City"    name="city"    value={form.city}    onChange={change} />
        </div>
        <Field label="Phone" name="phone" value={form.phone} onChange={change} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Notes</label>
          <textarea name="notes" value={form.notes} onChange={change} rows={3}
            className="input-field text-sm resize-none" placeholder="Add a note…" />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary h-9 px-4">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-9 px-5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {initial ? 'Save changes' : 'Create company'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Deal Modal ────────────────────────────────────────────────────────────────

function DealModal({
  initial, contacts, crmCompanies, onClose, onSaved,
}: {
  initial?: CrmDeal;
  contacts: CrmContact[];
  crmCompanies: CrmCompany[];
  onClose: () => void;
  onSaved: (d: CrmDeal) => void;
}) {
  const [form, setForm] = useState({
    title:        initial?.title        ?? '',
    value:        initial?.value?.toString() ?? '',
    stage:        initial?.stage        ?? 'new_lead',
    priority:     initial?.priority     ?? 'medium',
    contactId:    typeof initial?.contactId    === 'object' ? (initial?.contactId as any)?._id ?? '' : initial?.contactId ?? '',
    crmCompanyId: typeof initial?.crmCompanyId === 'object' ? (initial?.crmCompanyId as any)?._id ?? '' : initial?.crmCompanyId ?? '',
    closeDate:    initial?.closeDate    ? initial.closeDate.slice(0, 10) : '',
    description:  initial?.description  ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        value:        form.value     ? parseFloat(form.value) : undefined,
        contactId:    form.contactId    || undefined,
        crmCompanyId: form.crmCompanyId || undefined,
        closeDate:    form.closeDate    || undefined,
      };
      const res = initial
        ? await api.patch(`/crm/deals/${initial._id}`, payload)
        : await api.post('/crm/deals', payload);
      onSaved(res.data.deal);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Something went wrong');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={initial ? 'Edit Deal' : 'New Deal'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Deal title" name="title" value={form.title} onChange={change} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Value ($)" name="value" value={form.value} onChange={change} type="number" placeholder="0" />
          <Field label="Close date" name="closeDate" value={form.closeDate} onChange={change} type="date" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Stage */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Stage</label>
            <select name="stage" value={form.stage} onChange={change} className="input-field h-9 text-sm">
              {DEAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Priority</label>
            <select name="priority" value={form.priority} onChange={change} className="input-field h-9 text-sm">
              {['low', 'medium', 'high', 'urgent'].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Contact */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contact</label>
          <select name="contactId" value={form.contactId} onChange={change} className="input-field h-9 text-sm">
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
        {/* CRM Company */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Company</label>
          <select name="crmCompanyId" value={form.crmCompanyId} onChange={change} className="input-field h-9 text-sm">
            <option value="">— None —</option>
            {crmCompanies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea name="description" value={form.description} onChange={change} rows={3}
            className="input-field text-sm resize-none" placeholder="Deal notes…" />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary h-9 px-4">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-9 px-5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {initial ? 'Save changes' : 'Create deal'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Contacts tab ─────────────────────────────────────────────────────────────

function ContactsTab({
  contacts, companies, loading, search, onSearch, onNew, onEdit, onDelete,
}: {
  contacts: CrmContact[]; companies: CrmCompany[]; loading: boolean;
  search: string; onSearch: (s: string) => void;
  onNew: () => void; onEdit: (c: CrmContact) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search} onChange={(e) => onSearch(e.target.value)}
            placeholder="Search contacts…"
            className="input-field h-9 pl-9 text-sm w-full"
          />
          {search && (
            <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        <button onClick={onNew} className="btn-primary h-9 px-4 shrink-0">
          <Plus className="h-3.5 w-3.5" /><span>Add contact</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : contacts.length === 0 ? (
        <EmptyState icon={Users} title="No contacts yet" description="Add your first contact to start building your CRM."
          actionLabel="Add contact" onAction={onNew} />
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          {/* header row */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b text-[11px] font-bold uppercase tracking-wider"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>Contact</span><span>Company</span><span>Status</span><span>Added</span><span />
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {contacts.map((c) => {
              const co = typeof c.crmCompanyId === 'object' ? c.crmCompanyId : null;
              const ss = statusStyle(c.status);
              return (
                <div key={c._id}
                  className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
                  {/* contact */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={`${c.firstName} ${c.lastName}`} src={c.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {c.email || c.phone || c.jobTitle || '—'}
                      </p>
                    </div>
                  </div>
                  {/* company */}
                  <p className="text-[12px] truncate hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                    {co ? (co as any).name : '—'}
                  </p>
                  {/* status */}
                  <div className="hidden sm:block">
                    <span className={`badge ${ss.color}`}>{ss.label}</span>
                  </div>
                  {/* date */}
                  <p className="text-[11px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(c.createdAt, 'MMM d, yyyy')}
                  </p>
                  {/* actions */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(c)} className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="Edit">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onDelete(c._id)} className="btn-ghost h-7 w-7 p-0 rounded-lg text-rose-500 hover:bg-rose-50"
                      aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Companies tab ────────────────────────────────────────────────────────────

function CompaniesTab({
  companies, loading, search, onSearch, onNew, onEdit, onDelete, onOpen,
}: {
  companies: CrmCompany[]; loading: boolean;
  search: string; onSearch: (s: string) => void;
  onNew: () => void; onEdit: (c: CrmCompany) => void; onDelete: (id: string) => void;
  onOpen: (company: CrmCompany) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search} onChange={(e) => onSearch(e.target.value)}
            placeholder="Search companies…"
            className="input-field h-9 pl-9 text-sm w-full"
          />
          {search && (
            <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        <button onClick={onNew} className="btn-primary h-9 px-4 shrink-0">
          <Plus className="h-3.5 w-3.5" /><span>Add company</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : companies.length === 0 ? (
        <EmptyState icon={Building2} title="No companies yet" description="Add companies to organise your contacts and deals."
          actionLabel="Add company" onAction={onNew} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((co) => (
            <div key={co._id}
              className="surface rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-all duration-150"
              style={{ border: '1px solid var(--border-color)' }}>
              <div className="flex items-start justify-between gap-2">
                {/* logo / initials */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
                    {co.logoUrl
                      ? <img src={co.logoUrl} alt={co.name} className="h-full w-full object-cover" />
                      : getInitials(co.name)
                    }
                  </div>
                  <div>
                    <button type="button" onClick={() => onOpen(co)} className="text-left text-[13px] font-bold hover:underline" style={{ color: 'var(--text-primary)' }}>{co.name}</button>
                    {co.domain && (
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{co.domain}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(co)} className="btn-ghost h-7 w-7 p-0 rounded-lg" aria-label="Edit">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(co._id)} className="btn-ghost h-7 w-7 p-0 rounded-lg text-rose-500 hover:bg-rose-50"
                    aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {co.industry    && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{co.industry}</span>}
                {co.city        && <span className="flex items-center gap-1"><MapPin    className="h-3 w-3" />{co.city}{co.country ? `, ${co.country}` : ''}</span>}
                {co.employeeCount && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{co.employeeCount.toLocaleString()} emp.</span>}
              </div>

              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {co.contactCount ?? 0} contact{(co.contactCount ?? 0) !== 1 ? 's' : ''}
                </span>
                {co.website && (
                  <a href={co.website} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-medium flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--accent)' }}>
                    <Globe className="h-3 w-3" />Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline tab ─────────────────────────────────────────────────────────────

function PipelineTab({
  deals, loading, onNew, onEdit, onDelete,
}: {
  deals: CrmDeal[]; loading: boolean;
  onNew: () => void; onEdit: (d: CrmDeal) => void; onDelete: (id: string) => void;
}) {
  // Group deals by stage
  const grouped = DEAL_STAGES.reduce<Record<DealStage, CrmDeal[]>>((acc, s) => {
    acc[s.key] = deals.filter((d) => d.stage === s.key);
    return acc;
  }, {} as Record<DealStage, CrmDeal[]>);

  const totalValue = deals
    .filter((d) => d.stage !== 'lost')
    .reduce((s, d) => s + (d.value ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length} open deals ·{' '}
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(totalValue)} pipeline
            </span>
          </p>
        </div>
        <button onClick={onNew} className="btn-primary h-9 px-4 shrink-0">
          <Plus className="h-3.5 w-3.5" /><span>Add deal</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : deals.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No deals yet" description="Add your first deal to start tracking your sales pipeline."
          actionLabel="Add deal" onAction={onNew} />
      ) : (
        /* Kanban board — horizontally scrollable */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {DEAL_STAGES.map((stage) => {
              const stageDealsList = grouped[stage.key];
              const stageValue = stageDealsList.reduce((s, d) => s + (d.value ?? 0), 0);

              return (
                <div key={stage.key}
                  className="flex flex-col gap-3 w-64 flex-shrink-0 rounded-2xl p-3"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
                  {/* Column header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                      <span className="text-[10px] rounded-full px-2 py-0.5 font-bold"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                        {stageDealsList.length}
                      </span>
                    </div>
                    {stageValue > 0 && (
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(stageValue)}
                      </span>
                    )}
                  </div>

                  {/* Deal cards */}
                  <div className="flex flex-col gap-2">
                    {stageDealsList.map((deal) => {
                      const contact    = typeof deal.contactId    === 'object' ? deal.contactId    as any : null;
                      const dealCompany = typeof deal.crmCompanyId === 'object' ? deal.crmCompanyId as any : null;
                      return (
                        <div key={deal._id}
                          className="rounded-xl p-3.5 flex flex-col gap-2.5 shadow-xs hover:shadow-sm transition-shadow"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-[12px] font-semibold leading-snug flex-1"
                              style={{ color: 'var(--text-primary)' }}>{deal.title}</p>
                            <div className="flex gap-0.5 shrink-0">
                              <button onClick={() => onEdit(deal)} className="btn-ghost h-5 w-5 p-0 rounded" aria-label="Edit">
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button onClick={() => onDelete(deal._id)}
                                className="btn-ghost h-5 w-5 p-0 rounded text-rose-400 hover:bg-rose-50" aria-label="Delete">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {deal.value != null && (
                            <p className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>
                              {formatCurrency(deal.value, deal.currency)}
                            </p>
                          )}

                          {/* Contact / Company row */}
                          {(contact || dealCompany) && (
                            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {contact && (
                                <span className="flex items-center gap-1 truncate">
                                  <Users className="h-3 w-3 shrink-0" />
                                  {contact.firstName} {contact.lastName}
                                </span>
                              )}
                              {dealCompany && (
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {dealCompany.name}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Priority + close date footer */}
                          <div className="flex items-center justify-between pt-1.5 border-t"
                            style={{ borderColor: 'var(--border-subtle)' }}>
                            <span className={`badge ${
                              deal.priority === 'urgent' ? 'badge-rose' :
                              deal.priority === 'high'   ? 'badge-amber' :
                              deal.priority === 'medium' ? 'badge-blue' : 'badge-slate'
                            }`}>{deal.priority}</span>
                            {deal.closeDate && (
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {formatDate(deal.closeDate, 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {stageDealsList.length === 0 && (
                      <div className="text-center py-6 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        No deals
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CrmPage() {
  const [tab,          setTab]         = useState<'contacts' | 'companies' | 'pipeline'>('contacts');
  const [contacts,     setContacts]    = useState<CrmContact[]>([]);
  const [companies,    setCompanies]   = useState<CrmCompany[]>([]);
  const [deals,        setDeals]       = useState<CrmDeal[]>([]);
  const [stats,        setStats]       = useState<CrmPipelineStats | null>(null);
  const [loadingMain,  setLoadingMain] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [modal,        setModal]       = useState<ModalType>(null);
  const [selectedCompany, setSelectedCompany] = useState<CrmCompany | null>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoadingMain(true);
    try {
      const [cRes, coRes, dRes, sRes] = await Promise.all([
        api.get('/crm/contacts?limit=200'),
        api.get('/crm/companies?limit=200'),
        api.get('/crm/deals?limit=200'),
        api.get('/crm/stats'),
      ]);
      if (cRes.data.success)  setContacts(cRes.data.contacts);
      if (coRes.data.success) setCompanies(coRes.data.companies);
      if (dRes.data.success)  setDeals(dRes.data.deals);
      if (sRes.data.success)  setStats(sRes.data.stats);
    } catch { /* silent */ }
    finally { setLoadingMain(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── search filters ─────────────────────────────────────────────────────────

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.jobTitle?.toLowerCase().includes(q)
    );
  });

  const filteredCompanies = companies.filter((c) => {
    if (!companySearch) return true;
    const q = companySearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.domain?.toLowerCase().includes(q);
  });

  // ── delete helpers ─────────────────────────────────────────────────────────

  const deleteContact = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await api.delete(`/crm/contacts/${id}`);
      setContacts((p) => p.filter((c) => c._id !== id));
    } catch { alert('Failed to delete contact.'); }
  };

  const deleteCompany = async (id: string) => {
    if (!confirm('Delete this company?')) return;
    try {
      await api.delete(`/crm/companies/${id}`);
      setCompanies((p) => p.filter((c) => c._id !== id));
    } catch { alert('Failed to delete company.'); }
  };

  const deleteDeal = async (id: string) => {
    if (!confirm('Delete this deal?')) return;
    try {
      await api.delete(`/crm/deals/${id}`);
      setDeals((p) => p.filter((d) => d._id !== id));
    } catch { alert('Failed to delete deal.'); }
  };

  // ── saved handlers ─────────────────────────────────────────────────────────

  const onContactSaved = (c: CrmContact) => {
    setContacts((p) => {
      const idx = p.findIndex((x) => x._id === c._id);
      return idx >= 0 ? p.map((x) => x._id === c._id ? c : x) : [c, ...p];
    });
    setModal(null);
    fetchAll(); // re-fetch stats
  };

  const onCompanySaved = (co: CrmCompany) => {
    setCompanies((p) => {
      const idx = p.findIndex((x) => x._id === co._id);
      return idx >= 0 ? p.map((x) => x._id === co._id ? co : x) : [co, ...p];
    });
    setModal(null);
    fetchAll();
  };

  const onDealSaved = (d: CrmDeal) => {
    setDeals((p) => {
      const idx = p.findIndex((x) => x._id === d._id);
      return idx >= 0 ? p.map((x) => x._id === d._id ? d : x) : [d, ...p];
    });
    setModal(null);
    fetchAll();
  };

  if (loadingMain) return <PageSkeleton />;

  return (
    <div className="space-y-6 pb-8">

      {/* ═══ HEADER ═══ */}
      <div className="page-hero-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--accent)' }}>CRM</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Customer Relationships
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Contacts, companies, and your sales pipeline — all in one place.
          </p>
        </div>
        <Tabs active={tab} onChange={(t) => setTab(t as any)} />
      </div>

      {/* ═══ STAT STRIP ═══ */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <StatCard label="Contacts"       value={stats.contactCount}        sub="Total contacts"    icon={Users}       iconBg="bg-blue-50"    iconColor="text-blue-600"    />
          <StatCard label="Companies"      value={stats.companyCount}        sub="Total companies"   icon={Building2}   iconBg="bg-violet-50"  iconColor="text-violet-600"  />
          <StatCard label="Open Deals"     value={stats.openDeals}           sub="Active pipeline"   icon={TrendingUp}  iconBg="bg-amber-50"   iconColor="text-amber-600"   />
          <StatCard label="Pipeline Value"
            value={formatCurrency(stats.totalPipelineValue)}
            sub={`${stats.wonDeals} deals won`}
            icon={DollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
        </div>
      )}

      {/* ═══ TAB CONTENT ═══ */}
      {tab === 'contacts' && (
        <ContactsTab
          contacts={filteredContacts}
          companies={companies}
          loading={false}
          search={contactSearch}
          onSearch={setContactSearch}
          onNew={() => setModal({ type: 'contact' })}
          onEdit={(c) => setModal({ type: 'contact', data: c })}
          onDelete={deleteContact}
        />
      )}

      {tab === 'companies' && (
        <CompaniesTab
          companies={filteredCompanies}
          loading={false}
          search={companySearch}
          onSearch={setCompanySearch}
          onNew={() => setModal({ type: 'company' })}
          onEdit={(c) => setModal({ type: 'company', data: c })}
          onDelete={deleteCompany}
          onOpen={setSelectedCompany}
        />
      )}

      {tab === 'pipeline' && (
        <PipelineTab
          deals={deals}
          loading={false}
          onNew={() => setModal({ type: 'deal' })}
          onEdit={(d) => setModal({ type: 'deal', data: d })}
          onDelete={deleteDeal}
        />
      )}

      {/* ═══ MODALS ═══ */}
      {modal?.type === 'contact' && (
        <ContactModal
          initial={modal.data}
          companies={companies}
          onClose={() => setModal(null)}
          onSaved={onContactSaved}
        />
      )}
      {modal?.type === 'company' && (
        <CompanyModal
          initial={modal.data}
          onClose={() => setModal(null)}
          onSaved={onCompanySaved}
        />
      )}
      {modal?.type === 'deal' && (
        <DealModal
          initial={modal.data}
          contacts={contacts}
          crmCompanies={companies}
          onClose={() => setModal(null)}
          onSaved={onDealSaved}
        />
      )}
      {selectedCompany && <Company360Drawer key={selectedCompany._id} company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
    </div>
  );
}
