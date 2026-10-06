import { create } from 'zustand';
import { User } from '../types';
import { adminApi } from '../lib/adminApi';

interface AdminAuthState {
  adminUser: User | null;
  adminToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (adminData: User, token: string) => void;
  logout: () => void;
  fetchAdminMe: () => Promise<boolean>;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => {
  let initialUser: User | null = null;
  let initialToken: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      const savedUser = localStorage.getItem('workgrind_super_admin_user');
      const savedToken = localStorage.getItem('workgrind_super_admin_token');
      if (savedUser && savedToken) {
        initialUser = JSON.parse(savedUser);
        initialToken = savedToken;
      }
    } catch {
      // Ignore parse error
    }
  }

  return {
    adminUser: initialUser,
    adminToken: initialToken,
    isLoading: !initialUser && typeof window !== 'undefined' && !!localStorage.getItem('workgrind_super_admin_token'),
    isAuthenticated: !!initialToken && !!initialUser,

    login: (adminData: User, token: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('workgrind_super_admin_token', token);
        localStorage.setItem('workgrind_super_admin_user', JSON.stringify(adminData));
      }
      set({
        adminUser: adminData,
        adminToken: token,
        isAuthenticated: true,
        isLoading: false,
      });
    },

    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('workgrind_super_admin_token');
        localStorage.removeItem('workgrind_super_admin_user');
      }
      set({
        adminUser: null,
        adminToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    },

    fetchAdminMe: async (): Promise<boolean> => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('workgrind_super_admin_token') : null;
      if (!token) {
        set({ adminUser: null, adminToken: null, isAuthenticated: false, isLoading: false });
        return false;
      }

      set({ isLoading: true });
      try {
        const res = await adminApi.get('/auth/me');
        if (res.data.success && res.data.admin?.isSuperAdmin) {
          const admin = res.data.admin;
          if (typeof window !== 'undefined') {
            localStorage.setItem('workgrind_super_admin_user', JSON.stringify(admin));
          }
          set({
            adminUser: admin,
            adminToken: token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } else {
          get().logout();
          return false;
        }
      } catch {
        get().logout();
        return false;
      }
    },
  };
});
