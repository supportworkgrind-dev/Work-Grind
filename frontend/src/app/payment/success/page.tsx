import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentStatusPage } from '@/components/billing/PaymentStatusPage';

export const metadata: Metadata = { title: 'Payment Status | WorkGrind' };

export default function PaymentSuccessPage() {
  return <Suspense><PaymentStatusPage mode="success" /></Suspense>;
}
