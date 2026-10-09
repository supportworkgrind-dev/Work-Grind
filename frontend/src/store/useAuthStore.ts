import { create } from 'zustand';
import { User, Company, SubscriptionInfo, EntitlementId } from '../types';
import { api } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import { clearAuthValues, getAuthValue, removeAuthValue, setAuthSession, setAuthValue } from '../lib/authSession';
import { refreshAuthTokens } from '../lib/tokenRefresh';
import { useCallingStore } from './useCallingStore';

interface AuthState {
  user: User | null;
  company: Company | null;
  subscription: SubscriptionInfo | null;
  subscriptionLoading: boolean;
  subscriptionError: string | null;
  isLoading: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  trialDaysRemaining: number | null;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  login: (userData: User, accessToken: string) => void;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  canUse: (entitlement: EntitlementId) => boolean;
  isAtLimit: (resource: 'members' | 'storage' | 'aiRequests') => boolean;
  updateUserStatus: (status: 'online' | 'away' | 'busy' | 'offline') => Promise<void>;
  // Subscription helpers
  hasActiveAccess: () => boolean;
  isTrialing: () => boolean;
  isSubscribed: () => boolean;
  isExpired: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  let currentUserRequest: { token: string; promise: Promise<void> } | null = null;
  let subscriptionRequest: { token: string; promise: Promise<void> } | null = null;
  let restoreRequest: Promise<void> | null = null;
  let authGeneration = 0;

  // Pin the legacy shared session into this tab before other accounts can switch it.
  let hasAccessToken = false;
  if (typeof window !== 'undefined') {
    hasAccessToken = Boolean(getAuthValue('workgrind_access_token'));
  }

