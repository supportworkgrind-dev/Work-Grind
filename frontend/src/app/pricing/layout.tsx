import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WorkGrind Pricing | Plans for Each Workspace',
  description: 'Review Solo and Company plans alongside configured education pricing for School / Academy, College, and University workspaces.',
  openGraph: {
    title: 'WorkGrind Pricing',
    description: 'Plan availability, prices, and limits are provided by WorkGrind billing configuration.',
    url: '/pricing',
    siteName: 'WorkGrind',
    type: 'website',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
