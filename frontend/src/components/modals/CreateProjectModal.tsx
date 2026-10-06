'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { User, TaskPriority, CrmCompany } from '@/types';
import {
  X,
  Briefcase,
  User as UserIcon,
  Users,
  Search,
  Check,
  CheckCircle2,
  Hash,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  Flag,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

export function CreateProjectModal({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isCreateModalOpen, createModalType, closeCreateModal } = useAppStore();

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<'planning' | 'active' | 'on_hold' | 'completed'>('planning');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');

  // Assignee & Members Selection
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const [crmCompanies, setCrmCompanies] = useState<CrmCompany[]>([]);
  const [crmCompanyId, setCrmCompanyId] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Search & Dropdown States
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  // Loading, Errors & Success States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdResult, setCreatedResult] = useState<{
    project: any;
    channel: any;
  } | null>(null);

  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch workspace users when modal opens
  useEffect(() => {
    if (isCreateModalOpen && createModalType === 'project') {
      const fetchUsers = async () => {
        try {
          const res = await api.get('/users');
          if (res.data.success) {
            setWorkspaceUsers(res.data.users);
            if (user && !assigneeId) {
              setAssigneeId(user._id);
            }
          }
        } catch (err) {
          console.error('Failed to load workspace members:', err);
        }
      };

      const fetchCrmCompanies = async () => {
        setCrmCompanies([]);
        try {
          const res = await api.get('/crm/companies?limit=200');
          if (res.data.success) setCrmCompanies(res.data.companies);
        } catch {
          setCrmCompanies([]);
        }
      };

      fetchUsers();
      fetchCrmCompanies();
      setCreatedResult(null);
      setError('');
    }
  }, [isCreateModalOpen, createModalType, user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        assigneeDropdownRef.current &&
        !assigneeDropdownRef.current.contains(e.target as Node)
      ) {
        setIsAssigneeDropdownOpen(false);
      }
      if (
        memberDropdownRef.current &&
        !memberDropdownRef.current.contains(e.target as Node)
      ) {
        setIsMemberDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isCreateModalOpen || createModalType !== 'project') return null;

  const handleClose = () => {
    closeCreateModal();
    setName('');
    setDescription('');
    setColor('#4F46E5');
    setPriority('medium');
    setStatus('planning');
    setStartDate('');
    setDeadline('');
    setCrmCompanyId('');
    setSelectedMemberIds([]);
    setCreatedResult(null);
    setError('');
  };

  const handleToggleMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds((prev) => [...prev, userId]);
    }
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a project name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.post('/projects', {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        priority,
        status,
        startDate: startDate || undefined,
        deadline: deadline || undefined,
        crmCompanyId: crmCompanyId || undefined,
        assigneeId: assigneeId || (user ? user._id : undefined),
        memberIds: selectedMemberIds,
      });

      if (res.data.success) {
        setCreatedResult({
          project: res.data.project,
          channel: res.data.channel,
        });
        if (onCreated) onCreated();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = () => {
    handleClose();
    router.push('/projects');
  };

  const handleOpenChannel = (channelId: string) => {
    handleClose();
    router.push(`/chat?channelId=${channelId}`);
  };

  const colors = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#64748B'];

  const selectedAssignee = workspaceUsers.find((u) => u._id === assigneeId) || user;

  const filteredAssignees = workspaceUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(assigneeSearch.toLowerCase()))
  );

  const filteredMembers = workspaceUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {createdResult ? 'Project Created!' : 'Create New Project'}
              </h3>
              <p className="text-xs text-slate-500">
                {createdResult
                  ? 'Your workspace project and dedicated channel are ready'
                  : 'Set up roadmap, assign leadership, and auto-generate channel'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── SUCCESS VIEW ── */}
        {createdResult ? (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-bold text-slate-900">
                Project &ldquo;{createdResult.project?.name}&rdquo; is Live!
              </h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Project created successfully and dedicated channel{' '}
                <span className="inline-flex items-center font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  #{createdResult.channel?.name}
                </span>{' '}
                has been generated with all assigned members.
              </p>
            </div>

            {/* Quick summary card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left max-w-md mx-auto space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Project Lead:</span>
                <span className="font-semibold text-slate-800">
                  {createdResult.project?.assigneeId?.fullName || selectedAssignee?.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Channel Members:</span>
                <span className="font-semibold text-slate-800">
                  {createdResult.channel?.members?.length || selectedMemberIds.length + 1} members added
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status &amp; Priority:</span>
                <span className="font-semibold capitalize text-slate-800">
                  {createdResult.project?.status} ({createdResult.project?.priority} priority)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleOpenChannel(createdResult.channel?._id)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all"
              >
                <Hash className="h-4 w-4" />
                <span>Open Project Channel</span>
              </button>

              <button
                type="button"
                onClick={handleOpenProject}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
              >
                <Briefcase className="h-4 w-4" />
                <span>View All Projects</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── FORM VIEW ── */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}

            {/* 1. Project Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website Redesign & Brand Launch"
                className="block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm bg-slate-50/50 focus:bg-white transition-all"
              />
              <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                Dedicated project channel will be automatically generated from this name.
              </p>
            </div>

            {/* 2. Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key deliverables, objectives, and milestones..."
                className="block w-full rounded-xl border-0 py-2 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>

            {crmCompanies.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CRM Company <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span>
                </label>
                <select
                  value={crmCompanyId}
                  onChange={(event) => setCrmCompanyId(event.target.value)}
                  className="block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm bg-slate-50/50 focus:bg-white"
                >
                  <option value="">No linked company</option>
                  {crmCompanies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
                </select>
              </div>
            )}

            {/* 3. Assignee & Member Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Lead / Assignee */}
              <div className="relative" ref={assigneeDropdownRef}>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Assign Project To (Lead) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white py-2 px-3 text-left shadow-2xs hover:border-slate-300 transition-all text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                      {selectedAssignee ? getInitials(selectedAssignee.fullName) : 'U'}
                    </div>
                    <span className="font-semibold text-slate-900 truncate">
                      {selectedAssignee ? selectedAssignee.fullName : 'Select assignee'}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[10px]">Change</span>
                </button>

                {/* Dropdown menu */}
                {isAssigneeDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200 max-h-56 overflow-y-auto">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        placeholder="Search members..."
                        className="w-full rounded-lg border-0 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      {filteredAssignees.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => {
                            setAssigneeId(u._id);
                            setIsAssigneeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                            assigneeId === u._id
                              ? 'bg-indigo-50 text-indigo-900 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                              {getInitials(u.fullName)}
                            </div>
                            <div>
                              <p className="leading-tight">{u.fullName}</p>
                              <p className="text-[10px] text-slate-400">{u.jobTitle || u.email}</p>
                            </div>
                          </div>
                          {assigneeId === u._id && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Project Members (Multi-Select) */}
              <div className="relative" ref={memberDropdownRef}>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Add Project Members ({selectedMemberIds.length})
                </label>
                <button
                  type="button"
                  onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white py-2 px-3 text-left shadow-2xs hover:border-slate-300 transition-all text-xs"
                >
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>
                      {selectedMemberIds.length === 0
                        ? 'Select teammates'
                        : `${selectedMemberIds.length} member${selectedMemberIds.length > 1 ? 's' : ''} selected`}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[10px]">Add</span>
                </button>

                {/* Dropdown menu */}
                {isMemberDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200 max-h-56 overflow-y-auto">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search workspace members..."
                        className="w-full rounded-lg border-0 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      {filteredMembers.map((u) => {
                        const isSelected = selectedMemberIds.includes(u._id);
                        return (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => handleToggleMember(u._id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {getInitials(u.fullName)}
                              </div>
                              <div>
                                <p className="leading-tight">{u.fullName}</p>
                                <p className="text-[10px] text-slate-400">{u.jobTitle || u.email}</p>
                              </div>
                            </div>
                            <div
                              className={`h-4 w-4 rounded-md border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Member Chips */}
            {selectedMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedMemberIds.map((id) => {
                  const m = workspaceUsers.find((u) => u._id === id);
                  if (!m) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-100 py-1 pl-2 pr-1.5 text-[11px] font-medium text-indigo-800"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-200 text-indigo-900 font-bold text-[9px]">
                        {getInitials(m.fullName)}
                      </span>
                      <span className="max-w-[100px] truncate">{m.fullName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(id)}
                        className="rounded hover:bg-indigo-200/60 p-0.5 text-indigo-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* 4. Priority & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="block w-full rounded-xl border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-indigo-600 text-xs bg-slate-50/50 focus:bg-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Project Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="block w-full rounded-xl border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-indigo-600 text-xs bg-slate-50/50 focus:bg-white"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* 5. Start Date & Target Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-xl border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-indigo-600 text-xs bg-slate-50/50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Target Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="block w-full rounded-xl border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-indigo-600 text-xs bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* 6. Brand Color */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Brand Accent Color
              </label>
              <div className="flex items-center gap-2.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-7 w-7 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Creating &amp; Generating Channel...</span>                  </>
                ) : (
                  <>
                    <span>Create Project &amp; Channel</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
