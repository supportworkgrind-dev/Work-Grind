import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Privacy Policy | WorkGrind' };

export default function PrivacyPage() {
  return <LegalDocumentPage document={legalDocuments.privacy} />;
}
