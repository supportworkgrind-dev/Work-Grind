import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Terms of Service | WorkGrind' };

export default function TermsPage() {
  return <LegalDocumentPage document={legalDocuments.terms} />;
}
