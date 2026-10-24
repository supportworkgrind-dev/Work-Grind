'use client';

import { Share2 } from 'lucide-react';
import { SocialPublishingPanel } from '@/components/automation/SocialPublishingPanel';
import { PageHeader } from '@/components/common/PageHeader';
import { useT } from '@/lib/i18n';

export default function SocialPublishingPage() {
  const t = useT('socialPublishing');
  return (
    <div className="page-reveal space-y-5 pb-8">
      <PageHeader
        hero
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        icon={Share2}
      />
      <SocialPublishingPanel />
    </div>
  );
}
