import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { CookiePreferenceControl } from '@/components/legal/CookiePreferenceControl';
import { legalDocuments } from '@/lib/legalDocuments';

export const metadata: Metadata = { title: 'Cookie Preferences | WorkGrind' };

export default function CookiePreferencesPage() {
  return (
    <LegalDocumentPage document={legalDocuments.cookies}>
      <CookiePreferenceControl />
    </LegalDocumentPage>
  );
}
