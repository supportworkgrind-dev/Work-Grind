import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Responsible Disclosure | WorkGrind' };

export default function ResponsibleDisclosurePage() {
  return <LegalDocumentPage document={legalDocuments['responsible-disclosure']} />;
}
