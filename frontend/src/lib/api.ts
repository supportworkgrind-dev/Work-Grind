import axios from 'axios';
import { clearAuthValues, getAuthValue } from './authSession';
import { disconnectSocket, refreshSocketAuth } from './socket';
import { getApiBaseUrl } from './apiConfig';
import { refreshAuthTokens } from './tokenRefresh';

const API_BASE_URL = getApiBaseUrl();

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return;
  clearAuthValues();
  disconnectSocket();
  window.dispatchEvent(new Event('workgrind:auth-session-expired'));
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const duplicateRequestCounts = new Map<string, number>();
const requestKeys = new WeakMap<object, string>();

function trackRequest(config: object & { method?: string; url?: string }): void {
  if (process.env.NODE_ENV === 'production') return;
  const key = `${(config.method || 'GET').toUpperCase()} ${config.url || ''}`;
  const active = duplicateRequestCounts.get(key) ?? 0;
  duplicateRequestCounts.set(key, active + 1);
  requestKeys.set(config, key);
  if (active > 0) {
    console.debug('[Request diagnostics] Concurrent duplicate API request.', {
      method: (config.method || 'GET').toUpperCase(),
      activeRequests: active + 1,
    });
  }
}

function finishRequest(config?: object): void {
  if (process.env.NODE_ENV === 'production' || !config) return;
  const key = requestKeys.get(config);
  if (!key) return;
  requestKeys.delete(config);
  const active = duplicateRequestCounts.get(key) ?? 0;
  if (active <= 1) duplicateRequestCounts.delete(key);
  else duplicateRequestCounts.set(key, active - 1);
}

api.interceptors.request.use(
  (config) => {
    trackRequest(config);
    if (typeof window !== 'undefined') {
      if (!config.headers.Authorization) {
        const token = getAuthValue('workgrind_access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    finishRequest(response.config);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    finishRequest(originalRequest);
    const responseData = error.response?.data;
    const failedPath = typeof originalRequest?.url === 'string'
      ? new URL(originalRequest.url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).pathname
      : '';
    if (
      typeof window !== 'undefined' &&
      (responseData?.requiresUpgrade || responseData?.code === 'PLAN_UPGRADE_REQUIRED')
    ) {
      window.dispatchEvent(new CustomEvent('workgrind:upgrade-required', {
        detail: { message: responseData.message || 'Upgrade your plan to continue.' },
      }));
    }
    if (
      typeof window !== 'undefined' &&
      responseData?.code === 'SUBSCRIPTION_REQUIRED' &&
      responseData?.source !== 'client_portal'
    ) {
      disconnectSocket();
      window.dispatchEvent(new CustomEvent('workgrind:subscription-required', {
        detail: responseData,
      }));
    }
    const authEndpointDoesNotRefresh = [
      '/auth/login',
      '/auth/logout',
      '/auth/refresh',
      '/auth/signup',
      '/auth/register',
      '/auth/google',
      '/auth/google/callback',
      '/auth/verify-email',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/resend-verification',
    ].some((path) => failedPath.endsWith(path));
    if (
      originalRequest &&
      error.response?.status === 401 &&
      !authEndpointDoesNotRefresh &&
      !originalRequest._retry &&
      typeof window !== 'undefined'
    ) {
      const requestToken = originalRequest.headers?.Authorization;
      const currentToken = getAuthValue('workgrind_access_token');
      if (requestToken && (!currentToken || requestToken !== `Bearer ${currentToken}`)) {
        if (failedPath.endsWith('/auth/me')) {
          console.warn('[Auth] Current-user request rejected; refresh was not attempted.', {
            path: failedPath,
            reason: 'session_token_changed',
          });
        }
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      if (failedPath.endsWith('/auth/me')) {
        console.info('[Auth] Refreshing an access token after current-user request was rejected.', {
          path: failedPath,
        });
      }
      try {
        const { accessToken } = await refreshAuthTokens(currentToken);
        if (getAuthValue('workgrind_access_token') !== accessToken) {
          return Promise.reject(error);
        }
        refreshSocketAuth(accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        if (failedPath.endsWith('/auth/me')) {
          console.info('[Auth] Access token refreshed; retrying current-user request.', {
            path: failedPath,
          });
        }
        return api(originalRequest);
      } catch (refreshError) {
        if (failedPath.endsWith('/auth/me')) {
          console.warn('[Auth] Current-user token refresh failed.', {
            path: failedPath,
            refreshStatus: axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined,
          });
        }
        if (
          axios.isAxiosError(refreshError) &&
          refreshError.response?.status === 401 &&
          getAuthValue('workgrind_access_token') === currentToken
        ) {
          clearAuthSession();
        }
      }
    }
    return Promise.reject(error);
  }
);

export const aiRouter = {
  async decide(feature: import('../services/aiRequestRouter').AIFeature, payload?: any) {
    const { decideRoute } = await import('../services/aiRequestRouter');
    return decideRoute(feature, payload);
  },

  async tryLocal(feature: import('../services/aiRequestRouter').AIFeature, input: any) {
    const { processLocalIfPossible } = await import('../services/aiRequestRouter');
    return processLocalIfPossible(feature, input);
  },
};
