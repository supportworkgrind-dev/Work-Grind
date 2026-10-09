import axios from 'axios';
import { getAuthValue, removeAuthValue, setAuthValue, updateAuthTokens } from './authSession';
import { getApiBaseUrl } from './apiConfig';

export interface RefreshedAuthTokens {
  accessToken: string;
}

let refreshInFlight: { expectedAccessToken: string | null; promise: Promise<RefreshedAuthTokens> } | null = null;

export function refreshAuthTokens(expectedAccessToken: string | null): Promise<RefreshedAuthTokens> {
  if (expectedAccessToken && getAuthValue('workgrind_access_token') !== expectedAccessToken) {
    return Promise.reject(new Error('Authentication session changed.'));
  }

  if (refreshInFlight?.expectedAccessToken === expectedAccessToken) return refreshInFlight.promise;

  const legacyRefreshToken = getAuthValue('workgrind_refresh_token');

  const request = axios
    .post(`${getApiBaseUrl()}/auth/refresh`, legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}, { withCredentials: true })
    .then((response) => {
      const { accessToken } = response.data as Partial<RefreshedAuthTokens>;
      if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('Authentication refresh returned invalid tokens.');
      }
      if (expectedAccessToken && getAuthValue('workgrind_access_token') !== expectedAccessToken) {
        throw new Error('Authentication session changed during refresh.');
      }
      if (expectedAccessToken) updateAuthTokens(accessToken, expectedAccessToken);
      else setAuthValue('workgrind_access_token', accessToken);
      removeAuthValue('workgrind_refresh_token');
      return { accessToken };
    })
    .finally(() => {
      if (refreshInFlight?.promise === request) refreshInFlight = null;
    });

  refreshInFlight = { expectedAccessToken, promise: request };
  return request;
}
