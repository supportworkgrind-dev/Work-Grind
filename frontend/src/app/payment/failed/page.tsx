import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentStatusPage } from '@/components/billing/PaymentStatusPage';

export const metadata: Metadata = { title: 'Payment Failed | WorkGrind' };

export default function PaymentFailedPage() {
  return <Suspense><PaymentStatusPage mode="failed" /></Suspense>;
}
