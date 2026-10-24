import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentStatusPage } from '@/components/billing/PaymentStatusPage';
import { getBillingServerTranslator } from '@/components/billing/serverMessages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getBillingServerTranslator();
  return { title: t('meta.paymentFailedTitle') };
}

export default function PaymentFailedPage() {
  return <Suspense><PaymentStatusPage mode="failed" /></Suspense>;
}
