import axios from 'axios';
import { getAuthValue, updateAuthTokens } from './authSession';
import { getApiBaseUrl } from './apiConfig';

export interface RefreshedAuthTokens {
  accessToken: string;
  refreshToken: string;
}

let refreshInFlight: { expectedAccessToken: string; promise: Promise<RefreshedAuthTokens> } | null = null;

export function refreshAuthTokens(expectedAccessToken: string): Promise<RefreshedAuthTokens> {
  if (getAuthValue('workgrind_access_token') !== expectedAccessToken) {
    return Promise.reject(new Error('Authentication session changed.'));
  }

  if (refreshInFlight?.expectedAccessToken === expectedAccessToken) return refreshInFlight.promise;

  const currentRefreshToken = getAuthValue('workgrind_refresh_token');
  if (!currentRefreshToken) {
    return Promise.reject(new Error('Refresh token is unavailable.'));
  }

  const request = axios
    .post(`${getApiBaseUrl()}/auth/refresh`, { refreshToken: currentRefreshToken }, { withCredentials: true })
    .then((response) => {
      const { accessToken, refreshToken } = response.data as Partial<RefreshedAuthTokens>;
      if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken) {
        throw new Error('Authentication refresh returned invalid tokens.');
      }
      if (
        getAuthValue('workgrind_access_token') !== expectedAccessToken ||
        getAuthValue('workgrind_refresh_token') !== currentRefreshToken
      ) {
        throw new Error('Authentication session changed during refresh.');
      }
      updateAuthTokens(accessToken, refreshToken, expectedAccessToken);
      return { accessToken, refreshToken };
    })
    .finally(() => {
      if (refreshInFlight?.promise === request) refreshInFlight = null;
    });

  refreshInFlight = { expectedAccessToken, promise: request };
  return request;
}
