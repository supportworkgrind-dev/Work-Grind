/**
 * YouTube Data API v3 publishing for WorkGrind Social Publishing.
 *
 * Authorization reuses the Google OAuth client and its registered callback
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI). Tokens are
 * stored encrypted on the Integration record; nothing here logs token values.
 */
import { decryptProviderToken, encryptProviderToken } from '../utils/providerTokenEncryption';
import { getOAuthConfiguration } from './oauth';
import type { IIntegration } from '../models/Integration';

export { YOUTUBE_UPLOAD_SCOPE, YOUTUBE_READONLY_SCOPE, YOUTUBE_PUBLISHING_SCOPES } from '../config/youtube';

export const YOUTUBE_TITLE_MAX_LENGTH = 100;
/** YouTube allows 5000 bytes; WorkGrind post text is capped at 3000 characters. */
export const YOUTUBE_DESCRIPTION_MAX_LENGTH = 3000;
export const YOUTUBE_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
export const YOUTUBE_MAX_VIDEO_BYTES = 256 * 1024 * 1024;
export const YOUTUBE_PRIVACY_STATUSES = ['private', 'unlisted', 'public'] as const;
export type YouTubePrivacyStatus = (typeof YOUTUBE_PRIVACY_STATUSES)[number];

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const YOUTUBE_CHANNELS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
const YOUTUBE_UPLOAD_ENDPOINT =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;

const SAFE_REASON = /^[a-zA-Z0-9_.-]{1,80}$/;

export class YouTubeApiError extends Error {
  constructor(readonly status: number, readonly reason?: string) {
    super(`youtube_api_${status}${reason ? `_${reason}` : ''}`);
    this.name = 'YouTubeApiError';
  }
}

export function isYouTubePublishingConfigured(): boolean {
  return getOAuthConfiguration('google') !== null;
}

export function isYouTubePrivacyStatus(value: unknown): value is YouTubePrivacyStatus {
  return typeof value === 'string' && (YOUTUBE_PRIVACY_STATUSES as readonly string[]).includes(value);
}

/** YouTube rejects angle brackets in titles and descriptions. */
export function validateYouTubeMetadata(title: unknown, description: unknown): string | null {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > YOUTUBE_TITLE_MAX_LENGTH) {
    return `Enter a video title between 1 and ${YOUTUBE_TITLE_MAX_LENGTH} characters.`;
  }
  if (typeof description !== 'string' || !description.trim() ||
      description.trim().length > YOUTUBE_DESCRIPTION_MAX_LENGTH) {
    return `Enter a video description between 1 and ${YOUTUBE_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  if (/[<>]/.test(title) || /[<>]/.test(description)) {
    return 'YouTube titles and descriptions cannot contain < or > characters.';
  }
  return null;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error('YouTube did not respond in time.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  }
  finally {
    clearTimeout(timeout);
  }
}

/** Extracts only a provider reason code (never messages, which can echo request data). */
async function readSafeReason(response: Response): Promise<string | undefined> {
  try {
    const payload = await response.json() as {
      error?: string | { errors?: Array<{ reason?: unknown }>; status?: unknown };
    };
    const value = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.errors?.[0]?.reason ?? payload.error?.status;
    return typeof value === 'string' && SAFE_REASON.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function refreshYouTubeAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const configuration = getOAuthConfiguration('google');
  if (!configuration?.clientSecret) throw new YouTubeApiError(503, 'not_configured');
  const response = await timedFetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
    }).toString(),
  }, 15_000);
  if (!response.ok) {
    const reason = await readSafeReason(response);
    // invalid_grant means the user revoked access or the refresh token expired.
    throw new YouTubeApiError(reason === 'invalid_grant' ? 401 : response.status, reason);
  }
  const body = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 16_384) {
    throw new YouTubeApiError(502, 'token_response_invalid');
  }
  const expiresIn = typeof body.expires_in === 'number' && Number.isFinite(body.expires_in) ? body.expires_in : 3600;
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

/**
 * Returns a usable access token for a YouTube integration, refreshing and
 * persisting it when it is expired or about to expire. The document must be
 * loaded with `+accessToken +refreshToken`.
 */
export async function getYouTubeAccessToken(connection: IIntegration): Promise<string> {
  if (connection.accessToken && connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() > Date.now() + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
    return decryptProviderToken(connection.accessToken);
  }
  if (!connection.refreshToken) throw new YouTubeApiError(401, 'reconnect_required');
  const refreshed = await refreshYouTubeAccessToken(decryptProviderToken(connection.refreshToken));
  connection.accessToken = encryptProviderToken(refreshed.accessToken);
  connection.tokenExpiresAt = refreshed.expiresAt;
  await connection.save();
  return refreshed.accessToken;
}

export async function fetchYouTubeChannel(accessToken: string): Promise<{ channelId: string; channelTitle: string }> {
  const response = await timedFetch(YOUTUBE_CHANNELS_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 15_000);
  if (!response.ok) throw new YouTubeApiError(response.status, await readSafeReason(response));
  const body = await response.json() as { items?: Array<{ id?: unknown; snippet?: { title?: unknown } }> };
  const channel = body.items?.[0];
  if (!channel || typeof channel.id !== 'string' || !channel.id) {
    throw new Error('youtube_channel_required');
  }
  return {
    channelId: channel.id.slice(0, 100),
    channelTitle: typeof channel.snippet?.title === 'string' ? channel.snippet.title.slice(0, 200) : 'YouTube channel',
  };
}

export async function uploadYouTubeVideo(
  accessToken: string,
  video: { buffer: Buffer; mimeType: string },
  metadata: { title: string; description: string; privacyStatus: YouTubePrivacyStatus },
): Promise<{ videoId: string; videoUrl: string; privacyStatus?: string }> {
  // Step 1: open a resumable upload session with the video metadata.
  const session = await timedFetch(YOUTUBE_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': video.mimeType,
      'X-Upload-Content-Length': String(video.buffer.length),
    },
    body: JSON.stringify({
      snippet: {
        title: metadata.title.trim(),
        description: metadata.description.trim(),
        categoryId: '22',
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    }),
  }, 30_000);
  if (!session.ok) throw new YouTubeApiError(session.status, await readSafeReason(session));
  const location = session.headers.get('location');
  let uploadUrl: URL;
  try {
    uploadUrl = new URL(location ?? '');
  } catch {
    throw new YouTubeApiError(502, 'upload_session_invalid');
  }
  if (uploadUrl.protocol !== 'https:' || uploadUrl.hostname !== 'www.googleapis.com' ||
      !uploadUrl.pathname.startsWith('/upload/youtube/')) {
    throw new YouTubeApiError(502, 'upload_session_invalid');
  }

  // Step 2: send the video bytes to the session URL.
  const upload = await timedFetch(uploadUrl.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': video.mimeType,
      'Content-Length': String(video.buffer.length),
    },
    body: new Uint8Array(video.buffer),
  }, 240_000);
  if (!upload.ok) throw new YouTubeApiError(upload.status, await readSafeReason(upload));
  const body = await upload.json() as { id?: unknown; status?: { privacyStatus?: unknown } };
  if (typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(body.id)) {
    throw new YouTubeApiError(502, 'upload_response_invalid');
  }
  return {
    videoId: body.id,
    videoUrl: `https://www.youtube.com/watch?v=${body.id}`,
    ...(typeof body.status?.privacyStatus === 'string' ? { privacyStatus: body.status.privacyStatus } : {}),
  };
}

/** Best-effort revocation; disconnect proceeds even if Google is unreachable. */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await timedFetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    }, 10_000);
    return response.ok;
  } catch {
    return false;
  }
}
