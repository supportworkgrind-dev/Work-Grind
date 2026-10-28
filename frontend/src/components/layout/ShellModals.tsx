'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store/useAppStore';

// The shell's modals are only needed once opened, so their code is loaded
// separately instead of with every app page, and fetched while the browser is
// idle so the first open is still immediate.
const loadSearch = () => import('@/components/modals/GlobalSearchModal');
const loadTask = () => import('@/components/modals/CreateTaskModal');
const loadProject = () => import('@/components/modals/CreateProjectModal');
const loadMeeting = () => import('@/components/modals/ScheduleMeetingModal');
const loadChannel = () => import('@/components/modals/CreateChannelModal');

const GlobalSearchModal = dynamic(() => loadSearch().then((module) => module.GlobalSearchModal), { ssr: false });
const CreateTaskModal = dynamic(() => loadTask().then((module) => module.CreateTaskModal), { ssr: false });
const CreateProjectModal = dynamic(() => loadProject().then((module) => module.CreateProjectModal), { ssr: false });
const ScheduleMeetingModal = dynamic(() => loadMeeting().then((module) => module.ScheduleMeetingModal), { ssr: false });
const CreateChannelModal = dynamic(() => loadChannel().then((module) => module.CreateChannelModal), { ssr: false });

export function ShellModals() {
  const { isSearchOpen, isCreateModalOpen, createModalType, setSearchOpen } = useAppStore(useShallow((state) => ({
    isSearchOpen: state.isSearchOpen,
    isCreateModalOpen: state.isCreateModalOpen,
    createModalType: state.createModalType,
    setSearchOpen: state.setSearchOpen,
  })));

  // The search shortcut must work before the search modal's code is loaded.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchOpen]);

  useEffect(() => {
    const preload = () => { void Promise.all([loadSearch(), loadTask(), loadProject(), loadMeeting(), loadChannel()]).catch(() => undefined); };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(preload, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {isSearchOpen && <GlobalSearchModal />}
      {isCreateModalOpen && createModalType === 'task' && <CreateTaskModal />}
      {isCreateModalOpen && createModalType === 'project' && <CreateProjectModal />}
      {isCreateModalOpen && createModalType === 'meeting' && <ScheduleMeetingModal />}
      {isCreateModalOpen && createModalType === 'channel' && <CreateChannelModal />}
    </>
  );
}
