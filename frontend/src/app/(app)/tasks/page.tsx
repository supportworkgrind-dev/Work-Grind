'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Task, TaskRecurrence, TaskStatus } from '@/types';
import { EmptyState } from '@/components/common/EmptyState';
import { Avatar } from '@/components/common/Avatar';
import {
  CheckSquare, Plus, Kanban, List as ListIcon, CalendarDays,
  ChevronLeft, ChevronRight, Clock, MessageSquare, Trash2, X, GripVertical, Repeat2, Timer, Search, Save,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

type TaskSortMode = 'due-asc' | 'due-desc' | 'priority' | 'created-desc' | 'title';
type TaskDueFilter = 'all' | 'overdue' | 'next-seven-days' | 'undated';
type SavedTaskView = {
  id: string;
  name: string;
  status: string;
  priority: string;
  query: string;
  assigneeId: string;
  projectId: string;
  dueFilter: TaskDueFilter;
  sortMode: TaskSortMode;
};

/* ── Column config ── */
const COLUMNS: { id: TaskStatus; label: string; dotColor: string; count?: number }[] = [
  { id: 'todo',        label: 'To Do',       dotColor: 'bg-slate-400'   },
  { id: 'in_progress', label: 'In Progress',  dotColor: 'bg-blue-500'    },
  { id: 'review',      label: 'In Review',    dotColor: 'bg-amber-500'   },
  { id: 'completed',   label: 'Completed',    dotColor: 'bg-emerald-500' },
];

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'badge badge-rose',
  high:   'badge badge-amber',
  medium: 'badge badge-blue',
  low:    'badge badge-slate',
};

const STATUS_STYLES: Record<string, string> = {
  todo:        'badge badge-slate',
  in_progress: 'badge badge-blue',
  review:      'badge badge-amber',
  completed:   'badge badge-emerald',
  blocked:     'badge badge-rose',
};

