import { expect, test } from '@playwright/test';
import { getAuthenticatedDestination } from '../src/lib/authRedirect';
import { isAuthProviderConnected } from '../src/lib/authProviderStatus';

test('Settings reports Google sign-in only from the backend provider status', () => {
  expect(isAuthProviderConnected({ google: true, linkedin: false }, 'google')).toBe(true);
  expect(isAuthProviderConnected({ google: false, linkedin: true }, 'google')).toBe(false);
  expect(isAuthProviderConnected(undefined, 'google')).toBe(false);
});

test('Google sign-in status does not imply a LinkedIn connection', () => {
  expect(isAuthProviderConnected({ google: true, linkedin: false }, 'linkedin')).toBe(false);
});

test('returning business users go to their existing workspace', () => {
  expect(getAuthenticatedDestination({
    companyId: { organizationType: 'business' },
    onboardingStatus: 'completed',
  })).toBe('/dashboard');
});

test('returning education users go to the academic workspace', () => {
  for (const organizationType of ['school', 'college', 'university']) {
    expect(getAuthenticatedDestination({
      companyId: { organizationType },
      onboardingStatus: 'completed',
    })).toBe('/academic');
  }
});

test('users with incomplete setup resume onboarding and preserve safe return paths', () => {
  expect(getAuthenticatedDestination({
    companyId: 'workspace-id',
    onboardingStatus: 'pending',
  }, '/projects?view=mine')).toBe('/onboarding?redirect=%2Fprojects%3Fview%3Dmine');
});

test('users without a workspace continue setup without losing a safe invitation return', () => {
  expect(getAuthenticatedDestination({}, '/join?token=invite-token'))
    .toBe('/join?token=invite-token');
  expect(getAuthenticatedDestination({}, '//attacker.example')).toBe('/create-company');
});

test('invitation destinations are preserved for authenticated members', () => {
  expect(getAuthenticatedDestination({
    companyId: { organizationType: 'school' },
    onboardingStatus: 'completed',
  }, '/join?token=invite-token')).toBe('/join?token=invite-token');
});
