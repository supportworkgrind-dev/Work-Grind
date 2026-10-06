'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertCircle, BookOpen, Check, Code2, Copy, ExternalLink, Eye, KeyRound, LoaderCircle, Plus, RotateCw, Trash2, Webhook } from 'lucide-react';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { getApiBaseUrl } from '@/lib/apiConfig';
import { useAuthStore } from '@/store/useAuthStore';

type ApiKey = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt?: string | null; rotatedAt?: string | null; revokedAt?: string | null };
type RequestLog = { id: string; keyName: string; method: string; path: string; statusCode: number; durationMs: number; createdAt: string };
type Webhook = { _id: string; name: string; url: string; events: string[]; isEnabled: boolean; deliveryStatus: 'not_configured'; createdAt: string };

const RESOURCES = ['contacts', 'companies', 'deals', 'projects', 'tasks', 'team'] as const;
const API_BASE = getApiBaseUrl();

function copySecretWithSelection(secret: string) {
  const field = document.createElement('textarea');
  field.value = secret;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  field.style.top = '0';
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, field.value.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(field);
  if (!copied) throw new Error('Clipboard copy was not available.');
}

export default function DeveloperPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const allowed = ['owner', 'admin'].includes(user?.role || '');
  const [tab, setTab] = useState<'keys' | 'webhooks' | 'logs'>('keys');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState('');
  const [keyName, setKeyName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['contacts:read']);
  const [newSecret, setNewSecret] = useState('');
  const [secretLabel, setSecretLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<number | null>(null);
  const [workingId, setWorkingId] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', events: 'contact.created, task.created' });
  const [webhookSaving, setWebhookSaving] = useState(false);

  useEffect(() => () => {
    if (copiedTimeout.current !== null) window.clearTimeout(copiedTimeout.current);
  }, []);

  const load = useEffectEvent(async () => {
    setLoading(true);
    setError('');
    try {
      const [keyResponse, webhookResponse, logResponse] = await Promise.all([
        api.get('/developer/keys'), api.get('/developer/webhooks'), api.get('/developer/logs?limit=50'),
      ]);
      setKeys(keyResponse.data.data || []);
      setWebhooks(webhookResponse.data.data || []);
      setLogs(logResponse.data.data || []);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Developer settings could not be loaded.'));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [allowed, reloadTick]);

  useEffect(() => {
    if (user && !allowed) router.replace('/dashboard');
  }, [allowed, router, user]);

  function toggleScope(scope: string) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setError('');
    discardKeyReveal();
    setWorkingId('new-key');
    try {
      const response = await api.post('/developer/keys', { name: keyName, scopes });
      if (typeof response.data.secret !== 'string' || !response.data.secret) {
        setError('The API key was created, but its one-time secret was not returned. Rotate the key to reveal a new secret.');
        return;
      }
      setNewSecret(response.data.secret);
      setSecretLabel(response.data.data.name);
      setKeyName('');
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'API key could not be created.'));
    } finally {
      setWorkingId('');
    }
  }

  async function rotateKey(key: ApiKey) {
    if (!window.confirm(`Rotate “${key.name}”? The current key will stop working immediately.`)) return;
    setWorkingId(key.id);
    setError('');
    discardKeyReveal();
    try {
      const response = await api.post(`/developer/keys/${key.id}/rotate`);
      if (typeof response.data.secret !== 'string' || !response.data.secret) {
        setError('The key was rotated, but its one-time secret was not returned. Rotate the key again to reveal a new secret.');
        return;
      }
      setNewSecret(response.data.secret);
      setSecretLabel(key.name);
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'API key could not be rotated.'));
    } finally {
      setWorkingId('');
    }
  }

  async function revokeKey(key: ApiKey) {
    if (!window.confirm(`Revoke “${key.name}”? This action cannot be undone.`)) return;
    setWorkingId(key.id);
    setError('');
    try {
      await api.delete(`/developer/keys/${key.id}`);
      if (newSecret && secretLabel === key.name) setNewSecret('');
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'API key could not be revoked.'));
    } finally {
      setWorkingId('');
    }
  }

  async function copySecret() {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(newSecret);
        } catch {
          copySecretWithSelection(newSecret);
        }
      } else {
        copySecretWithSelection(newSecret);
      }
      setCopied(true);
      if (copiedTimeout.current !== null) window.clearTimeout(copiedTimeout.current);
      copiedTimeout.current = window.setTimeout(() => {
        setCopied(false);
        copiedTimeout.current = null;
      }, 1800);
    } catch {
      setError('Clipboard access was denied. Select and copy the key manually.');
    }
  }

  function clearCopiedConfirmation() {
    setCopied(false);
    if (copiedTimeout.current !== null) {
      window.clearTimeout(copiedTimeout.current);
      copiedTimeout.current = null;
    }
  }

  function discardKeyReveal() {
    setNewSecret('');
    setTestResult('');
    clearCopiedConfirmation();
  }

  async function testRequest() {
    setTestLoading(true);
    setTestResult('');
    try {
      const response = await fetch(`${API_BASE}/v1/contacts?limit=5`, { headers: { Authorization: `Bearer ${newSecret}` } });
      const body = await response.json();
      setTestResult(JSON.stringify({ status: response.status, body }, null, 2));
    } catch {
      setTestResult('The API request could not reach the configured API host. Check your frontend API URL and backend availability.');
    } finally {
      setTestLoading(false);
    }
  }

  async function createWebhook(event: FormEvent) {
    event.preventDefault();
    setWebhookSaving(true);
    setError('');
    try {
      await api.post('/developer/webhooks', {
        name: webhookForm.name,
        url: webhookForm.url,
        events: webhookForm.events.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setWebhookForm({ name: '', url: '', events: '' });
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Webhook configuration could not be saved.'));
    } finally {
      setWebhookSaving(false);
    }
  }

  async function updateWebhook(webhook: Webhook, isEnabled: boolean) {
    setWorkingId(webhook._id);
    try {
      await api.patch(`/developer/webhooks/${webhook._id}`, { isEnabled });
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Webhook configuration could not be updated.'));
    } finally {
      setWorkingId('');
    }
  }

  async function deleteWebhook(webhook: Webhook) {
    if (!window.confirm(`Delete webhook configuration “${webhook.name}”?`)) return;
    setWorkingId(webhook._id);
    try {
      await api.delete(`/developer/webhooks/${webhook._id}`);
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Webhook configuration could not be deleted.'));
    } finally {
      setWorkingId('');
    }
  }

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Workspace tools</p><h1 className="mt-1 text-2xl font-bold theme-text-primary sm:text-3xl">WorkGrind Connect</h1><p className="mt-2 max-w-2xl text-sm theme-text-secondary">Manage scoped API credentials and prepare secure connections from your own website or application.</p></div>
        <Link href="/developer/docs" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border theme-border px-4 text-sm font-semibold theme-text-primary hover:theme-bg-hover"><BookOpen className="h-4 w-4" />API documentation<ExternalLink className="h-3.5 w-3.5" /></Link>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1.2fr]" aria-label="Connect API request flow">
        {[
          { label: 'External website or app', icon: Code2 },
          { label: 'WorkGrind API key', icon: KeyRound },
          { label: 'Contacts · Companies · Deals · Projects · Tasks · Team', icon: Activity },
        ].map(({ label, icon: Icon }, index) => <div key={label} className="flex min-h-20 items-center gap-3 rounded-xl border theme-border theme-bg-card p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><Icon className="h-4 w-4" /></span><span className="text-sm font-semibold theme-text-primary">{label}</span>{index < 2 && <span className="ml-auto hidden text-[var(--accent)] lg:block">→</span>}</div>)}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Info title="Secret displayed once" text="Keys are generated randomly, stored as SHA-256 hashes, and never returned again after creation or rotation." />
        <Info title="Workspace isolated" text="Each request is constrained to the company that owns its API key. Linked records are validated in that same workspace." />
        <Info title="120 requests per minute" text="Per-key rate limits are enforced and exposed through response headers. Request logs omit credentials and query values." />
      </section>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}<button className="ml-auto underline" onClick={() => setReloadTick((tick) => tick + 1)}>Retry</button></div>}

      <div className="flex gap-1 overflow-x-auto border-b theme-border" role="tablist" aria-label="Developer tools">
        {([['keys', 'API Keys', KeyRound], ['webhooks', 'Webhooks', Webhook], ['logs', 'Request logs', Activity]] as const).map(([value, label, Icon]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === value ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent theme-text-muted'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm theme-text-muted"><LoaderCircle className="h-4 w-4 animate-spin" />Loading developer settings</div> : <>
        {tab === 'keys' && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="overflow-hidden rounded-xl border theme-border theme-bg-card">
            <div className="border-b theme-border p-4"><h2 className="font-bold theme-text-primary">API keys</h2><p className="mt-1 text-xs theme-text-muted">Only the prefix is retained for identification; raw secrets are never stored.</p></div>
            {keys.length === 0 ? <Empty icon={KeyRound} title="No API keys yet" text="Create a scoped key to connect an external website or application." /> : <ul className="divide-y theme-border">{keys.map((key) => <li key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold theme-text-primary">{key.name}</p><code className="text-xs theme-text-muted">{key.prefix}</code>{key.revokedAt && <span className="rounded border border-rose-500/30 px-1.5 py-0.5 text-[10px] text-rose-600">Revoked</span>}</div><p className="mt-1 text-xs theme-text-muted">Created {new Date(key.createdAt).toLocaleString()} · Last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</p><p className="mt-1 break-words text-xs theme-text-secondary">{key.scopes.join(' · ')}</p></div><div className="flex shrink-0 items-center gap-2">{!key.revokedAt && <><button disabled={workingId === key.id} onClick={() => void rotateKey(key)} title="Rotate API key" className="flex h-9 w-9 items-center justify-center rounded-lg border theme-border theme-text-secondary disabled:opacity-50"><RotateCw className="h-4 w-4" /></button><button disabled={workingId === key.id} onClick={() => void revokeKey(key)} title="Revoke API key" className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 text-rose-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></>}</div></li>)}</ul>}
          </section>
          <div className="space-y-5">
            <form onSubmit={createKey} className="space-y-4 rounded-xl border theme-border theme-bg-card p-4">
              <div><h2 className="font-bold theme-text-primary">Create API key</h2><p className="mt-1 text-xs theme-text-muted">Grant only the scopes the external app needs.</p></div>
              <label className="block text-xs font-medium theme-text-secondary">Key name<input required maxLength={80} value={keyName} onChange={(event) => setKeyName(event.target.value)} className={inputClass} placeholder="Production website" /></label>
              <div className="space-y-2">{RESOURCES.map((resource) => <div key={resource} className="grid grid-cols-[1fr_72px_80px] items-center gap-2 border-b theme-border pb-2"><span className="text-sm capitalize theme-text-primary">{resource}</span>{(['read', 'write'] as const).map((permission) => { const scope = `${resource}:${permission}`; return resource === 'team' && permission === 'write' ? <span key={scope} className="text-[10px] theme-text-muted">Read only</span> : <label key={scope} className="flex items-center gap-2 text-xs theme-text-secondary"><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="h-4 w-4 accent-[var(--accent)]" />{permission}</label>; })}</div>)}</div>
              <button disabled={workingId === 'new-key' || scopes.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50">{workingId === 'new-key' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create key</button>
            </form>
            {newSecret && <section className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" aria-live="polite"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold theme-text-primary">Copy your new key · {secretLabel}</h2><p className="mt-1 text-xs text-amber-700">This secret is shown only once. Copy and save it now; hiding this message or refreshing will permanently discard it.</p></div><button aria-label="Hide secret" onClick={discardKeyReveal} className="min-h-10 px-2 text-xs font-semibold theme-text-muted">Hide</button></div><div className="flex flex-col gap-2 sm:flex-row"><input readOnly aria-label="New API secret" value={newSecret} className={`${inputClass} min-w-0 font-mono`} /><button type="button" onClick={() => void copySecret()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border theme-border px-4 text-sm font-semibold theme-text-primary hover:theme-bg-hover sm:min-w-36">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy API Key'}</button></div><button disabled={testLoading} onClick={() => void testRequest()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border theme-border px-3 text-xs font-semibold theme-text-primary disabled:opacity-50">{testLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Test GET /contacts</button>{testResult && <pre className="max-h-64 overflow-auto rounded-lg bg-black/5 p-3 text-xs theme-text-primary"><code>{testResult}</code></pre>}</section>}
          </div>
        </div>}

        {tab === 'webhooks' && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="overflow-hidden rounded-xl border theme-border theme-bg-card"><div className="border-b theme-border p-4"><h2 className="font-bold theme-text-primary">Webhook configurations</h2><p className="mt-1 text-xs theme-text-muted">Stored per workspace. External event delivery is not enabled.</p></div>{webhooks.length === 0 ? <Empty icon={Webhook} title="No webhook configurations" text="Add an HTTPS endpoint and event labels for later delivery setup." /> : <ul className="divide-y theme-border">{webhooks.map((webhook) => <li key={webhook._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold theme-text-primary">{webhook.name}</p><p className="mt-1 break-all text-xs theme-text-secondary">{webhook.url}</p><p className="mt-1 break-words text-xs theme-text-muted">Events: {webhook.events.join(', ') || 'None'}</p><span className="mt-2 inline-flex border border-amber-500/30 px-2 py-1 text-[10px] text-amber-700">Delivery not configured</span></div><div className="flex gap-2"><button onClick={() => void updateWebhook(webhook, !webhook.isEnabled)} className="min-h-9 rounded-lg border theme-border px-3 text-xs font-semibold theme-text-primary">{webhook.isEnabled ? 'Disable' : 'Enable'}</button><button onClick={() => void deleteWebhook(webhook)} aria-label="Delete webhook configuration" className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 text-rose-600"><Trash2 className="h-4 w-4" /></button></div></li>)}</ul>}</section>
          <form onSubmit={createWebhook} className="space-y-4 rounded-xl border theme-border theme-bg-card p-4"><div><h2 className="font-bold theme-text-primary">Add webhook endpoint</h2><p className="mt-1 text-xs theme-text-muted">HTTPS is required. Saving does not send events.</p></div><label className="block text-xs font-medium theme-text-secondary">Name<input required maxLength={80} value={webhookForm.name} onChange={(event) => setWebhookForm({ ...webhookForm, name: event.target.value })} className={inputClass} /></label><label className="block text-xs font-medium theme-text-secondary">Endpoint URL<input required type="url" value={webhookForm.url} onChange={(event) => setWebhookForm({ ...webhookForm, url: event.target.value })} className={inputClass} placeholder="https://example.com/workgrind-events" /></label><label className="block text-xs font-medium theme-text-secondary">Event labels, comma separated<input required value={webhookForm.events} onChange={(event) => setWebhookForm({ ...webhookForm, events: event.target.value })} className={inputClass} placeholder="contact.created, task.created" /></label><button disabled={webhookSaving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50">{webhookSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Save configuration</button></form>
        </div>}

        {tab === 'logs' && <section className="overflow-hidden rounded-xl border theme-border theme-bg-card"><div className="border-b theme-border p-4"><h2 className="font-bold theme-text-primary">Recent API requests</h2><p className="mt-1 text-xs theme-text-muted">Up to 50 recent requests. No raw keys or query-string values are recorded.</p></div>{logs.length === 0 ? <Empty icon={Activity} title="No API activity yet" text="Requests made with a valid key will appear here." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="theme-text-muted"><tr className="border-b theme-border"><th className="p-3 font-semibold">Time</th><th className="p-3 font-semibold">Key</th><th className="p-3 font-semibold">Request</th><th className="p-3 font-semibold">Status</th><th className="p-3 text-right font-semibold">Duration</th></tr></thead><tbody className="divide-y theme-border">{logs.map((log) => <tr key={log.id} className="theme-text-secondary"><td className="whitespace-nowrap p-3">{new Date(log.createdAt).toLocaleString()}</td><td className="p-3">{log.keyName}</td><td className="p-3"><code>{log.method} /api/v1/{log.path}</code></td><td className="p-3">{log.statusCode}</td><td className="p-3 text-right">{log.durationMs} ms</td></tr>)}</tbody></table></div>}</section>}
      </>}
    </div>
  );
}

const inputClass = 'mt-1.5 min-h-10 w-full rounded-lg border theme-border theme-bg-base px-3 py-2 text-sm theme-text-primary outline-none focus:border-[var(--accent)]';

function Info({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border theme-border theme-bg-card p-4"><h2 className="text-sm font-bold theme-text-primary">{title}</h2><p className="mt-1.5 text-xs leading-relaxed theme-text-secondary">{text}</p></div>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof KeyRound; title: string; text: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center"><Icon className="h-6 w-6 theme-text-muted" /><p className="mt-3 text-sm font-semibold theme-text-primary">{title}</p><p className="mt-1 max-w-sm text-xs theme-text-muted">{text}</p></div>;
}
