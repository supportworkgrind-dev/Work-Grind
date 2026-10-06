import { isOffTopic, OFF_TOPIC_REPLY } from './geminiService';

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |previous|above)\s+(instructions?|rules?|system)\b/i,
  /pretend you are\b/i,
  /<\s*system\s*>/i,
  /jailbreak\b/i,
  /act as (if )?though\b/i,
  /repeat.*words?( back)? verbatim\b/i,
];

const PROMPT_INJECTION_KEYWORDS: RegExp[] = [
  /ignore (all |previous|above)\s+(instructions?|rules?|system)/i,
  /pretend you are/i,
  /<\s*system\s*>/i,
  /jailbreak/i,
  /act as (if )?though/i,
  /repeat.*words?( back)? verbatim/i,
];

export function detectPromptInjection(text: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((re) => re.test(text));
}

export function stripUnsafeContent(text: string): string {
  let lines = text.split('\n');
  lines = lines.filter((line) => !PROMPT_INJECTION_KEYWORDS.some((re) => re.test(line)));
  let result = lines.join('\n');
  result = result.replace(/<[^>]+>/g, '');
  result = result.replace(/[A-Za-z0-9+/=]{200,}/g, '');
  return result.trim();
}

export function validateWorkGrindQuery(text: string): {
  allowed: boolean;
  reason?: string;
  sanitizedText: string;
} {
  if (text.length > 4000) {
    return { allowed: false, reason: 'Query too long.', sanitizedText: stripUnsafeContent(text) };
  }
  if (detectPromptInjection(text)) {
    return { allowed: false, reason: OFF_TOPIC_REPLY, sanitizedText: stripUnsafeContent(text) };
  }
  if (isOffTopic(text)) {
    return { allowed: false, reason: OFF_TOPIC_REPLY, sanitizedText: stripUnsafeContent(text) };
  }
  return { allowed: true, sanitizedText: stripUnsafeContent(text) };
}

export { OFF_TOPIC_REPLY };
