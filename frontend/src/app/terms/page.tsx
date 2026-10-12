import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = {
  title: 'Terms of Service | WorkGrind',
  description: 'Terms for using WorkGrind Solo, Company, School / Academy, College, and University workspaces.',
};

export default function TermsPage() {
  return <LegalDocumentPage document={legalDocuments.terms} />;
}
