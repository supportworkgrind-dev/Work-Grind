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

export function getAuthenticatedDestination(
  user: {
    companyId?: string | { organizationType?: string } | null;
    onboardingStatus?: 'pending' | 'completed';
  },
  returnTo?: string | null,
): string {
  const safeReturnPath = getSafeReturnPath(returnTo);
  if (safeReturnPath === '/join' || safeReturnPath?.startsWith('/join?') || safeReturnPath?.startsWith('/join#')) {
    return safeReturnPath;
  }
  if (!user.companyId) return getWorkspaceSetupDestination(safeReturnPath);
  if (user.onboardingStatus === 'pending') {
    return safeReturnPath ? `/onboarding?redirect=${encodeURIComponent(safeReturnPath)}` : '/onboarding';
  }
  if (safeReturnPath) return safeReturnPath;
  const company = typeof user.companyId === 'object' ? user.companyId : undefined;
  return company?.organizationType && company.organizationType !== 'business'
    ? '/academic'
    : '/dashboard';
}
