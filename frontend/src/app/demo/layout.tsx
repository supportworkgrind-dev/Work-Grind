import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request a WorkGrind Walkthrough',
  description: 'Tell us which WorkGrind workspace you are exploring and what you would like to understand.',
  openGraph: {
    title: 'Request a WorkGrind Walkthrough',
    description: 'Explore WorkGrind for personal productivity, business collaboration, or education.',
    url: '/demo',
    siteName: 'WorkGrind',
    type: 'website',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
