import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Account Access | WorkGrind', template: '%s | WorkGrind' },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
