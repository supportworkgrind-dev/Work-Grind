import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Data Processing Agreement | WorkGrind' };

export default function DataProcessingAgreementPage() {
  return <LegalDocumentPage document={legalDocuments.dpa} />;
}
