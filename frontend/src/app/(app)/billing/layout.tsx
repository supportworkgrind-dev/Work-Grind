import type { Metadata } from 'next';
import { getBillingServerTranslator } from '@/components/billing/serverMessages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getBillingServerTranslator();
  return { title: t('meta.billingTitle') };
}

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
