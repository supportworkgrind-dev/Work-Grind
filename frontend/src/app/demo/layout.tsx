import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request a WorkGrind Walkthrough',
  description: 'Tell us which WorkGrind workspace you are exploring and what you would like to understand.',
  openGraph: {
    title: 'Request a WorkGrind Walkthrough',
    description: 'Explore WorkGrind for personal productivity, business collaboration, or education.',
    url: '/demo',
    siteName: 'WorkGrind',
    images: [{ url: '/workgrind-og.png', width: 1200, height: 630, alt: 'WorkGrind — Connected Workspaces for Work and Learning' }],
    type: 'website',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
