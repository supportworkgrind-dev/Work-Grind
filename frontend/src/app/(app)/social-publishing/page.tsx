'use client';

import { Share2 } from 'lucide-react';
import { SocialPublishingPanel } from '@/components/automation/SocialPublishingPanel';
import { PageHeader } from '@/components/common/PageHeader';

export default function SocialPublishingPage() {
  return (
    <div className="page-reveal space-y-5 pb-8">
      <PageHeader
        hero
        title="Social Publishing"
        subtitle="Create, manage, and publish content across your social channels."
        icon={Share2}
      />
      <SocialPublishingPanel />
    </div>
  );
}
