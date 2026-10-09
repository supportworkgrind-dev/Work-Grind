'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/common/LoadingSkeleton';
import { LazyPageErrorBoundary } from '@/components/common/LazyPageErrorBoundary';

const SheetsPageContent = dynamic(() => import('@/components/sheets/SheetsPageContent'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function SheetsPage() {
  return (
    <LazyPageErrorBoundary>
      <SheetsPageContent />
    </LazyPageErrorBoundary>
  );
}
