'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles, X } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';

export type WorkspaceSubscriptionSummary = {
  status: string;
  plan: string;
  hasActiveAccess: boolean;
  accessSource: 'lifetime' | 'manual_grant' | 'billing' | 'trial' | 'none';
  expiresAt: string | null;
};

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  school: 'WorkGrind School',
  college: 'WorkGrind College',
  university: 'WorkGrind University',
  free: 'Remove manual access',
};

const SOURCE_LABEL: Record<WorkspaceSubscriptionSummary['accessSource'], string> = {
  lifetime: 'lifetime access',
  manual_grant: 'granted by an administrator',
  billing: 'paid subscription',
  trial: 'free trial',
  none: 'no access',
};

export function describeWorkspaceSubscription(summary: WorkspaceSubscriptionSummary): string {
  if (!summary.hasActiveAccess) return `No active access (${summary.status.replace(/_/g, ' ')})`;
  const until = summary.expiresAt ? ` until ${new Date(summary.expiresAt).toLocaleDateString()}` : '';
  return `${PLAN_LABEL[summary.plan] ?? summary.plan} · ${SOURCE_LABEL[summary.accessSource]}${until}`;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

/**
 * Grants or removes administrator-managed access for one workspace. Plans come
 * from the server for this workspace type; the result shown is the effective
 * subscription the server returns after saving, which members will see too.
 */
export function SubscriptionGrantDialog({
  workspaceId,
  workspaceName,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
  onSaved: (summary: WorkspaceSubscriptionSummary) => void;
}) {
  const [plans, setPlans] = useState<string[] | null>(null);
  const [current, setCurrent] = useState<WorkspaceSubscriptionSummary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState<WorkspaceSubscriptionSummary | null>(null);
  // Earliest selectable expiry (computed once; the server re-validates it).
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    adminApi.get(`/workspaces/${workspaceId}/plans`)
      .then((res) => {
        if (!active) return;
        const available: string[] = res.data.plans ?? [];
        setPlans(available);
        setCurrent(res.data.subscription ?? null);
        setPlan(available.find((option) => option !== 'free') ?? 'free');
      })
      .catch((error) => { if (active) setLoadError(errorMessage(error, 'Plans for this workspace could not be loaded.')); });
    return () => { active = false; };
  }, [workspaceId]);


  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await adminApi.patch(`/workspaces/${workspaceId}/plan`, {
        plan,
        ...(plan !== 'free' && expiresOn ? { expiresAt: new Date(`${expiresOn}T23:59:59`).toISOString() } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!res.data.success || !res.data.subscription) throw new Error(res.data.message);
      setSaved(res.data.subscription);
      setCurrent(res.data.subscription);
      onSaved(res.data.subscription);
    } catch (error) {
      setSaveError(errorMessage(error, 'The subscription could not be updated.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div role="dialog" aria-labelledby="grant-dialog-title" className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 id="grant-dialog-title" className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>Workspace subscription</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          <strong className="text-white">{workspaceName}</strong>
          {current && <> — currently: <span className="text-slate-200">{describeWorkspaceSubscription(current)}</span></>}
        </p>

        {loadError ? (
          <p role="alert" className="flex items-center gap-2 text-xs text-rose-400"><AlertCircle className="h-4 w-4" />{loadError}</p>
        ) : !plans ? (
          <p className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading plans…</p>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="sr-only">Plan</legend>
              {plans.map((option) => (
                <label
                  key={option}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer text-xs font-bold transition-all ${
                    plan === option ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <input type="radio" name="grant-plan" checked={plan === option} onChange={() => setPlan(option)} className="h-4 w-4 text-indigo-600" />
                  {PLAN_LABEL[option] ?? option}
                </label>
              ))}
            </fieldset>
            {plan === 'free' ? (
              <p className="text-[11px] text-slate-400">Removes access granted here. A paid Polar subscription is not changed; manage it in Polar.</p>
            ) : (
              <label className="block text-[11px] font-semibold text-slate-400">
                Access until (optional)
                <input type="date" min={tomorrow} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
                <span className="mt-1 block font-normal text-slate-500">Leave empty for access until an administrator removes it.</span>
              </label>
            )}
            <label className="block text-[11px] font-semibold text-slate-400">
              Reason (recorded in the audit log)
              <input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Pilot programme, support credit"
                className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
          </>
        )}

        {saveError && <p role="alert" className="flex items-center gap-2 text-xs text-rose-400"><AlertCircle className="h-4 w-4" />{saveError}</p>}
        {saved && (
          <p role="status" className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />Saved. Members now see: {describeWorkspaceSubscription(saved)}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800">
            {saved ? 'Done' : 'Cancel'}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !plans || !plan}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
