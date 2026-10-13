import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About WorkGrind | Work and Learning in One Platform',
  description: 'Learn about WorkGrind workspaces for personal productivity, company collaboration, and academic administration.',
  openGraph: {
    title: 'About WorkGrind',
    description: 'Separate Solo, Company, School / Academy, College, and University workspaces.',
    url: '/about',
    siteName: 'WorkGrind',
    images: [{ url: '/workgrind-og.png', width: 1200, height: 630, alt: 'WorkGrind — Connected Workspaces for Work and Learning' }],
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
