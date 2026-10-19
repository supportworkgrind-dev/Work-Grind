import type { AuthProviders } from '@/types';

export type SignInProvider = 'google' | 'linkedin';

export function isAuthProviderConnected(
  providers: Pick<AuthProviders, SignInProvider> | undefined,
  provider: SignInProvider,
): boolean {
  return providers?.[provider] === true;
}
