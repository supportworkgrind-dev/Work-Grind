import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Security Policy | WorkGrind' };

export default function SecurityPage() {
  return <LegalDocumentPage document={legalDocuments.security} />;
}
