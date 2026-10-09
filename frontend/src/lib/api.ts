import axios from 'axios';
import { clearAuthValues, getAuthValue } from './authSession';
import { disconnectSocket, refreshSocketAuth } from './socket';
import { getApiBaseUrl } from './apiConfig';
import { refreshAuthTokens } from './tokenRefresh';

const API_BASE_URL = getApiBaseUrl();

export const clearAuthSession = ({ redirect = true } = {}) => {
  if (typeof window === 'undefined') return;
  clearAuthValues();
  disconnectSocket();
  if (redirect && window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
    window.location.href = '/login';
  }
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
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
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      const requestToken = originalRequest.headers?.Authorization;
      const currentToken = getAuthValue('workgrind_access_token');
      if (!currentToken || requestToken !== `Bearer ${currentToken}`) {
        if (failedPath.endsWith('/auth/me')) {
          console.warn('[Auth] Current-user request rejected; refresh was not attempted.', {
            path: failedPath,
            reason: !currentToken ? 'access_token_missing' : 'session_token_changed',
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
