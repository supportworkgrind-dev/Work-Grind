import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact WorkGrind',
  description: 'Contact WorkGrind with questions about Solo, Company, School / Academy, College, or University workspaces.',
  openGraph: {
    title: 'Contact WorkGrind',
    description: 'Send a question about WorkGrind workspaces, plans, or support.',
    url: '/contact',
    siteName: 'WorkGrind',
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
