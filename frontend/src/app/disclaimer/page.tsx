import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Disclaimer | WorkGrind' };

export default function DisclaimerPage() {
  return <LegalDocumentPage document={legalDocuments.disclaimer} />;
}
