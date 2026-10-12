import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'WorkGrind Account', template: '%s | WorkGrind' },
  description: 'Sign in or create a WorkGrind account, then choose the workspace that fits your personal, business, or academic work.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
