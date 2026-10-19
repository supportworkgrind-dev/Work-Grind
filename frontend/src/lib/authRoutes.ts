const exactRoutesWithoutSessionRestore = new Set([
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/client-portal/login',
  '/client-portal/oauth/callback',
]);

export function shouldRestoreSessionOnRoute(pathname: string | null): boolean {
  return pathname !== null &&
    !exactRoutesWithoutSessionRestore.has(pathname) &&
    !pathname.startsWith('/reset-password/');
}
