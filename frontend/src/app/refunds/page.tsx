import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Refund Policy | WorkGrind' };

export default function RefundPolicyPage() {
  return <LegalDocumentPage document={legalDocuments.refunds} />;
}
