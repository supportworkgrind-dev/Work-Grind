import type { Metadata } from 'next';
import { getBillingServerTranslator } from '@/components/billing/serverMessages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getBillingServerTranslator();
  return {
    title: t('meta.pricingTitle'),
    description: t('meta.pricingDescription'),
    openGraph: {
      title: t('meta.pricingOgTitle'),
      description: t('meta.pricingOgDescription'),
      url: '/pricing',
      siteName: 'WorkGrind',
      images: [{ url: '/workgrind-og.png', width: 1200, height: 630, alt: t('meta.ogImageAlt') }],
      type: 'website',
    },
  };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
