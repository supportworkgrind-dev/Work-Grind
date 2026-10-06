/**
 * WorkGrind Gemini Service
 *
 * Centralised wrapper around the Google GenAI SDK.
 * All API calls go through this module — the key never leaves the server.
 *
 * Security:
 *   - GEMINI_API_KEY is read from process.env only.
 *   - It is never logged, returned to clients, or exposed anywhere.
 *   - The client is lazily initialised so startup is not slowed.
 */

import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';

// ── Model configuration ───────────────────────────────────────────────────────
// Google deprecates older Gemini names over time. Keep a safe default and
// normalize legacy values to a currently supported model so AI requests do not
// fail silently with a generic "temporarily unavailable" response.
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

function normalizeGeminiModel(model?: string): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_GEMINI_MODEL;

  const legacyMap: Record<string, string> = {
    'gemini-2.0-flash': DEFAULT_GEMINI_MODEL,
    'gemini-2.0-flash-lite': DEFAULT_GEMINI_MODEL,
    'gemini-2.0-flash-001': DEFAULT_GEMINI_MODEL,
    'gemini-2.0-flash-latest': DEFAULT_GEMINI_MODEL,
    'gemini-2.5-flash-lite': DEFAULT_GEMINI_MODEL,
    'gemini-3.6-flash': DEFAULT_GEMINI_MODEL,
    'gemini-3.6-flash-preview': DEFAULT_GEMINI_MODEL,
  };

  return legacyMap[trimmed] ?? trimmed;
}

export const GEMINI_MODEL = normalizeGeminiModel(process.env.GEMINI_MODEL);
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
export const CLOUDFLARE_AI_MODEL = process.env.CLOUDFLARE_AI_MODEL?.trim() || '@cf/openai/gpt-oss-20b';
export const AI_REQUEST_TIMEOUT_MS = Math.min(
  50_000,
  Math.max(5_000, Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45_000),
);

// ── Client singleton ──────────────────────────────────────────────────────────
let _genai: GoogleGenAI | null = null;
let _openai: OpenAI | null = null;
let _cloudflareAI: OpenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!_genai) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY is not set. Add it to your backend .env file.'
      );
    }
    _genai = new GoogleGenAI({ apiKey: key });
  }
  return _genai;
}

