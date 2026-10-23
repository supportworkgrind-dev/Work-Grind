/**
 * Hand-off for the short-lived (5 minute) MFA sign-in challenge between the
 * OAuth callback and the login page. Kept in sessionStorage, never in the URL,
 * and removed as soon as it is read.
 */

const KEY = 'workgrind_mfa_challenge';

type StoredChallenge = { token: string; returnTo?: string };

export function storeMfaChallenge(token: string, returnTo?: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, ...(returnTo ? { returnTo } : {}) }));
  } catch {
    // Storage unavailable: the login page will ask the user to sign in again.
  }
}

export function takeMfaChallenge(): StoredChallenge | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChallenge;
    return typeof parsed.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
