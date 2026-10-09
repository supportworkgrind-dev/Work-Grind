'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/common/LoadingSkeleton';
import { LazyPageErrorBoundary } from '@/components/common/LazyPageErrorBoundary';

const AnalyticsPageContent = dynamic(() => import('@/components/analytics/AnalyticsPageContent'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function AnalyticsPage() {
  return (
    <LazyPageErrorBoundary>
      <AnalyticsPageContent />
    </LazyPageErrorBoundary>
  );
}
