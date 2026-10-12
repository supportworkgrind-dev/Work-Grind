export function getSafeReturnPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;

  try {
    const url = new URL(value, 'https://workgrind.invalid');
    if (url.origin !== 'https://workgrind.invalid') return undefined;
    if (['/login', '/signup', '/auth/callback', '/create-company', '/onboarding', '/verify-email'].includes(url.pathname)) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export function getWorkspaceSetupDestination(returnTo: string | null | undefined): string {
  const safeReturnPath = getSafeReturnPath(returnTo);
  return safeReturnPath ? `/create-company?redirect=${encodeURIComponent(safeReturnPath)}` : '/create-company';
}
