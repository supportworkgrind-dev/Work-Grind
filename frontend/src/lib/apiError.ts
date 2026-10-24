/**
 * Classifies a failed API request so the UI can show the right state: access
 * and plan refusals are final (no Retry), while network, timeout, rate-limit,
 * and server failures are recoverable (Retry). Expired sessions are handled by
 * the API client's refresh flow and surface here only when that also failed.
 *
 * Messages follow the interface language. The API answers in English, so in
 * other languages a known error code shows its translated message and any
 * other failure shows a translated message for its kind.
 */
import { getActiveLanguage, translate } from '@/lib/i18n/core';

export type ApiErrorKind =
  | 'forbidden'
  | 'plan'
  | 'subscription'
  | 'unauthorized'
  | 'invalid'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'cancelled';

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  message: string;
  retryable: boolean;
  status?: number;
  code?: string;
}

type AxiosLike = {
  code?: string;
  name?: string;
  message?: string;
  config?: { url?: string; method?: string };
  response?: { status?: number; data?: unknown };
};

function responseBody(data: unknown): { message?: string; code?: string } {
  if (typeof data === 'string') {
    try { return JSON.parse(data) as { message?: string; code?: string }; } catch { return {}; }
  }
  return data && typeof data === 'object' ? data as { message?: string; code?: string } : {};
}

const KIND_MESSAGE_KEYS: Record<ApiErrorKind, string> = {
  forbidden: 'common.errors.forbidden',
  plan: 'common.apiCodes.PLAN_UPGRADE_REQUIRED',
  subscription: 'common.apiCodes.SUBSCRIPTION_REQUIRED',
  unauthorized: 'common.errors.unauthorized',
  invalid: 'common.errors.generic',
  rate_limited: 'common.errors.rateLimited',
  server: 'common.errors.server',
  timeout: 'common.errors.timeout',
  network: 'common.errors.network',
  cancelled: 'common.errors.generic',
};

function localizedMessage(info: ApiErrorInfo, code: string | undefined, serverMessage: string | undefined, fallback: string): string {
  if (code) {
    const key = `common.apiCodes.${code}`;
    const message = translate(key);
    if (message !== key) return message;
  }
  // A caller's own fallback is already in the interface language.
  if (info.kind === 'invalid' || (info.kind === 'server' && !serverMessage)) {
    return fallback === DEFAULT_FALLBACK ? translate(KIND_MESSAGE_KEYS[info.kind]) : fallback;
  }
  return translate(KIND_MESSAGE_KEYS[info.kind]);
}

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

export function describeApiError(error: unknown, fallback = DEFAULT_FALLBACK): ApiErrorInfo {
  const failure = (error && typeof error === 'object' ? error : {}) as AxiosLike;
  const status = failure.response?.status;
  const body = responseBody(failure.response?.data);
  const serverMessage = typeof body.message === 'string' && body.message.trim() ? body.message : undefined;
  const code = typeof body.code === 'string' ? body.code : undefined;

  let info: ApiErrorInfo;
  if (failure.code === 'ERR_CANCELED' || failure.name === 'CanceledError') {
    info = { kind: 'cancelled', message: 'Request cancelled.', retryable: true };
  } else if (!failure.response && !(failure as { isAxiosError?: boolean }).isAxiosError) {
    // Not an HTTP failure: the request succeeded but its body was unusable.
    info = { kind: 'server', message: failure.message || fallback, retryable: true };
  } else if (!failure.response) {
    info = failure.code === 'ECONNABORTED' || failure.code === 'ETIMEDOUT'
      ? { kind: 'timeout', message: 'The request timed out. Please try again.', retryable: true }
      : { kind: 'network', message: 'WorkGrind could not be reached. Check your connection and try again.', retryable: true };
  } else if (status === 401) {
    info = { kind: 'unauthorized', message: 'Your session has expired. Sign in again to continue.', retryable: false };
  } else if (status === 403 && code === 'PLAN_UPGRADE_REQUIRED') {
    info = { kind: 'plan', message: serverMessage ?? 'Your workspace plan does not include this feature.', retryable: false };
  } else if (status === 403 && code === 'SUBSCRIPTION_REQUIRED') {
    info = { kind: 'subscription', message: serverMessage ?? 'Your workspace subscription is not active.', retryable: false };
  } else if (status === 403) {
    info = { kind: 'forbidden', message: serverMessage ?? 'You do not have access to this feature.', retryable: false };
  } else if (status === 429) {
    info = { kind: 'rate_limited', message: serverMessage ?? 'Too many requests. Wait a moment and try again.', retryable: true };
  } else if (status && status >= 500) {
    info = { kind: 'server', message: serverMessage ?? fallback, retryable: true };
  } else {
    info = { kind: 'invalid', message: serverMessage ?? fallback, retryable: false };
  }

  if (getActiveLanguage() !== 'en') info = { ...info, message: localizedMessage(info, code, serverMessage, fallback) };

  if (process.env.NODE_ENV !== 'production' && info.kind !== 'cancelled') {
    // Method, path, status, and code only — never headers, tokens, or bodies.
    console.warn('[API] Request failed.', {
      method: failure.config?.method?.toUpperCase(),
      path: failure.config?.url?.split('?')[0],
      status,
      code,
      kind: info.kind,
    });
  }
  return { ...info, ...(status ? { status } : {}), ...(code ? { code } : {}) };
}
