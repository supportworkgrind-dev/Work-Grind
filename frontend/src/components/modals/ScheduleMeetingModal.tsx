'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import type { CrmCompany, CrmContact, Project } from '@/types';
import { X, Video, UserPlus } from 'lucide-react';

interface MeetingInvitee {
  _id: string;
  fullName: string;
  callingId: string;
}

export function ScheduleMeetingModal({ onCreated }: { onCreated?: () => void }) {
  const { isCreateModalOpen, createModalType, closeCreateModal } = useAppStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [crmCompanies, setCrmCompanies] = useState<CrmCompany[]>([]);
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [crmCompanyId, setCrmCompanyId] = useState('');
  const [crmContactIds, setCrmContactIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [callingIdInput, setCallingIdInput] = useState('');
  const [invitees, setInvitees] = useState<MeetingInvitee[]>([]);
  const [isLookingUpInvitee, setIsLookingUpInvitee] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isCreateModalOpen || createModalType !== 'meeting') return;
    let active = true;
    const loadOptions = async () => {
      const [companyResult, contactResult, projectResult] = await Promise.allSettled([
        api.get('/crm/companies?limit=200'),
        api.get('/crm/contacts?limit=200'),
        api.get('/projects?limit=200'),
      ]);
      if (!active) return;
      setCrmCompanies(companyResult.status === 'fulfilled' ? companyResult.value.data.companies : []);
      setCrmContacts(contactResult.status === 'fulfilled' ? contactResult.value.data.contacts : []);
      setProjects(projectResult.status === 'fulfilled' ? projectResult.value.data.projects : []);
    };
    void loadOptions();
    return () => { active = false; };
  }, [isCreateModalOpen, createModalType]);

  if (!isCreateModalOpen || createModalType !== 'meeting') return null;

  const addInvitee = async () => {
    setInviteError('');
    setIsLookingUpInvitee(true);
    try {
      const response = await api.post('/meetings/invitees/lookup', { callingId: callingIdInput });
      const invitee = response.data.user as MeetingInvitee | undefined;
      if (!invitee?._id || !invitee.fullName || !invitee.callingId) {
        throw new Error('The lookup returned incomplete user information.');
      }
      if (invitees.some((current) => current._id === invitee._id)) {
        setInviteError('This user is already on the invitation list.');
        return;
      }
      setInvitees((current) => [...current, invitee]);
      setCallingIdInput('');
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } }; message?: string })
        .response?.data?.message || (error as Error).message || 'Could not find that user.';
      setInviteError(message);
    } finally {
      setIsLookingUpInvitee(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    setSubmitError('');
    try {
      const res = await api.post('/meetings', {
        title,
        description,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        participantIds: invitees.map((invitee) => invitee._id),
        crmCompanyId: crmCompanyId || undefined,
        crmContactIds,
        projectId: projectId || undefined,
      });

      if (res.data.success) {
        closeCreateModal();
        setTitle('');
        setDescription('');
        setScheduledAt('');
        setCrmCompanyId('');
        setCrmContactIds([]);
        setProjectId('');
        setInvitees([]);
        setCallingIdInput('');
        if (onCreated) onCreated();
      }
    } catch (error) {
      setSubmitError(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message
          || 'The meeting could not be scheduled. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const availableContacts = crmContacts.filter((contact) => {
    if (!crmCompanyId) return true;
    const contactCompanyId = typeof contact.crmCompanyId === 'string' ? contact.crmCompanyId : contact.crmCompanyId?._id;
    return contactCompanyId === crmCompanyId;
  });
  const availableProjects = projects.filter((project) => {
    if (!crmCompanyId) return true;
    const projectCompanyId = typeof project.crmCompanyId === 'string' ? project.crmCompanyId : project.crmCompanyId?._id;
    return !projectCompanyId || projectCompanyId === crmCompanyId;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Schedule Video Meeting</h3>
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Meeting Topic
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Product Sync"
              className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="meeting-crm-company" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">CRM Company</label>
              <select id="meeting-crm-company" value={crmCompanyId} onChange={(event) => {
                const nextCompanyId = event.target.value;
                setCrmCompanyId(nextCompanyId);
                setCrmContactIds((current) => current.filter((contactId) => {
                  const contact = crmContacts.find((item) => item._id === contactId);
                  const contactCompanyId = typeof contact?.crmCompanyId === 'string' ? contact.crmCompanyId : contact?.crmCompanyId?._id;
                  return !nextCompanyId || contactCompanyId === nextCompanyId;
                }));
                const project = projects.find((item) => item._id === projectId);
                const projectCompanyId = typeof project?.crmCompanyId === 'string' ? project.crmCompanyId : project?.crmCompanyId?._id;
                if (nextCompanyId && projectCompanyId && projectCompanyId !== nextCompanyId) setProjectId('');
              }} className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
                <option value="">No linked company</option>
                {crmCompanies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="meeting-project" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Project</label>
              <select id="meeting-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
                <option value="">No linked project</option>
                {availableProjects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
              </select>
            </div>
          </div>

          {availableContacts.length > 0 && <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-700">CRM Contacts</legend>
            <div className="grid max-h-28 grid-cols-1 gap-x-3 gap-y-1 overflow-y-auto sm:grid-cols-2">
              {availableContacts.map((contact) => <label key={contact._id} className="flex min-w-0 items-center gap-2 py-1 text-xs text-slate-700">
                <input type="checkbox" checked={crmContactIds.includes(contact._id)} onChange={(event) => setCrmContactIds((current) => event.target.checked ? [...current, contact._id] : current.filter((id) => id !== contact._id))} />
                <span className="truncate">{contact.firstName} {contact.lastName}</span>
              </label>)}
            </div>
          </fieldset>}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Agenda & Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key discussion points, links..."
              className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
            />
          </div>

          <div>
            <label htmlFor="meeting-invite-calling-id" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Invite WorkGrind users
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="meeting-invite-calling-id"
                value={callingIdInput}
                onChange={(event) => setCallingIdInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!isLookingUpInvitee && callingIdInput.trim()) void addInvitee();
                  }
                }}
                placeholder="Calling ID, e.g. WG-48291"
                className="block min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => void addInvitee()}
                disabled={isLookingUpInvitee || !callingIdInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {isLookingUpInvitee ? 'Looking...' : 'Add'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Invitations can be sent to active WorkGrind users in other workspaces.</p>
            {inviteError && <p role="alert" className="mt-1 text-xs text-rose-600">{inviteError}</p>}
            {invitees.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {invitees.map((invitee) => (
                  <li key={invitee._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{invitee.fullName} <span className="text-slate-400">· {invitee.callingId}</span></span>
                    <button
                      type="button"
                      onClick={() => setInvitees((current) => current.filter((item) => item._id !== invitee._id))}
                      className="ml-3 shrink-0 text-xs font-medium text-slate-500 hover:text-rose-600"
                      aria-label={`Remove ${invitee.fullName}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            {submitError && <p role="alert" className="mr-auto self-center text-xs text-rose-600">{submitError}</p>}
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
              {isLoading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
