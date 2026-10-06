import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentStatusPage } from '@/components/billing/PaymentStatusPage';

export const metadata: Metadata = { title: 'Payment Pending | WorkGrind' };

export default function PaymentPendingPage() {
  return <Suspense><PaymentStatusPage mode="pending" /></Suspense>;
}
