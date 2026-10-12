import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About WorkGrind | Work and Learning in One Platform',
  description: 'Learn about WorkGrind workspaces for personal productivity, company collaboration, and academic administration.',
  openGraph: {
    title: 'About WorkGrind',
    description: 'Separate Solo, Company, School / Academy, College, and University workspaces.',
    url: '/about',
    siteName: 'WorkGrind',
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