/** True if the Gemini API key is configured. */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error('OPENAI_API_KEY is not configured.');
    _openai = new OpenAI({ apiKey: key, timeout: AI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
  }
  return _openai;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getCloudflareAI(): OpenAI {
  if (!_cloudflareAI) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
    if (!accountId || !apiToken) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
    }
    _cloudflareAI = new OpenAI({
      apiKey: apiToken,
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1`,
      timeout: AI_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return _cloudflareAI;
}

export function isCloudflareAIConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim());
}

export function safeAIErrorLog(error: any): {
  message: string;
  status?: number;
  code?: string;
  category: AIErrorCategory;
} {
  const raw = String(error?.message ?? error ?? 'Unknown provider error');
  const message = raw
    .replace(/AIza[\w-]{20,}/g, '[redacted-key]')
    .replace(/sk-[\w-]{16,}/g, '[redacted-key]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');

  return { message, status: error?.status ?? error?.statusCode, code: error?.code, category: classifyAIError(error, message) };
}

export type AIErrorCategory =
  | 'AUTHENTICATION'
  | 'QUOTA'
  | 'RATE_LIMIT'
  | 'INVALID_MODEL'
  | 'BAD_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'PROVIDER_ERROR'
  | 'CONFIGURATION';

const AI_ERROR_CATEGORIES = new Set<AIErrorCategory>([
  'AUTHENTICATION', 'QUOTA', 'RATE_LIMIT', 'INVALID_MODEL', 'BAD_REQUEST',
  'TIMEOUT', 'NETWORK', 'PROVIDER_ERROR', 'CONFIGURATION',
]);

export function classifyAIError(error: any, safeMessage?: string): AIErrorCategory {
  const storedCategory = error?.category as AIErrorCategory | undefined;
  if (storedCategory && AI_ERROR_CATEGORIES.has(storedCategory)) return storedCategory;
  const message = (safeMessage ?? String(error?.message ?? error ?? '')).toLowerCase();
  const status = error?.status ?? error?.statusCode;
  const code = String(error?.code ?? '').toUpperCase();
  if (/api key is not set|not configured|missing.*credential/.test(message)) return 'CONFIGURATION';
  if (status === 401 || status === 403 || code === 'UNAUTHENTICATED' || /authentication|unauthorized|invalid.*key/.test(message)) return 'AUTHENTICATION';
  if (status === 429 || code === 'RESOURCE_EXHAUSTED') return /quota|credit|resource_exhausted/.test(message) ? 'QUOTA' : 'RATE_LIMIT';
  if (status === 404 && /model/.test(message) || status === 400 && /model.*(not found|does not exist)/.test(message)) return 'INVALID_MODEL';
  if (status === 400 || code === 'INVALID_ARGUMENT') return 'BAD_REQUEST';
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || code === 'ETIMEDOUT' || /timed out|abort/.test(message)) return 'TIMEOUT';
  if (/econn|enotfound|socket|network|fetch failed/.test(message)) return 'NETWORK';
  return 'PROVIDER_ERROR';
}

export type PrimaryAIProvider = 'gemini' | 'openai';
export type AIProvider = PrimaryAIProvider | 'cloudflare';

export function getConfiguredAIProviders(): PrimaryAIProvider[] {
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase();
  const order: PrimaryAIProvider[] = preferred === 'openai'
    ? ['openai', 'gemini']
    : ['gemini', 'openai'];
  return order.filter((provider) => provider === 'gemini'
    ? isGeminiConfigured()
    : isOpenAIConfigured());
}

export function getConfiguredAgentAIProviders(): AIProvider[] {
  const primaryProviders = getConfiguredAIProviders();
  const cloudflareConfigured = isCloudflareAIConfigured();
  const preferCloudflare = process.env.AI_PROVIDER?.trim().toLowerCase() === 'cloudflare';
  if (preferCloudflare && cloudflareConfigured) return ['cloudflare', ...primaryProviders];
  if (primaryProviders.length === 0) return [];
  return cloudflareConfigured ? [...primaryProviders, 'cloudflare'] : primaryProviders;
}

/**
 * Safe startup log — reports whether the key exists, never its value.
 */
export function logGeminiConfig(): void {
  const providers = getConfiguredAgentAIProviders();
  if (providers.length > 0) {
    console.log(`[Tavro AI] Configured providers: ${providers.join(', ')} (Gemini model: "${GEMINI_MODEL}", OpenAI model: "${OPENAI_MODEL}")`);
  } else {
    console.warn('[Tavro AI] No provider API key configured. General AI responses are unavailable until Gemini or OpenAI is configured.');
  }
}

// ── Topic guard ───────────────────────────────────────────────────────────────
// Backend-side relevance check so clearly off-topic requests never reach Gemini.

const WORKGRIND_KEYWORDS = [
  'task', 'tasks', 'todo', 'project', 'projects', 'meeting', 'meetings',
  'crm', 'contact', 'contacts', 'deal', 'deals', 'company', 'companies',
  'pipeline', 'client', 'clients', 'customer', 'customers', 'lead', 'leads',
  'chat', 'message', 'channel', 'dm', 'direct message',
  'calendar', 'event', 'schedule', 'appointment',
  'file', 'files', 'document', 'docs', 'folder',
  'team', 'member', 'members', 'colleague', 'workspace',
  'notification', 'reminder', 'deadline', 'due',
  'billing', 'subscription', 'plan', 'upgrade',
  'workgrind', 'dashboard', 'overview', 'analytics', 'report',
  'ai assistant', 'assistant', 'help me', 'show me', 'find', 'search',
  'create', 'update', 'delete', 'assign', 'invite', 'summarize', 'summary',
  'what', 'how', 'which', 'who', 'when', 'where', 'why',
  'list', 'get', 'fetch', 'today', 'tomorrow', 'week', 'overdue',
  'priority', 'status', 'progress', 'activity',
];

const CLEARLY_OFFTOPIC = [
  /\bweather\b/i,
  /\brecipe\b/i,
  /\bcooking\b/i,
  /\bsport(s)?\b/i,
  /\bfootball\b/i,
  /\bbasketball\b/i,
  /\bcricket\b/i,
  /\bstock market\b/i,
  /\bbitcoin\b/i,
  /\bcrypto\b/i,
  /\bmovie(s)?\b/i,
  /\bnetflix\b/i,
  /\bmusic\b/i,
  /\bjoke(s)?\b/i,
  /\bpoetry\b/i,
  /\bpoem\b/i,
  /\bwrite (a|an) story\b/i,
  /\bpolitics\b/i,
  /\belection\b/i,
  /\bnews\b/i,
  /\bgossip\b/i,
  /\bhoroscope\b/i,
];

/**
 * Returns true if the message is clearly unrelated to WorkGrind business topics.
 * We don't use this to over-censor — only obvious non-work requests are blocked.
 */
export function isOffTopic(message: string): boolean {
  const lower = message.toLowerCase();

  // If it matches a clearly off-topic pattern and has no WorkGrind keyword, reject
  const matchesOffTopic = CLEARLY_OFFTOPIC.some(re => re.test(lower));
  if (!matchesOffTopic) return false;

  const hasWorkGrindTopic = WORKGRIND_KEYWORDS.some(kw => lower.includes(kw));
  return !hasWorkGrindTopic;
}

export const OFF_TOPIC_REPLY =
  "That request is outside WorkGrind's workspace and business features. " +
  "I can help with your CRM, tasks, projects, meetings, team, documents, and other WorkGrind features.";

// ── Re-export Type for function-declaration schemas ───────────────────────────
export { Type };
