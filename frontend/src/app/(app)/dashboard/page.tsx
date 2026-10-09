'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/common/LoadingSkeleton';
import { LazyPageErrorBoundary } from '@/components/common/LazyPageErrorBoundary';

const DashboardPageContent = dynamic(() => import('@/components/dashboard/DashboardPageContent'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function DashboardPage() {
  return (
    <LazyPageErrorBoundary>
      <DashboardPageContent />
    </LazyPageErrorBoundary>
  );
}
