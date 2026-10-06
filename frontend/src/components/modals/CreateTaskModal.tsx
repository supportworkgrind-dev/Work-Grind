'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { User, Project, Task, TaskRecurrence, TaskCustomField } from '@/types';
import { X, CheckSquare, Calendar, User as UserIcon, Flag, Briefcase, Clock3, Repeat2 } from 'lucide-react';

const TASK_TEMPLATES = [
  { id: 'bug', label: 'Bug fix', title: 'Fix reported issue', description: 'Record reproduction steps, expected behavior, and actual behavior.', priority: 'high', estimatedMinutes: 90 },
  { id: 'follow-up', label: 'Follow-up', title: 'Follow up with stakeholder', description: 'Capture the outcome and next action from the follow-up.', priority: 'medium', estimatedMinutes: 30 },
  { id: 'meeting-action', label: 'Meeting action', title: 'Complete meeting action item', description: 'Add the decision or meeting note this action comes from.', priority: 'medium', estimatedMinutes: 45 },
] as const;

export function CreateTaskModal({ onCreated }: { onCreated?: () => void }) {
  const { isCreateModalOpen, createModalType, closeCreateModal } = useAppStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [assigneeId, setAssigneeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<TaskCustomField[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isCreateModalOpen && createModalType === 'task') {
      const fetchData = async () => {
        try {
          const [uRes, pRes, taskRes] = await Promise.all([
            api.get('/users'),
            api.get('/projects'),
            api.get('/tasks?limit=200'),
          ]);
          if (uRes.data.success) setUsers(uRes.data.users);
          if (pRes.data.success) setProjects(pRes.data.projects);
          if (taskRes.data.success) setAvailableTasks(taskRes.data.tasks ?? []);
        } catch (err) {
          console.error(err);
        }
      };
      fetchData();
    }
  }, [isCreateModalOpen, createModalType]);

  if (!isCreateModalOpen || createModalType !== 'task') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const res = await api.post('/tasks', {
        title,
        description,
        priority,
        status,
        assigneeId: assigneeId || undefined,
        projectId: projectId || undefined,
        dueDate: dueDate || undefined,
        recurrence,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        dependencyIds,
        customFields,
      });

      if (res.data.success) {
        closeCreateModal();
        setTitle('');
        setDescription('');
        setRecurrence('none');
        setEstimatedMinutes('');
        setDependencyIds([]);
        setCustomFields([]);
        if (onCreated) onCreated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = TASK_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setTitle(template.title);
    setDescription(template.description);
    setPriority(template.priority);
    setEstimatedMinutes(String(template.estimatedMinutes));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Create New Task</h3>
          </div>
          <button
            onClick={closeCreateModal}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Start from template</label>
            <select defaultValue="" onChange={(event) => applyTemplate(event.target.value)} className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm">
              <option value="">Blank task</option>
              {TASK_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Task Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design homepage responsive layout"
              className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key deliverables, links or guidelines..."
              className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              >
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700"><Repeat2 className="h-3.5 w-3.5" /> Recurrence</label>
              <select value={recurrence} onChange={(event) => setRecurrence(event.target.value as TaskRecurrence)} className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm">
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700"><Clock3 className="h-3.5 w-3.5" /> Estimate (minutes)</label>
              <input type="number" min={0} max={525600} step={1} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm" />
            </div>
          </div>

          {availableTasks.length > 0 && (
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-700">Depends on</legend>
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {availableTasks.filter((task) => task.status !== 'completed').map((task) => (
                  <label key={task._id} className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={dependencyIds.includes(task._id)} onChange={(event) => setDependencyIds((previous) => event.target.checked ? [...previous, task._id] : previous.filter((id) => id !== task._id))} />
                    <span className="truncate">{task.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Custom fields</label>
              <button type="button" onClick={() => setCustomFields((previous) => [...previous, { key: '', value: '' }])} disabled={customFields.length >= 30} className="text-xs font-semibold text-indigo-600 disabled:opacity-40">Add field</button>
            </div>
            {customFields.map((field, index) => (
              <div key={index} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                <input aria-label={`Custom field ${index + 1} name`} maxLength={60} value={field.key} onChange={(event) => setCustomFields((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} placeholder="Field name" className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <input aria-label={`Custom field ${index + 1} value`} maxLength={500} value={field.value} onChange={(event) => setCustomFields((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="Value" className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <button type="button" onClick={() => setCustomFields((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove custom field ${index + 1}`} className="px-2 text-slate-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCreateModal}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
