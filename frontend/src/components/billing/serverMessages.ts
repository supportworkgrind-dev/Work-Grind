import { cookies } from 'next/headers';
import {
  LANG_COOKIE, isLangCode, resolveMessage,
  type LangCode, type MessagePath, type TranslateVars,
} from '@/lib/i18n/core';
import { appMessagesEn, type NamespaceMessages } from '@/lib/i18n/messages';
import { appMessagesUr } from '@/lib/i18n/messages/ur';

const DICTIONARIES = { en: appMessagesEn, ur: appMessagesUr };

/**
 * Billing text for server components and generateMetadata, in the language
 * of the `workgrind_lang` cookie (English when it is missing or unknown).
 */
export async function getBillingServerTranslator() {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  const lang: LangCode = isLangCode(value) ? value : 'en';
  return (key: MessagePath<NamespaceMessages<'billing'>>, vars?: TranslateVars) =>
    resolveMessage(DICTIONARIES, lang, `billing.${key}`, vars);
}
