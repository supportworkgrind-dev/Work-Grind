export type TavroLanguagePreference = 'en' | 'ur' | 'ar' | 'fr' | 'de' | 'es' | 'zh' | 'hi';

const LANGUAGE_NAMES: Record<TavroLanguagePreference, string> = {
  en: 'English',
  ur: 'Urdu',
  ar: 'Arabic',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  zh: 'Chinese',
  hi: 'Hindi',
};

const ROMAN_URDU_MARKERS = new Set([
  'aap', 'ap', 'bhai', 'batao', 'hain', 'haan', 'karain', 'karein', 'karun',
  'kese', 'kaisay', 'mein', 'meri', 'mujhe', 'nahin', 'nahi', 'raha', 'rahi',
  'unhain',
]);

export function detectTavroMessageLanguage(message: string): 'English' | 'Urdu script' | 'Hindi (Devanagari)' | 'Arabic' | 'Roman Urdu' | null {
  if (/[\u0900-\u097f]/u.test(message)) return 'Hindi (Devanagari)';

  if (/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(message)) {
    return /[\u0679\u0688\u0691\u0698\u06ba\u06be\u06c1\u06d2\u0686\u06af\u067e]/u.test(message)
      ? 'Urdu script'
      : 'Arabic';
  }

  const tokens = message.toLocaleLowerCase().match(/[a-z]+/gu) ?? [];
  const markerCount = new Set(tokens.filter((token) => ROMAN_URDU_MARKERS.has(token))).size;
  if (markerCount >= 2 || /\bkar\s+(?:do|dein|den)\b/u.test(message.toLocaleLowerCase())) {
    return 'Roman Urdu';
  }
  const englishMarkers = new Set([
    'are', 'can', 'could', 'does', 'for', 'how', 'is', 'my', 'please', 'the',
    'this', 'that', 'when', 'where', 'what', 'with', 'would', 'you',
  ]);
  if (new Set(tokens.filter((token) => englishMarkers.has(token))).size >= 2) return 'English';
  return null;
}

export function buildLanguageInstruction(
  message: string,
  preference?: TavroLanguagePreference,
): string {
  const detected = detectTavroMessageLanguage(message);
  const preferenceName = preference ? LANGUAGE_NAMES[preference] : undefined;
  const detectedInstruction = detected
    ? `The latest message is ${detected}; answer in ${detected}${detected === 'Roman Urdu' ? ' using Latin letters, not Devanagari' : ''}.`
    : 'Infer the language and writing system from the latest user message and answer in that same language and script.';
  const preferenceInstruction = preferenceName
    ? ` The user's saved language preference is ${preferenceName}; use it only when the latest message is too short or ambiguous to identify a language.`
    : '';

  return `## Language matching — apply to every answer
${detectedInstruction}${preferenceInstruction}
The latest user message takes priority over conversation history, browser locale, workspace location, and the saved preference. Follow an explicit language or script request in the latest message. Detect language anew on every turn. Roman Urdu is Urdu written in Latin letters: do not translate it into Hindi or Devanagari. Urdu written in Arabic-derived script must be answered in Urdu script; Hindi written in Devanagari must be answered in Devanagari. For other languages, mirror the user's language and script. Preserve product names, technical terms, and code identifiers where useful. Match the user's formality and style.`;
}