  return {
    user: null,
    company: null,
    subscription: null,
    subscriptionLoading: hasAccessToken,
    subscriptionError: null,
    isLoading: true,
    authError: null,
    isAuthenticated: false,
    trialDaysRemaining: null,

    setUser: (user) => {
      if (typeof window !== 'undefined') {
        if (user) setAuthValue('workgrind_user', JSON.stringify(user));
        else removeAuthValue('workgrind_user');
      }
      set({ user, isAuthenticated: !!user });
    },
    setCompany: (company) => set({ company }),

    canUse: (entitlement) => get().subscription?.entitlements?.[entitlement] ?? false,
        isAtLimit: (resource) => {
          const subscription = get().subscription;
          if (!subscription) return false;
          const limit = subscription.limits[resource];
          if (limit === -1) return false;
          const usage = resource === 'members'
            ? subscription.usage.memberSlotsUsed
            : resource === 'storage'
            ? subscription.usage.storageBytes
            : subscription.usage.aiRequests;
          return usage >= limit;
        },
    refreshSubscription: () => {
      const token = getAuthValue('workgrind_access_token');
      if (!token) {
        disconnectSocket();
        set({ subscription: null, subscriptionLoading: false, subscriptionError: null, trialDaysRemaining: null });
        return Promise.resolve();
      }
      if (subscriptionRequest?.token === token) return subscriptionRequest.promise;

      const request = { token, promise: Promise.resolve() };
      subscriptionRequest = request;
      request.promise = (async () => {
        set({ subscriptionLoading: true, subscriptionError: null });
        try {
          const res = await api.get('/subscription/status');
          if (res.data.success && getAuthValue('workgrind_access_token') === token) {
            const subscription = res.data.subscription as SubscriptionInfo;
            if (!subscription || typeof subscription.hasActiveAccess !== 'boolean') {
              throw new Error('Subscription status response was invalid.');
            }
            setAuthValue('workgrind_subscription', JSON.stringify(subscription));
            set({ subscription, subscriptionLoading: false, subscriptionError: null, trialDaysRemaining: subscription.trialDaysRemaining });
            if (subscription.hasActiveAccess) getSocket();
            else disconnectSocket();
          } else if (getAuthValue('workgrind_access_token') === token) {
            throw new Error('Subscription status response was invalid.');
          }
        } catch (err) {
          if (getAuthValue('workgrind_access_token') !== token) return;
          console.error('Failed to refresh subscription:', err);
          if (!get().subscription) disconnectSocket();
          set({
            subscription: get().subscription,
            subscriptionLoading: false,
            subscriptionError: 'Unable to verify your subscription. Please try again.',
          });
        } finally {
          if (subscriptionRequest === request) subscriptionRequest = null;
        }
      })();
      return request.promise;
    },

    hasActiveAccess: () => {
      return get().subscription?.hasActiveAccess === true;
    },
    isTrialing: () => get().subscription?.status === 'trialing',
    isSubscribed: () => {
      const subscription = get().subscription;
      return subscription?.status === 'active' ||
        subscription?.status === 'lifetime' ||
        ((subscription?.status === 'cancelled' || subscription?.status === 'past_due') && subscription.hasActiveAccess);
    },
    isExpired: () => {
      const subscription = get().subscription;
      return subscription?.status === 'expired' ||
        (subscription?.status === 'cancelled' && !subscription.hasActiveAccess);
    },

    login: (userData, accessToken) => {
      authGeneration += 1;
      const previousToken = getAuthValue('workgrind_access_token');
      const previousUserId = get().user?._id;
      if ((previousToken && previousToken !== accessToken) || (previousUserId && previousUserId !== userData._id)) {
        disconnectSocket();
        useCallingStore.getState().setActiveCall(null);
        useCallingStore.getState().setIncomingCall(null);
      }
      setAuthSession(accessToken, JSON.stringify(userData));
      removeAuthValue('workgrind_subscription');

      set({
        user: userData,
        company: typeof userData.companyId === 'object' ? (userData.companyId as Company) : null,
        subscription: null,
        subscriptionLoading: true,
        subscriptionError: null,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      void get().refreshSubscription();
    },

    logout: async () => {
      authGeneration += 1;
      const token = getAuthValue('workgrind_access_token');
      try {
        await api.post('/auth/logout', {});
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        if (token && getAuthValue('workgrind_access_token') !== token) return;
        clearAuthValues();
        disconnectSocket();
        useCallingStore.getState().setActiveCall(null);
        useCallingStore.getState().setIncomingCall(null);
        set({ user: null, company: null, subscription: null, subscriptionLoading: false, subscriptionError: null, isAuthenticated: false, isLoading: false, authError: null });
        window.location.href = '/login';
      }
    },

    restoreSession: () => {
      if (restoreRequest) return restoreRequest;
      if (get().user && getAuthValue('workgrind_access_token')) {
        set({ isLoading: false, authError: null });
        return Promise.resolve();
      }

      set({ isLoading: true, authError: null });
      const generation = authGeneration;
      restoreRequest = (async () => {
        try {
          if (!getAuthValue('workgrind_access_token')) {
            await refreshAuthTokens(null);
          }
          if (generation !== authGeneration) return;
          if (getAuthValue('workgrind_access_token')) {
            await get().fetchCurrentUser();
          } else {
            set({
              user: null,
              company: null,
              subscription: null,
              subscriptionLoading: false,
              subscriptionError: null,
              isAuthenticated: false,
              isLoading: false,
              authError: null,
            });
          }
        } catch (error) {
          if (generation !== authGeneration) return;
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            clearAuthValues();
            set({
              user: null,
              company: null,
              subscription: null,
              subscriptionLoading: false,
              subscriptionError: null,
              isAuthenticated: false,
              isLoading: false,
              authError: null,
            });
          } else {
            set({
              isLoading: false,
              authError: 'Unable to restore your session. Check your connection and retry.',
            });
          }
        } finally {
          restoreRequest = null;
        }
      })();
      return restoreRequest;
    },

    fetchCurrentUser: async () => {
      const token = getAuthValue('workgrind_access_token');
      if (!token) {
        await get().restoreSession();
        return;
      }

      if (currentUserRequest?.token === token) {
        await currentUserRequest.promise;
        return;
      }

      // Only show full blocking loader if we don't already have a cached user
      if (!get().user) {
        set({ isLoading: true });
      }

      const request = (async () => {
        try {
          const res = await api.get('/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const latestToken = getAuthValue('workgrind_access_token');
          const resolvedUser = res.data?.user as User | undefined;
          if (!latestToken) {
            set({ user: null, company: null, subscription: null, subscriptionLoading: false, subscriptionError: null, isAuthenticated: false, isLoading: false });
            return;
          }
          if (latestToken !== token) {
            if (!get().user) {
              set({ isLoading: true });
            }
            void get().fetchCurrentUser();
            return;
          }
          if (!res.data?.success || !resolvedUser?._id) {
            clearAuthValues();
            set({ user: null, company: null, subscription: null, subscriptionLoading: false, subscriptionError: null, isAuthenticated: false, isLoading: false });
            return;
          }

          setAuthValue('workgrind_user', JSON.stringify(resolvedUser));
          set({
            user: resolvedUser,
            company: typeof resolvedUser.companyId === 'object' ? resolvedUser.companyId : null,
            isAuthenticated: true,
            isLoading: false,
            authError: null,
            trialDaysRemaining: res.data.trialDaysRemaining ?? null,
          });
          await get().refreshSubscription();
        } catch (err: any) {
          const latestToken = getAuthValue('workgrind_access_token');
          if (!latestToken) {
            set({ user: null, company: null, subscription: null, subscriptionLoading: false, subscriptionError: null, isAuthenticated: false, isLoading: false });
            return;
          }
          if (latestToken !== token) {
            if (!get().user) {
              set({ isLoading: true });
            }
            void get().fetchCurrentUser();
            return;
          }
          // If offline, preserve cached user credentials instead of forcing logout
          if (typeof window !== 'undefined' && !navigator.onLine && get().user) {
            disconnectSocket();
            set({
              isLoading: false,
              isAuthenticated: true,
              subscription: null,
              subscriptionLoading: false,
              subscriptionError: 'Unable to verify your subscription while offline.',
            });
            return;
          }
          if (err?.response?.status === 401) {
            clearAuthValues();
            set({ user: null, company: null, subscription: null, subscriptionLoading: false, subscriptionError: null, isAuthenticated: false, isLoading: false, authError: null });
          } else if (!get().user) {
            set({
              isLoading: false,
              authError: 'Unable to restore your session. Check your connection and retry.',
            });
          } else {
            set({ isLoading: false });
          }
        }
      })();
      const trackedRequest = { token, promise: request };
      currentUserRequest = trackedRequest;
      try {
        await request;
      } finally {
        if (currentUserRequest === trackedRequest) currentUserRequest = null;
        if (getAuthValue('workgrind_access_token') === token && get().isLoading && get().user) {
          set({ isLoading: false });
        }
      }
    },

  updateUserStatus: async (status) => {
    const token = getAuthValue('workgrind_access_token');
    try {
      await api.patch('/users/me/status', { status });
      if (getAuthValue('workgrind_access_token') !== token) return;
      const currentUser = get().user;
      if (currentUser) {
        set({ user: { ...currentUser, status } });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  },
};
});
