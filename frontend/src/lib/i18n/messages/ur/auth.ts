import type { Mirror } from '../../core';
import type { auth } from '../auth';

/** Urdu for the auth namespace; loaded only when Urdu is the active language. */
export const authUr: Mirror<typeof auth.en> = {
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
};
