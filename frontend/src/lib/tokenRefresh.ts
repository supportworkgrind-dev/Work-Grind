import axios from 'axios';
import { getAuthSessionVersion, getAuthValue, removeAuthValue, setAuthValue, updateAuthTokens } from './authSession';
import { getApiBaseUrl } from './apiConfig';

export interface RefreshedAuthTokens {
  accessToken: string;
}

let refreshInFlight: {
  expectedAccessToken: string | null;
  sessionVersion: number;
  promise: Promise<RefreshedAuthTokens>;
} | null = null;

export function refreshAuthTokens(expectedAccessToken: string | null): Promise<RefreshedAuthTokens> {
  const sessionVersion = getAuthSessionVersion();
  if (expectedAccessToken && getAuthValue('workgrind_access_token') !== expectedAccessToken) {
    return Promise.reject(new Error('Authentication session changed.'));
  }

  if (refreshInFlight) {
    if (
      refreshInFlight.sessionVersion === sessionVersion &&
      (refreshInFlight.expectedAccessToken === expectedAccessToken || expectedAccessToken === null)
    ) {
      return refreshInFlight.promise;
    }
    return refreshInFlight.promise.catch(() => undefined).then(() => {
      if (
        getAuthSessionVersion() !== sessionVersion ||
        (expectedAccessToken && getAuthValue('workgrind_access_token') !== expectedAccessToken)
      ) {
        throw new Error('Authentication session changed.');
      }
      return refreshAuthTokens(expectedAccessToken);
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Auth diagnostics] Starting a token refresh.', {
      reason: expectedAccessToken ? 'rejected-access-token' : 'session-restore',
    });
  }

  const legacyRefreshToken = getAuthValue('workgrind_refresh_token');

  const sendRefreshRequest = () => axios
    .post(`${getApiBaseUrl()}/auth/refresh`, legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}, { withCredentials: true })
    .then((response) => {
      const { accessToken } = response.data as Partial<RefreshedAuthTokens>;
      if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('Authentication refresh returned invalid tokens.');
      }
      if (
        getAuthSessionVersion() !== sessionVersion ||
        (expectedAccessToken && getAuthValue('workgrind_access_token') !== expectedAccessToken)
      ) {
        throw new Error('Authentication session changed during refresh.');
      }
      if (expectedAccessToken) updateAuthTokens(accessToken, expectedAccessToken);
      else setAuthValue('workgrind_access_token', accessToken);
      removeAuthValue('workgrind_refresh_token');
      return { accessToken };
    });

  const request = (async () => {
    if (
      getAuthSessionVersion() !== sessionVersion ||
      (expectedAccessToken && getAuthValue('workgrind_access_token') !== expectedAccessToken)
    ) {
      throw new Error('Authentication session changed.');
    }
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('workgrind-auth-refresh', sendRefreshRequest);
    }
    return sendRefreshRequest();
  })().finally(() => {
    if (refreshInFlight?.promise === request) refreshInFlight = null;
  });

  refreshInFlight = { expectedAccessToken, sessionVersion, promise: request };
  return request;
}
