import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Acceptable Use Policy | WorkGrind' };

export default function AcceptableUsePage() {
  return <LegalDocumentPage document={legalDocuments['acceptable-use']} />;
}
