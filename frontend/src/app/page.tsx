import { AISection } from '@/components/landing/AISection';
import { FeatureNetwork } from '@/components/landing/FeatureNetwork';
import { FeatureSections } from '@/components/landing/FeatureSections';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingPageClient } from '@/components/landing/LandingPageClient';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { SecuritySection } from '@/components/landing/SecuritySection';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function LandingPage() {
  return (
    <LandingPageClient>
      <HeroSection />
      <ProductShowcase />
      <FeatureNetwork />
      <FeatureSections />
      <AISection />
      <SecuritySection />
      <FinalCTA />
      <LandingFooter />
    </LandingPageClient>
  );
}