export default function TasksPage() {
  const { user }           = useAuthStore();
  const { openCreateModal } = useAppStore();
  const isOwnerAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [viewMode,       setViewMode]       = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [calendarDate,   setCalendarDate]   = useState(() => new Date());
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterQuery,    setFilterQuery]    = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterProject,  setFilterProject]  = useState('all');
  const [filterDue,      setFilterDue]      = useState<TaskDueFilter>('all');
  const [sortMode,       setSortMode]       = useState<TaskSortMode>('due-asc');
  const [savedViews,     setSavedViews]     = useState<SavedTaskView[]>([]);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewName,  setSavedViewName]  = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkStatus,     setBulkStatus]     = useState<TaskStatus>('todo');
  const [bulkPriority,   setBulkPriority]   = useState<Task['priority']>('medium');
  const [bulkDueDate,    setBulkDueDate]    = useState('');
  const [bulkActionError, setBulkActionError] = useState('');
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const [newSubtask,     setNewSubtask]     = useState('');
  const [newComment,     setNewComment]     = useState('');
  const [newCustomFieldKey, setNewCustomFieldKey] = useState('');
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('');
  const [timerNow, setTimerNow] = useState(Date.now());
  const [loading,        setLoading]        = useState(true);
  const [dragging,       setDragging]       = useState<string | null>(null);
  const [dragOver,       setDragOver]       = useState<TaskStatus | null>(null);

  /* ── Fetch & real-time ── */
  const fetchTasks = async () => {
    try { setLoading(true);
      const r = await api.get('/tasks');
      if (r.data.success) setTasks(r.data.tasks);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  useEffect(() => {
    if (!user?._id) {
      setSavedViews([]);
      setSelectedSavedViewId('');
      return;
    }
    try {
      const stored = localStorage.getItem(`workgrind:task-views:${user._id}`);
      setSavedViews(stored ? JSON.parse(stored) : []);
    } catch {
      setSavedViews([]);
    }
  }, [user?._id]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onCreated  = (t: Task)            => setTasks((p) => p.some((x) => x._id === t._id) ? p : [t, ...p]);
    const onUpdated  = (t: Task)            => { setTasks((p) => p.map((x) => x._id === t._id ? t : x)); setSelectedTask((p) => p?._id === t._id ? t : p); };
    const onDeleted  = ({ taskId }: { taskId: string }) => { setTasks((p) => p.filter((x) => x._id !== taskId)); setSelectedTask((p) => p?._id === taskId ? null : p); };
    s.on('task:created', onCreated); s.on('task:updated', onUpdated); s.on('task:deleted', onDeleted);
    return () => { s.off('task:created', onCreated); s.off('task:updated', onUpdated); s.off('task:deleted', onDeleted); };
  }, []);

  /* ── Actions ── */
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const r = await api.patch(`/tasks/${taskId}`, { status: newStatus });
      if (r.data.success) { setTasks((p) => p.map((t) => t._id === taskId ? r.data.task : t)); if (selectedTask?._id === taskId) setSelectedTask(r.data.task); }
    } catch { /* silent */ }
  };
  const handleDueDateChange = async (taskId: string, dueDate: string) => {
    try {
      const r = await api.patch(`/tasks/${taskId}`, { dueDate: dueDate || null });
      if (r.data.success) {
        setTasks((previous) => previous.map((task) => task._id === taskId ? r.data.task : task));
        setSelectedTask((previous) => previous?._id === taskId ? r.data.task : previous);
      }
    } catch { /* silent */ }
  };
  const handleTaskDetailsUpdate = async (taskId: string, updates: Record<string, unknown>) => {
    try {
      const response = await api.patch(`/tasks/${taskId}`, updates);
      if (response.data.success) {
        setTasks((previous) => previous.map((task) => task._id === taskId ? response.data.task : task));
        setSelectedTask((previous) => previous?._id === taskId ? response.data.task : previous);
      }
    } catch { /* silent */ }
  };
  const handleTimerAction = async (taskId: string, action: 'start' | 'stop') => {
    try {
      const response = await api.post(`/tasks/${taskId}/time/${action}`);
      if (response.data.success) {
        setTasks((previous) => previous.map((task) => task._id === taskId ? response.data.task : task));
        setSelectedTask((previous) => previous?._id === taskId ? response.data.task : previous);
      }
    } catch { /* silent */ }
  };
  const handleAddCustomField = async () => {
    if (!selectedTask || !isOwnerAdmin || !newCustomFieldKey.trim()) return;
    await handleTaskDetailsUpdate(selectedTask._id, {
      customFields: [...(selectedTask.customFields ?? []), { key: newCustomFieldKey.trim(), value: newCustomFieldValue.trim() }],
    });
    setNewCustomFieldKey('');
    setNewCustomFieldValue('');
  };
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !canTrackSelectedTask || !newSubtask.trim()) return;
    try { const r = await api.post(`/tasks/${selectedTask._id}/subtasks`, { title: newSubtask }); if (r.data.success) { setSelectedTask(r.data.task); setTasks((p) => p.map((t) => t._id === selectedTask._id ? r.data.task : t)); setNewSubtask(''); } } catch { /* silent */ }
  };
  const handleToggleSubtask = async (subtaskId: string) => {
    if (!selectedTask || !canTrackSelectedTask) return;
    try { const r = await api.patch(`/tasks/${selectedTask._id}/subtasks/${subtaskId}`); if (r.data.success) { setSelectedTask(r.data.task); setTasks((p) => p.map((t) => t._id === selectedTask._id ? r.data.task : t)); } } catch { /* silent */ }
  };
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    try { const r = await api.post(`/tasks/${selectedTask._id}/comments`, { content: newComment }); if (r.data.success) { setSelectedTask(r.data.task); setTasks((p) => p.map((t) => t._id === selectedTask._id ? r.data.task : t)); setNewComment(''); } } catch { /* silent */ }
  };
  const handleDelete = async (id: string) => {
    try { await api.delete(`/tasks/${id}`); setTasks((p) => p.filter((t) => t._id !== id)); if (selectedTask?._id === id) setSelectedTask(null); } catch { /* silent */ }
  };

  const saveTaskView = () => {
    const name = savedViewName.trim();
    if (!name || !user?._id) return;
    const view: SavedTaskView = {
      id: crypto.randomUUID(),
      name,
      status: filterStatus,
      priority: filterPriority,
      query: filterQuery,
      assigneeId: filterAssignee,
      projectId: filterProject,
      dueFilter: filterDue,
      sortMode,
    };
    const nextViews = [...savedViews, view];
    setSavedViews(nextViews);
    setSelectedSavedViewId(view.id);
    localStorage.setItem(`workgrind:task-views:${user._id}`, JSON.stringify(nextViews));
    setSavedViewName('');
  };

  const applyTaskView = (viewId: string) => {
    setSelectedSavedViewId(viewId);
    const view = savedViews.find((candidate) => candidate.id === viewId);
    if (!view) return;
    setFilterStatus(view.status);
    setFilterPriority(view.priority);
    setFilterQuery(view.query);
    setFilterAssignee(view.assigneeId);
    setFilterProject(view.projectId);
    setFilterDue(view.dueFilter);
    setSortMode(view.sortMode);
    setSelectedTaskIds([]);
  };

  const removeTaskView = (viewId: string) => {
    if (!user?._id) return;
    const nextViews = savedViews.filter((view) => view.id !== viewId);
    setSavedViews(nextViews);
    if (selectedSavedViewId === viewId) setSelectedSavedViewId('');
    localStorage.setItem(`workgrind:task-views:${user._id}`, JSON.stringify(nextViews));
  };

  const toggleTaskSelection = (taskId: string) => {
    setBulkActionError('');
    setSelectedTaskIds((previous) => previous.includes(taskId) ? previous.filter((id) => id !== taskId) : [...previous, taskId]);
  };

  const applyBulkUpdate = async (updates: { status?: TaskStatus; priority?: Task['priority']; dueDate?: string | null }) => {
    if (!isOwnerAdmin || selectedTaskIds.length === 0) return;
    const targetIds = [...selectedTaskIds];
    const results = await Promise.allSettled(targetIds.map((id) => api.patch(`/tasks/${id}`, updates)));
    const failedIds = targetIds.filter((_, index) => results[index].status === 'rejected');
    setSelectedTaskIds(failedIds);
    setBulkActionError(failedIds.length ? `Updated ${targetIds.length - failedIds.length}; ${failedIds.length} failed. Failed tasks remain selected.` : '');
    await fetchTasks();
  };

  /* ── Filtered tasks ── */
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const nextWeekKey = (() => { const date = new Date(); date.setDate(date.getDate() + 7); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; })();
  const filtered = tasks.filter((t) => {
    if (filterStatus   !== 'all' && t.status   !== filterStatus)   return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterQuery && !`${t.title} ${t.description ?? ''} ${(t.tags ?? []).join(' ')}`.toLowerCase().includes(filterQuery.toLowerCase())) return false;
    const assigneeId = typeof t.assigneeId === 'object' ? t.assigneeId?._id : t.assigneeId;
    const projectId = typeof t.projectId === 'object' ? t.projectId?._id : t.projectId;
    if (filterAssignee !== 'all' && assigneeId !== filterAssignee) return false;
    if (filterProject !== 'all' && projectId !== filterProject) return false;
    const dueKey = t.dueDate?.slice(0, 10);
    if (filterDue === 'undated' && dueKey) return false;
    if (filterDue === 'overdue' && (!dueKey || dueKey >= todayKey || t.status === 'completed')) return false;
    if (filterDue === 'next-seven-days' && (!dueKey || dueKey < todayKey || dueKey > nextWeekKey || t.status === 'completed')) return false;
    return true;
  }).sort((left, right) => {
    if (sortMode === 'title') return left.title.localeCompare(right.title);
    if (sortMode === 'priority') {
      const priority = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priority[right.priority] - priority[left.priority];
    }
    if (sortMode === 'created-desc') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return sortMode === 'due-desc' ? rightDue - leftDue : leftDue - rightDue;
  });
  const taskAssignees = new Map<string, string>();
  const taskProjects = new Map<string, string>();
  for (const task of tasks) {
    if (typeof task.assigneeId === 'object' && task.assigneeId) taskAssignees.set(task.assigneeId._id, task.assigneeId.fullName);
    if (typeof task.projectId === 'object' && task.projectId) taskProjects.set(task.projectId._id, task.projectId.name);
  }
  const allFilteredSelected = filtered.length > 0 && filtered.every((task) => selectedTaskIds.includes(task._id));
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstCalendarWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstCalendarWeekday + 1;
    return day > 0 && day <= calendarDaysInMonth ? day : null;
  });
  const dateKey = (day: number) => `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const scheduledTasks = filtered.filter((task) => Boolean(task.dueDate));
  const unscheduledTasks = filtered.filter((task) => !task.dueDate);
  const selectedAssigneeId = typeof selectedTask?.assigneeId === 'object' ? selectedTask.assigneeId?._id : selectedTask?.assigneeId;
  const selectedCreatorId = typeof selectedTask?.creatorId === 'object' ? selectedTask.creatorId?._id : selectedTask?.creatorId;
  const canTrackSelectedTask = Boolean(selectedTask && (isOwnerAdmin || selectedAssigneeId === user?._id || selectedCreatorId === user?._id));
  const activeTimerEntry = selectedTask?.timeEntries?.slice().reverse().find((entry) => {
    const entryUserId = typeof entry.userId === 'object' ? entry.userId._id : entry.userId;
    return entryUserId === user?._id && !entry.stoppedAt;
  });
  const selectedTaskSeconds = (selectedTask?.timeEntries ?? []).reduce((total, entry) => {
    const entryUserId = typeof entry.userId === 'object' ? entry.userId._id : entry.userId;
    const seconds = entry.durationSeconds || (entryUserId === user?._id && !entry.stoppedAt ? Math.max(0, Math.floor((timerNow - new Date(entry.startedAt).getTime()) / 1000)) : 0);
    return total + seconds;
  }, 0);

  useEffect(() => {
    if (!activeTimerEntry) return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTimerEntry?._id]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-5">

      {/* ── HEADER ── */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Task Management</h1>
          <p className="page-subtitle">Organize work, assign tasks, track deadlines, and monitor completion</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 overflow-visible">
          {/* View toggle */}
          <div className="flex items-center rounded-xl p-1 border gap-0.5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            {(['kanban', 'list', 'calendar'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                aria-pressed={viewMode === v}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === v
                    ? 'text-[var(--text-on-accent)] shadow-xs'
                    : 'theme-text-muted hover:theme-text-secondary'
                }`}
                style={viewMode === v ? { background: 'var(--accent)' } : {}}
              >
                {v === 'kanban' ? <Kanban className="h-3.5 w-3.5" /> : v === 'list' ? <ListIcon className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                <span className="capitalize">{v}</span>
              </button>
            ))}
          </div>

          {isOwnerAdmin && (
            <button onClick={() => openCreateModal('task')} className="btn-primary h-9 px-4">
              <Plus className="h-3.5 w-3.5" /><span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[190px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 theme-text-muted" />
          <input value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} placeholder="Search tasks" className="input-base h-9 w-full pl-8 text-xs" />
        </label>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="task-filter-select min-w-0 max-w-full rounded-xl border px-3 text-xs font-medium theme-text-secondary transition-colors focus-ring"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <option value="all">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">In Review</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="task-filter-select min-w-0 max-w-full rounded-xl border px-3 text-xs font-medium theme-text-secondary transition-colors focus-ring"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={filterAssignee} onChange={(event) => setFilterAssignee(event.target.value)} aria-label="Filter by assignee" className="input-base task-filter-select w-auto min-w-0 max-w-40 text-xs">
          <option value="all">All assignees</option>
          {[...taskAssignees].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={filterProject} onChange={(event) => setFilterProject(event.target.value)} aria-label="Filter by project" className="input-base task-filter-select w-auto min-w-0 max-w-40 text-xs">
          <option value="all">All projects</option>
          {[...taskProjects].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={filterDue} onChange={(event) => setFilterDue(event.target.value as TaskDueFilter)} aria-label="Filter by due date" className="input-base task-filter-select w-auto min-w-0 max-w-full text-xs">
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="next-seven-days">Next 7 days</option>
          <option value="undated">Unscheduled</option>
        </select>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as TaskSortMode)} aria-label="Sort tasks" className="input-base task-filter-select w-auto min-w-0 max-w-full text-xs">
          <option value="due-asc">Due date: earliest</option>
          <option value="due-desc">Due date: latest</option>
          <option value="priority">Priority: highest</option>
          <option value="created-desc">Recently created</option>
          <option value="title">Title: A–Z</option>
        </select>

        {(filterStatus !== 'all' || filterPriority !== 'all' || filterQuery || filterAssignee !== 'all' || filterProject !== 'all' || filterDue !== 'all') && (
          <button onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterQuery(''); setFilterAssignee('all'); setFilterProject('all'); setFilterDue('all'); }}
            className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors">
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}

        <span className="text-xs theme-text-muted ml-auto">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 overflow-visible">
        <select value={selectedSavedViewId} onChange={(event) => applyTaskView(event.target.value)} aria-label="Load saved task view" className="input-base task-filter-select w-auto min-w-40 max-w-full text-xs">
          <option value="">Saved views</option>
          {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
        {selectedSavedViewId && (
          <button type="button" onClick={() => removeTaskView(selectedSavedViewId)} className="btn-ghost h-8 px-2 text-[10px]" title="Remove selected saved view">Remove view</button>
        )}
        <input value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} maxLength={48} placeholder="Name this view" aria-label="Saved view name" className="input-base h-8 w-36 text-xs" />
        <button type="button" onClick={saveTaskView} disabled={!savedViewName.trim()} className="btn-secondary h-8 px-2.5 text-xs disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save view</button>
      </div>

      {isOwnerAdmin && selectedTaskIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 theme-border">
          <span className="mr-auto text-xs font-semibold theme-text-secondary">{selectedTaskIds.length} selected</span>
          <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as TaskStatus)} aria-label="Bulk status" className="input-base h-8 text-xs">
            {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
            <option value="blocked">Blocked</option>
          </select>
          <button type="button" onClick={() => void applyBulkUpdate({ status: bulkStatus })} className="btn-secondary h-8 px-3 text-xs">Set status</button>
          <select value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value as Task['priority'])} aria-label="Bulk priority" className="input-base h-8 text-xs">
            {(['urgent', 'high', 'medium', 'low'] as const).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
          <button type="button" onClick={() => void applyBulkUpdate({ priority: bulkPriority })} className="btn-secondary h-8 px-3 text-xs">Set priority</button>
          <input type="date" value={bulkDueDate} onChange={(event) => setBulkDueDate(event.target.value)} aria-label="Bulk due date" className="input-base h-8 text-xs" />
          <button type="button" disabled={!bulkDueDate} onClick={() => void applyBulkUpdate({ dueDate: bulkDueDate })} className="btn-secondary h-8 px-3 text-xs disabled:opacity-50">Set due dates</button>
          <button type="button" onClick={() => void applyBulkUpdate({ dueDate: null })} className="btn-secondary h-8 px-3 text-xs">Clear due dates</button>
          <button type="button" onClick={() => { setSelectedTaskIds([]); setBulkActionError(''); }} className="btn-ghost h-8 px-2 text-xs">Clear selection</button>
        </div>
      )}
      {bulkActionError && <p role="status" className="text-xs text-amber-600">{bulkActionError}</p>}

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((c) => (
            <div key={c.id} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
              <div className="h-4 w-20 rounded skeleton-shimmer" />
              {[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl skeleton-shimmer" />)}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Create your first task to start tracking work across your team."
          actionLabel="Create Task"
          onAction={() => openCreateModal('task')}
        />
      ) : viewMode === 'calendar' ? (
        <div className="space-y-4">
          <section className="surface overflow-hidden rounded-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="text-sm font-bold theme-text-primary">
                  {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </h2>
                <p className="mt-0.5 text-[11px] theme-text-muted">{scheduledTasks.length} scheduled task{scheduledTasks.length === 1 ? '' : 's'}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous month" onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))} className="btn-ghost h-8 w-8 p-0 rounded-lg"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => setCalendarDate(new Date())} className="btn-secondary h-8 px-3 text-xs">Today</button>
                <button type="button" aria-label="Next month" onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))} className="btn-ghost h-8 w-8 p-0 rounded-lg"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </header>
            <div className="grid grid-cols-7 border-b text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                <div key={weekday} className="py-2 text-[9px] font-bold uppercase tracking-wider theme-text-muted sm:text-[10px]">{weekday}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--border-subtle)' }}>
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} aria-hidden="true" className="min-h-20 bg-[var(--bg-base)] opacity-50 sm:min-h-28" />;
                }
                const key = dateKey(day);
                const dayTasks = scheduledTasks.filter((task) => task.dueDate?.slice(0, 10) === key);
                const isToday = new Date().getFullYear() === calendarYear && new Date().getMonth() === calendarMonth && new Date().getDate() === day;
                return (
                  <div key={key} className="min-h-20 bg-[var(--bg-card)] p-1.5 sm:min-h-28 sm:p-2">
                    <div className="mb-1 flex justify-end">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${isToday ? 'text-[var(--text-on-accent)]' : 'theme-text-secondary'}`} style={isToday ? { background: 'var(--accent)' } : undefined}>{day}</span>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((task) => (
                        <button key={task._id} type="button" onClick={() => setSelectedTask(task)} title={task.title} className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-medium theme-bg-hover theme-text-secondary sm:text-[10px]">
                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${task.status === 'completed' ? 'bg-emerald-500' : task.status === 'blocked' ? 'bg-rose-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                          {task.title}
                        </button>
                      ))}
                      {dayTasks.length > 3 && <p className="px-1 text-[9px] theme-text-muted">+{dayTasks.length - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          {unscheduledTasks.length > 0 && (
            <section className="surface rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold theme-text-primary">Unscheduled</h2>
                <span className="text-[10px] theme-text-muted">{unscheduledTasks.length} task{unscheduledTasks.length === 1 ? '' : 's'} without a due date</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {unscheduledTasks.map((task) => (
                  <button key={task._id} type="button" onClick={() => setSelectedTask(task)} className="max-w-full truncate rounded-lg border px-3 py-2 text-left text-[11px] theme-border theme-text-secondary hover:theme-bg-hover">{task.title}</button>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : viewMode === 'kanban' ? (

        /* ── KANBAN ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragging;
                  if (id) handleStatusChange(id, col.id);
                  setDragOver(null); setDragging(null);
                }}
                className={`kanban-col transition-all duration-150 ${
                  dragOver === col.id ? 'border-[var(--border-focus)] bg-[var(--bg-active)]' : ''
                }`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between pb-3 mb-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary">{col.label}</span>
                    <span className="text-[10px] font-bold theme-text-muted bg-[var(--bg-hover)] rounded-full px-1.5 py-0.5">{colTasks.length}</span>
                  </div>
                  {isOwnerAdmin && (
                    <button onClick={() => openCreateModal('task')} className="btn-ghost h-6 w-6 p-0 rounded-lg" aria-label="Add task">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed flex items-center justify-center h-20 text-xs theme-text-muted transition-colors"
                      style={{ borderColor: dragOver === col.id ? 'var(--border-focus)' : 'var(--border-subtle)' }}>
                      Drop here
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task._id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', task._id); setDragging(task._id); }}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        onClick={() => setSelectedTask(task)}
                        className={`kanban-card group cursor-grab active:cursor-grabbing ${
                          dragging === task._id ? 'opacity-40 scale-95' : ''
                        }`}
                      >
                        {/* Priority & project */}
                        <div className="flex items-center justify-between mb-2.5">
                          <span className={PRIORITY_STYLES[task.priority] ?? 'badge badge-slate'}>
                            {task.priority}
                          </span>
                          {task.projectId?.name && (
                            <span className="text-[10px] theme-text-muted truncate max-w-[90px]">
                              {task.projectId.name}
                            </span>
                          )}
                        </div>

                        <p className="text-[13px] font-semibold theme-text-primary group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                          {task.title}
                        </p>

                        {task.description && (
                          <p className="mt-1 text-[11px] theme-text-muted line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="mt-3 pt-2.5 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="flex items-center gap-1 text-[10px] theme-text-muted">
                            <Clock className="h-3 w-3" />
                            <span>{task.dueDate ? formatDate(task.dueDate, 'MMM d') : 'No date'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(task.comments?.length ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] theme-text-muted">
                                <MessageSquare className="h-3 w-3" />{task.comments!.length}
                              </span>
                            )}
                            {task.assigneeId ? (
                              <Avatar name={task.assigneeId.fullName} src={task.assigneeId.avatar} size="xs" />
                            ) : (
                              <div className="h-5 w-5 rounded-lg border-2 border-dashed flex items-center justify-center" style={{ borderColor: 'var(--border-color)' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* ── LIST VIEW ── */
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {isOwnerAdmin && <th><input type="checkbox" aria-label="Select all filtered tasks" checked={allFilteredSelected} onChange={(event) => setSelectedTaskIds(event.target.checked ? filtered.map((task) => task._id) : [])} /></th>}
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Project</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={isOwnerAdmin ? 7 : 6} className="text-center py-10 theme-text-muted text-xs">No tasks match current filters</td></tr>
                ) : filtered.map((t) => (
                  <tr key={t._id} onClick={() => setSelectedTask(t)} className="cursor-pointer">
                    {isOwnerAdmin && <td onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${t.title}`} checked={selectedTaskIds.includes(t._id)} onChange={() => toggleTaskSelection(t._id)} /></td>}
                    <td className="max-w-[240px]">
                      <p className="text-[13px] font-semibold theme-text-primary truncate">{t.title}</p>
                    </td>
                    <td><span className={STATUS_STYLES[t.status] ?? 'badge badge-slate'}>{t.status.replace('_', ' ')}</span></td>
                    <td><span className={PRIORITY_STYLES[t.priority] ?? 'badge badge-slate'}>{t.priority}</span></td>
                    <td className="theme-text-secondary text-[12px]">{t.projectId?.name ?? '—'}</td>
                    <td>
                      {t.assigneeId
                        ? <div className="flex items-center gap-1.5"><Avatar name={t.assigneeId.fullName} src={t.assigneeId.avatar} size="xs" /><span className="text-[12px] theme-text-secondary truncate max-w-[100px]">{t.assigneeId.fullName}</span></div>
                        : <span className="text-[12px] theme-text-muted">Unassigned</span>
                      }
                    </td>
                    <td className="text-[12px] theme-text-secondary whitespace-nowrap">{t.dueDate ? formatDate(t.dueDate, 'MMM d, yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TASK DETAIL PANEL ── */}
      {selectedTask && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs" onClick={() => setSelectedTask(null)} />

          <div
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] flex flex-col border-l shadow-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between border-b px-5 py-4 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className={PRIORITY_STYLES[selectedTask.priority] ?? 'badge badge-slate'}>{selectedTask.priority}</span>
                <span className={STATUS_STYLES[selectedTask.status] ?? 'badge badge-slate'}>{selectedTask.status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-1">
                {(user?.role === 'owner' || user?.role === 'admin') && (
                  <button onClick={() => handleDelete(selectedTask._id)}
                    className="btn-ghost h-8 w-8 p-0 rounded-lg text-rose-500 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setSelectedTask(null)} className="btn-ghost h-8 w-8 p-0 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <h2 className="text-base font-bold theme-text-primary break-words">{selectedTask.title}</h2>

              {/* Status select */}
              <div>
                <label className="form-label">Status</label>
                <select
                  value={selectedTask.status}
                  disabled={!(isOwnerAdmin || (typeof selectedTask.assigneeId === 'object' ? selectedTask.assigneeId?._id : selectedTask.assigneeId) === user?._id)}
                  onChange={(e) => handleStatusChange(selectedTask._id, e.target.value as TaskStatus)}
                  className="input-base text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              {isOwnerAdmin && (
                <div>
                  <label className="form-label" htmlFor="task-due-date">Due date</label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={selectedTask.dueDate?.slice(0, 10) ?? ''}
                    onChange={(event) => void handleDueDateChange(selectedTask._id, event.target.value)}
                    className="input-base text-sm"
                  />
                </div>
              )}

              {selectedTask.description && (
                <div>
                  <label className="form-label">Description</label>
                  <p className="text-xs theme-text-secondary leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              <section className="rounded-xl border p-3 theme-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold theme-text-primary">Time tracking</p>
                    <p className="mt-0.5 text-[10px] theme-text-muted">
                      {Math.floor(selectedTaskSeconds / 3600)}h {Math.floor((selectedTaskSeconds % 3600) / 60)}m logged
                      {activeTimerEntry ? ' · Timer running' : ''}
                    </p>
                  </div>
                  {canTrackSelectedTask && (
                    <button type="button" onClick={() => void handleTimerAction(selectedTask._id, activeTimerEntry ? 'stop' : 'start')} className={activeTimerEntry ? 'btn-secondary h-8 px-3 text-xs' : 'btn-primary h-8 px-3 text-xs'}>
                      <Timer className="h-3.5 w-3.5" />{activeTimerEntry ? 'Stop timer' : 'Start timer'}
                    </button>
                  )}
                </div>
              </section>

              {isOwnerAdmin && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> Recurrence</label>
                    <select value={selectedTask.recurrence ?? 'none'} onChange={(event) => void handleTaskDetailsUpdate(selectedTask._id, { recurrence: event.target.value as TaskRecurrence })} className="input-base text-xs">
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Estimate (minutes)</label>
                    <input key={`${selectedTask._id}-${selectedTask.estimatedMinutes ?? ''}`} type="number" min={0} max={525600} step={1} defaultValue={selectedTask.estimatedMinutes ?? ''} onBlur={(event) => {
                      const value = event.currentTarget.value;
                      void handleTaskDetailsUpdate(selectedTask._id, { estimatedMinutes: value === '' ? null : Number(value) });
                    }} className="input-base text-xs" />
                  </div>
                </div>
              )}

              {isOwnerAdmin && (
                <section className="space-y-2">
                  <label className="form-label">Dependencies</label>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2 theme-border">
                    {tasks.filter((task) => task._id !== selectedTask._id).map((task) => (
                      <label key={task._id} className="flex items-center gap-2 text-[11px] theme-text-secondary">
                        <input type="checkbox" checked={selectedTask.dependencyIds?.includes(task._id) ?? false} onChange={(event) => {
                          const dependencyIds = selectedTask.dependencyIds ?? [];
                          const nextIds = event.target.checked ? [...dependencyIds, task._id] : dependencyIds.filter((id) => id !== task._id);
                          void handleTaskDetailsUpdate(selectedTask._id, { dependencyIds: nextIds });
                        }} />
                        <span className="truncate">{task.title}</span>
                        <span className="ml-auto shrink-0 text-[9px] theme-text-muted">{task.status.replace('_', ' ')}</span>
                      </label>
                    ))}
                    {tasks.length <= 1 && <p className="text-[10px] theme-text-muted">No other tasks available.</p>}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <label className="form-label">Custom fields</label>
                {(selectedTask.customFields ?? []).map((field, index) => (
                  <div key={`${field.key}-${index}`} className="flex items-center gap-2 text-xs">
                    <span className="w-1/3 truncate font-medium theme-text-muted">{field.key}</span>
                    <span className="min-w-0 flex-1 break-words theme-text-secondary">{field.value || '—'}</span>
                    {isOwnerAdmin && <button type="button" aria-label={`Remove ${field.key}`} onClick={() => void handleTaskDetailsUpdate(selectedTask._id, { customFields: selectedTask.customFields?.filter((_, fieldIndex) => fieldIndex !== index) ?? [] })} className="text-[10px] text-rose-500">Remove</button>}
                  </div>
                ))}
                {isOwnerAdmin && (
                  <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                    <input value={newCustomFieldKey} onChange={(event) => setNewCustomFieldKey(event.target.value)} maxLength={60} placeholder="Field" className="input-base min-w-0 text-xs" />
                    <input value={newCustomFieldValue} onChange={(event) => setNewCustomFieldValue(event.target.value)} maxLength={500} placeholder="Value" className="input-base min-w-0 text-xs" />
                    <button type="button" disabled={!newCustomFieldKey.trim()} onClick={() => void handleAddCustomField()} className="btn-secondary px-2 text-xs">Add</button>
                  </div>
                )}
                {!(selectedTask.customFields?.length) && !isOwnerAdmin && <p className="text-[10px] theme-text-muted">No custom fields.</p>}
              </section>

              {/* Subtasks */}
              <div>
                <label className="form-label">
                  Subtasks ({selectedTask.subtasks?.filter((s) => s.isCompleted).length ?? 0}/{selectedTask.subtasks?.length ?? 0})
                </label>
                <div className="space-y-1.5 mt-1.5">
                  {selectedTask.subtasks?.map((st) => (
                    <button
                      key={st._id}
                      onClick={() => handleToggleSubtask(st._id)}
                      disabled={!canTrackSelectedTask}
                      aria-pressed={st.isCompleted}
                      className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-left transition-colors ${canTrackSelectedTask ? 'hover:bg-[var(--bg-hover)]' : 'cursor-not-allowed opacity-70'}`}
                    >
                      <div className={`h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                        st.isCompleted
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)]'
                          : 'border-[var(--border-color)]'
                      }`}>
                        {st.isCompleted && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className={`text-xs ${st.isCompleted ? 'line-through theme-text-muted' : 'theme-text-primary'}`}>{st.title}</span>
                    </button>
                  ))}
                </div>
                {canTrackSelectedTask && (
                  <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Add checklist item..."
                      className="input-base text-xs flex-1"
                    />
                    <button type="submit" className="btn-primary px-3 h-9 rounded-xl text-xs">Add</button>
                  </form>
                )}
              </div>

              {/* Comments */}
              <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <label className="form-label">Comments</label>
                <div className="space-y-3 mt-1.5">
                  {selectedTask.comments?.map((c) => (
                    <div key={c._id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold theme-text-primary">{c.userId?.fullName ?? 'User'}</span>
                        <span className="text-[10px] theme-text-muted">{formatDate(c.createdAt, 'MMM d, h:mm a')}</span>
                      </div>
                      <p className="text-xs theme-text-secondary leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="input-base text-xs resize-none"
                  />
                  <button type="submit" className="btn-primary w-full h-9 justify-center text-xs">Post comment</button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
