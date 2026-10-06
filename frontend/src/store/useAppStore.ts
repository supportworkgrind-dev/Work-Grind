import { create } from 'zustand';

interface AppState {
  activeChannelId: string | null;
  activeConversationId: string | null;
  isCreateModalOpen: boolean;
  createModalType: 'task' | 'project' | 'channel' | 'meeting' | null;
  isSearchOpen: boolean;
  isSidebarOpen: boolean;

  setActiveChannelId: (id: string | null) => void;
  setActiveConversationId: (id: string | null) => void;
  openCreateModal: (type: 'task' | 'project' | 'channel' | 'meeting') => void;
  closeCreateModal: () => void;
  setSearchOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeChannelId: null,
  activeConversationId: null,
  isCreateModalOpen: false,
  createModalType: null,
  isSearchOpen: false,
  isSidebarOpen: true,

  setActiveChannelId: (id) => set({ activeChannelId: id, activeConversationId: null }),
  setActiveConversationId: (id) => set({ activeConversationId: id, activeChannelId: null }),
  openCreateModal: (type) => set({ isCreateModalOpen: true, createModalType: type }),
  closeCreateModal: () => set({ isCreateModalOpen: false, createModalType: null }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
}));
