import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Community Guidelines | WorkGrind' };

export default function CommunityGuidelinesPage() {
  return <LegalDocumentPage document={legalDocuments['community-guidelines']} />;
}
