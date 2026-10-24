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
  {
    join: {
      welcome: '{{workspace}} میں خوش آمدید! 🎉',
      welcomeFallback: 'ٹیم',
      activated: 'آپ کی رکنیت <role>{{role}}</role> کے کردار کے ساتھ فعال کر دی گئی ہے۔',
      redirectDashboard: 'آپ کو ٹیم ڈیش بورڈ پر لے جایا جا رہا ہے…',
      redirectAcademic: 'آپ کو آپ کی تعلیمی ورک اسپیس پر لے جایا جا رہا ہے…',
    },
    onboarding: {
      inviteRole: 'دعوت نامے کا کردار',
    },
  },
);
