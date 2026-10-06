import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Accessibility Statement | WorkGrind' };

export default function AccessibilityPage() {
  return <LegalDocumentPage document={legalDocuments.accessibility} />;
}
