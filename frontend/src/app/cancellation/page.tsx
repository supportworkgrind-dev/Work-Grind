import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Cancellation Policy | WorkGrind' };

export default function CancellationPolicyPage() {
  return <LegalDocumentPage document={legalDocuments.cancellation} />;
}
