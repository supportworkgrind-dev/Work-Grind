import type { Metadata } from 'next';
import HelpCenterContent from './HelpCenterContent';

export const metadata: Metadata = {
  title: 'Help Center | WorkGrind',
  description: 'Search public setup, workspace, education, billing, security, and troubleshooting guides for WorkGrind.',
  openGraph: {
    title: 'WorkGrind Help Center',
    description: 'Public how-to guides and troubleshooting for WorkGrind accounts and workspaces.',
    url: '/help',
  },
};

export default function HelpCenterPage() {
  return <HelpCenterContent />;
}
