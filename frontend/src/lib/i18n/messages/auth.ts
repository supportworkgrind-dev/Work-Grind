import { defineMessages } from '../core';

/** Sign in, sign up, invitations, email verification, password reset, onboarding, workspace creation, OAuth callback. */
export const auth = defineMessages(
  {
    join: {
      welcome: 'Welcome to {{workspace}}! 🎉',
      welcomeFallback: 'the Team',
      activated: 'Your membership has been activated with role <role>{{role}}</role>.',
      redirectDashboard: 'Redirecting you to the team dashboard...',
      redirectAcademic: 'Redirecting you to your academic workspace...',
    },
    onboarding: {
      inviteRole: 'Invitation Role',
    },
  },
);
