export type AuthStorageKey =
  | 'workgrind_access_token'
  | 'workgrind_refresh_token'
  | 'workgrind_user'
  | 'workgrind_subscription';

const AUTH_STORAGE_KEYS: AuthStorageKey[] = [
  'workgrind_access_token',
  'workgrind_refresh_token',
  'workgrind_user',
  'workgrind_subscription',
];

function removeLegacyAuthValues(): void {
  if (typeof window === 'undefined') return;
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

export function getAuthValue(key: AuthStorageKey): string | null {
  if (typeof window === 'undefined') return null;
  removeLegacyAuthValues();
  return sessionStorage.getItem(key);
}

export function setAuthValue(key: AuthStorageKey, value: string): void {
  if (typeof window === 'undefined') return;
  removeLegacyAuthValues();
  sessionStorage.setItem(key, value);
}

export function setAuthSession(accessToken: string, refreshToken: string, user: string): void {
  if (typeof window === 'undefined') return;
  removeLegacyAuthValues();
  setAuthValue('workgrind_access_token', accessToken);
  setAuthValue('workgrind_refresh_token', refreshToken);
  setAuthValue('workgrind_user', user);
}

export function updateAuthTokens(accessToken: string, refreshToken: string, previousToken: string): void {
  if (typeof window === 'undefined') return;
  removeLegacyAuthValues();
  if (sessionStorage.getItem('workgrind_access_token') !== previousToken) return;
  setAuthValue('workgrind_access_token', accessToken);
  setAuthValue('workgrind_refresh_token', refreshToken);
}

export function removeAuthValue(key: AuthStorageKey): void {
  if (typeof window === 'undefined') return;
  removeLegacyAuthValues();
  sessionStorage.removeItem(key);
}

export function clearAuthValues(): void {
  if (typeof window === 'undefined') return;
  removeLegacyAuthValues();
  for (const key of AUTH_STORAGE_KEYS) {
    sessionStorage.removeItem(key);
  }
}
