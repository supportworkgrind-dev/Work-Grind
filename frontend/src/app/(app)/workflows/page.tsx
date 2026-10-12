'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonLine } from '@/components/common/LoadingSkeleton';
import {
  Zap, Plus, Play, Pause, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock, Activity, AlertCircle, Settings,
  Edit, FlaskConical,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';

const TRIGGER_LABELS: Record<string, string> = {
  deal_created: 'When a deal is created',
  deal_updated: 'When a deal is updated',
  deal_stage_changed: 'When a deal stage changes',
  contact_created: 'When a contact is created',
  task_created: 'When a task is created',
  task_completed: 'When a task is completed',
  task_overdue: 'When a task becomes overdue',
  project_status_changed: 'When a project status changes',
  meeting_ended: 'When a meeting ends',
  file_uploaded: 'When a file is uploaded',
};

const ACTION_LABELS: Record<string, string> = {
  create_task:           'Create a task',
  send_notification:     'Send a notification',
  send_channel_message:  'Send a channel message',
  ai_analysis:           'Run AI analysis',
  ai_summary:            'Generate Tavro AI summary',
};

const TRIGGER_OPTIONS  = Object.entries(TRIGGER_LABELS);
const ACTION_OPTIONS   = Object.entries(ACTION_LABELS);

interface Workflow {
  _id: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  trigger: { type: string };
  conditions: any[];
  actions: Array<{ type: string; config: Record<string, any> }>;
  runCount: number;
  failCount: number;
  lastRunAt?: string;
  creatorId?: { fullName: string };
}

interface WorkflowExecution {
  triggeredAt: string;
  success: boolean;
  error?: string;
  actionsRun: Array<{ type: string; success: boolean; error?: string }>;
}

// ── Create/Edit modal ─────────────────────────────────────────────────────────
function WorkflowFormModal({ existing, onClose, onSave }: {
  existing?: Workflow | null;
  onClose: () => void;
  onSave: (wf: Workflow) => void;
}) {
  const [name, setName]         = useState(existing?.name ?? '');
  const [description, setDesc]  = useState(existing?.description ?? '');
  const [triggerType, setTrigger] = useState(existing?.trigger.type ?? '');
  const [actions, setActions]   = useState<Array<{ type: string; config: Record<string,any> }>>(
    existing?.actions ?? [{ type: '', config: {} }]
  );
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  function addAction() {
    setActions(a => [...a, { type: '', config: {} }]);
  }
  function removeAction(i: number) {
    setActions(a => a.filter((_,idx) => idx !== i));
  }
  function updateAction(i: number, type: string) {
    setActions(a => a.map((ac, idx) => idx === i ? { ...ac, type } : ac));
  }
  function updateActionConfig(i: number, key: string, value: string) {
    setActions(a => a.map((ac, idx) => idx === i ? { ...ac, config: { ...ac.config, [key]: value } } : ac));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !triggerType || !actions.some(a => a.type)) {
      setError('Name, trigger, and at least one action are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), description: description.trim(), trigger: { type: triggerType }, conditions: [], actions };
      const r = existing
        ? await api.patch(`/workflows/${existing._id}`, payload)
        : await api.post('/workflows', payload);
      onSave(r.data.workflow);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save workflow');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-xl rounded-3xl border shadow-float p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold theme-text-primary">{existing ? 'Edit Workflow' : 'New Workflow'}</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0 rounded-lg">✕</button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Workflow Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New deal follow-up" className="input-premium w-full" required />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input value={description} onChange={e => setDesc(e.target.value)} placeholder="Optional description" className="input-premium w-full" />
          </div>

          <div>
            <label className="form-label">Trigger *</label>
            <select value={triggerType} onChange={e => setTrigger(e.target.value)} className="input-premium w-full" required>
              <option value="">Select a trigger…</option>
              {TRIGGER_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="form-label mb-0">Actions *</label>
              <button type="button" onClick={addAction} className="btn-ghost h-7 px-2 text-xs">+ Add Action</button>
            </div>
            {actions.map((action, i) => (
              <div key={i} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                <div className="flex items-center gap-2">
                  <select
                    value={action.type}
                    onChange={e => updateAction(i, e.target.value)}
                    className="input-premium flex-1 text-sm"
                  >
                    <option value="">Select action…</option>
                    {ACTION_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {actions.length > 1 && (
                    <button type="button" onClick={() => removeAction(i)} className="btn-ghost h-8 w-8 p-0 rounded-lg text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {action.type === 'create_task' && (
                  <input
                    placeholder="Task title"
                    value={action.config.title ?? ''}
                    onChange={e => updateActionConfig(i, 'title', e.target.value)}
                    className="input-premium w-full text-sm"
                  />
                )}
                {action.type === 'send_notification' && (
                  <>
                    <input placeholder="Notification title" value={action.config.title ?? ''} onChange={e => updateActionConfig(i, 'title', e.target.value)} className="input-premium w-full text-sm" />
                    <input placeholder="Notification body" value={action.config.body ?? ''} onChange={e => updateActionConfig(i, 'body', e.target.value)} className="input-premium w-full text-sm" />
                  </>
                )}
                {action.type === 'send_channel_message' && (
                  <>
                    <input placeholder="Channel ID" value={action.config.channelId ?? ''} onChange={e => updateActionConfig(i, 'channelId', e.target.value)} className="input-premium w-full text-sm" />
                    <input placeholder="Message" value={action.config.message ?? ''} onChange={e => updateActionConfig(i, 'message', e.target.value)} className="input-premium w-full text-sm" />
                  </>
                )}
                {(action.type === 'ai_analysis' || action.type === 'ai_summary') && (
                  <input placeholder="Custom AI prompt (optional)" value={action.config.prompt ?? ''} onChange={e => updateActionConfig(i, 'prompt', e.target.value)} className="input-premium w-full text-sm" />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 h-10">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 h-10">
              {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Execution history panel ───────────────────────────────────────────────────
function ExecutionHistory({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const [execs, setExecs] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/workflows/${workflowId}/executions`)
      .then(r => setExecs(r.data.executions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workflowId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-3xl border shadow-float p-6 max-h-[80vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold theme-text-primary flex items-center gap-2">
            <Activity className="h-4 w-4" /> Execution History
          </h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0 rounded-lg">✕</button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i=><SkeletonLine key={i} className="h-16 rounded-xl" />)}</div>
        ) : execs.length === 0 ? (
          <p className="text-sm theme-text-muted text-center py-8">No executions yet. Test or wait for a trigger.</p>
        ) : (
          <div className="space-y-3">
            {execs.map((ex, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ex.success
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <XCircle      className="h-4 w-4 text-rose-500" />
                    }
                    <span className="text-xs font-semibold theme-text-primary">{ex.success ? 'Success' : 'Failed'}</span>
                  </div>
                  <span className="text-[10px] theme-text-muted">{formatTimeAgo(ex.triggeredAt)}</span>
                </div>
                {ex.error && <p className="text-[11px] text-rose-600 mt-1 ml-6">{ex.error}</p>}
                <div className="flex flex-wrap gap-2 mt-2 ml-6">
                  {ex.actionsRun.map((a, j) => (
                    <span key={j} className={`badge text-[10px] ${a.success ? 'badge-emerald' : 'badge-rose'}`}>
                      {a.type}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { user } = useAuthStore();
  const canManage = ['owner','admin','manager'].includes(user?.role ?? '');

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Workflow | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/workflows')
      .then(r => setWorkflows(r.data.workflows))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleEnabled(wf: Workflow) {
    try {
      const r = await api.patch(`/workflows/${wf._id}`, { isEnabled: !wf.isEnabled });
      setWorkflows(prev => prev.map(w => w._id === wf._id ? r.data.workflow : w));
    } catch {}
  }

  async function deleteWorkflow(id: string) {
    if (!confirm('Delete this workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      setWorkflows(prev => prev.filter(w => w._id !== id));
    } catch {}
  }

  async function testWorkflow(id: string) {
    try {
      await api.post(`/workflows/${id}/test`);
      alert('Test trigger sent! Check execution history in a moment.');
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Test failed');
    }
  }

  function handleSave(wf: Workflow) {
    setWorkflows(prev => {
      const idx = prev.findIndex(w => w._id === wf._id);
      return idx >= 0 ? prev.map(w => w._id === wf._id ? wf : w) : [wf, ...prev];
    });
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="page-reveal space-y-6 pb-8">
      <PageHeader
        hero
        title="Workflow Automation"
        subtitle="Automate repetitive tasks with trigger-based workflows"
        icon={Zap}
        actions={canManage ? (
          <button onClick={() => setShowForm(true)} className="btn-primary h-9 px-4">
            <Plus className="h-3.5 w-3.5" /> New Workflow
          </button>
        ) : undefined}
      />

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i=>(
            <div key={i} className="surface rounded-2xl p-5">
              <SkeletonLine className="h-5 w-48 mb-3" />
              <SkeletonLine className="h-3 w-72" />
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No workflows yet"
          description="Create your first automation to save time on repetitive tasks."
          actions={canManage ? [{ label: 'Create Workflow', onClick: () => setShowForm(true) }] : []}
        />
      ) : (
        <div className="space-y-3 stagger-children">
          {workflows.map(wf => (
            <div key={wf._id} className="surface-interactive surface rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: wf.isEnabled ? 'rgba(99,102,241,0.12)' : 'var(--bg-hover)' }}
                  >
                    <Zap className="h-4 w-4" style={{ color: wf.isEnabled ? 'var(--accent)' : 'var(--text-muted)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold theme-text-primary">{wf.name}</h3>
                      <span className={`badge text-[10px] ${wf.isEnabled ? 'badge-emerald' : 'badge-slate'}`}>
                        {wf.isEnabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {wf.description && <p className="text-xs theme-text-muted mt-0.5">{wf.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] theme-text-muted">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {TRIGGER_LABELS[wf.trigger.type] ?? wf.trigger.type}
                      </span>
                      <span>·</span>
                      <span>{wf.actions.length} action{wf.actions.length !== 1 ? 's' : ''}</span>
                      {wf.runCount > 0 && <><span>·</span><span className="flex items-center gap-1"><Activity className="h-3 w-3" />{wf.runCount} runs</span></>}
                      {wf.failCount > 0 && <span className="text-rose-500">{wf.failCount} failed</span>}
                      {wf.lastRunAt && <><span>·</span><span>Last: {formatTimeAgo(wf.lastRunAt)}</span></>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canManage && (
                    <>
                      <button onClick={() => testWorkflow(wf._id)} className="btn-ghost h-8 w-8 p-0 rounded-lg" title="Test workflow">
                        <FlaskConical className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setHistoryId(wf._id)} className="btn-ghost h-8 w-8 p-0 rounded-lg" title="Execution history">
                        <Activity className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setEditing(wf); setShowForm(true); }} className="btn-ghost h-8 w-8 p-0 rounded-lg" title="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleEnabled(wf)} className="btn-ghost h-8 w-8 p-0 rounded-lg" title={wf.isEnabled ? 'Pause' : 'Enable'}>
                        {wf.isEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => deleteWorkflow(wf._id)} className="btn-ghost h-8 w-8 p-0 rounded-lg text-rose-500" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <WorkflowFormModal
          existing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {historyId && (
        <ExecutionHistory workflowId={historyId} onClose={() => setHistoryId(null)} />
      )}
    </div>
  );
}
