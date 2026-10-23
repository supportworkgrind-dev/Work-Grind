export const LINKEDIN_TEXT_POST_MAX_LENGTH = 3000;
export const LINKEDIN_PUBLISHING_SCOPE = 'w_member_social';
export const LINKEDIN_MAX_IMAGE_BYTES = 36 * 1024 * 1024;
export const LINKEDIN_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest';

export type LinkedInRequestStage = 'image_upload' | 'video_upload' | 'post' | 'api';

/**
 * A LinkedIn HTTP failure with LinkedIn's own error details for diagnostics.
 * providerMessage is LinkedIn's text, truncated and stripped of anything
 * token-like; it never contains WorkGrind credentials.
 */
export class LinkedInApiError extends Error {
  constructor(
    readonly status: number,
    readonly providerCode?: string,
    readonly providerMessage?: string,
    readonly stage: LinkedInRequestStage = 'api',
  ) {
    super(`LinkedIn API request failed with status ${status}.`);
    this.name = 'LinkedInApiError';
  }
}

function sanitizeProviderText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value)
    .replace(/Bearer\s+\S+/gi, 'Bearer <redacted>')
    .replace(/[A-Za-z0-9_-]{40,}/g, '<redacted>')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : undefined;
}

/** Builds a LinkedInApiError from a failed response, reading LinkedIn's error body when present. */
async function linkedInFailure(response: Response, stage: LinkedInRequestStage): Promise<LinkedInApiError> {
  let body: { serviceErrorCode?: unknown; code?: unknown; message?: unknown } = {};
  try {
    body = await response.json() as typeof body;
  } catch {
    body = {};
  }
  return new LinkedInApiError(
    response.status,
    sanitizeProviderText(body.code ?? body.serviceErrorCode, 64),
    sanitizeProviderText(body.message, 200),
    stage,
  );
}

export function getLinkedInApiVersion(): string {
  const version = process.env.LINKEDIN_API_VERSION?.trim() || '202610';
  if (!/^\d{6}$/.test(version)) {
    throw new Error('LINKEDIN_API_VERSION must use the YYYYMM format.');
  }
  return version;
}

function apiHeaders(accessToken: string, json = false): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'LinkedIn-Version': getLinkedInApiVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

async function linkedinRequest(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  stage: LinkedInRequestStage = 'api',
): Promise<Response> {
  const response = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    ...init,
    headers: { ...apiHeaders(accessToken, typeof init.body === 'string'), ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw await linkedInFailure(response, stage);
  return response;
}

function validateUploadUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('LinkedIn returned an invalid upload destination.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'))) {
    throw new Error('LinkedIn returned an untrusted upload destination.');
  }
  return url.toString();
}

async function uploadImage(accessToken: string, owner: string, buffer: Buffer): Promise<string> {
  const initResponse = await linkedinRequest('/images?action=initializeUpload', accessToken, {
    method: 'POST',
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  }, 'image_upload');
  const init = await initResponse.json() as { value?: { uploadUrl?: unknown; image?: unknown } };
  const uploadUrl = validateUploadUrl(init.value?.uploadUrl);
  const imageUrn = typeof init.value?.image === 'string' ? init.value.image : '';
  if (!/^urn:li:image:[A-Za-z0-9_-]+$/.test(imageUrn)) {
    throw new Error('LinkedIn returned an invalid image asset identifier.');
  }
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(buffer.length) },
    body: buffer,
    signal: AbortSignal.timeout(60_000),
  });
  if (!uploadResponse.ok) throw await linkedInFailure(uploadResponse, 'image_upload');

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const statusResponse = await linkedinRequest(`/images/${encodeURIComponent(imageUrn)}`, accessToken, {}, 'image_upload');
    const status = (await statusResponse.json() as { status?: unknown }).status;
    if (status === 'AVAILABLE') return imageUrn;
    if (status === 'PROCESSING_FAILED') throw new Error('LinkedIn could not process the uploaded image.');
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('LinkedIn image processing timed out.');
}

interface VideoUploadInstruction {
  firstByte: number;
  lastByte: number;
  uploadUrl: string;
}

async function uploadVideo(accessToken: string, owner: string, buffer: Buffer): Promise<string> {
  const initResponse = await linkedinRequest('/videos?action=initializeUpload', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      initializeUploadRequest: {
        owner,
        fileSizeBytes: buffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  }, 'video_upload');
  const init = await initResponse.json() as {
    value?: {
      video?: unknown;
      uploadToken?: unknown;
      uploadInstructions?: VideoUploadInstruction[];
    };
  };
  const videoUrn = typeof init.value?.video === 'string' ? init.value.video : '';
  const uploadToken = typeof init.value?.uploadToken === 'string' ? init.value.uploadToken : '';
  const instructions = init.value?.uploadInstructions;
  if (!/^urn:li:video:[A-Za-z0-9_-]+$/.test(videoUrn) || typeof uploadToken !== 'string' ||
      !Array.isArray(instructions) || instructions.length === 0) {
    throw new Error('LinkedIn returned incomplete video upload instructions.');
  }
  let expectedFirstByte = 0;
  for (const instruction of instructions) {
    if (instruction.firstByte !== expectedFirstByte) {
      throw new Error('LinkedIn returned incomplete video byte ranges.');
    }
    expectedFirstByte = instruction.lastByte + 1;
  }
  if (expectedFirstByte !== buffer.length) {
    throw new Error('LinkedIn returned incomplete video byte ranges.');
  }

  const uploadedPartIds: string[] = [];
  for (const instruction of instructions) {
    if (!Number.isSafeInteger(instruction.firstByte) || !Number.isSafeInteger(instruction.lastByte) ||
        instruction.firstByte < 0 || instruction.lastByte < instruction.firstByte ||
        instruction.lastByte >= buffer.length) {
      throw new Error('LinkedIn returned invalid video byte ranges.');
    }
    const uploadUrl = validateUploadUrl(instruction.uploadUrl);
    const chunk = buffer.subarray(instruction.firstByte, instruction.lastByte + 1);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${instruction.firstByte}-${instruction.lastByte}/${buffer.length}`,
      },
      body: chunk,
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw await linkedInFailure(response, 'video_upload');
    const etag = response.headers.get('etag')?.replace(/^"|"$/g, '');
    if (!etag) throw new Error('LinkedIn did not confirm a video upload part.');
    uploadedPartIds.push(etag);
  }

  await linkedinRequest('/videos?action=finalizeUpload', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
    }),
  }, 'video_upload');
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const statusResponse = await linkedinRequest(`/videos/${encodeURIComponent(videoUrn)}`, accessToken, {}, 'video_upload');
    const status = (await statusResponse.json() as { status?: unknown }).status;
    if (status === 'AVAILABLE') return videoUrn;
    if (status === 'PROCESSING_FAILED') throw new Error('LinkedIn could not process the uploaded video.');
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('LinkedIn video processing timed out.');
}

export async function publishLinkedInPost(
  accessToken: string,
  subject: string,
  text: string,
  media?: { buffer: Buffer; mimeType: string; title: string },
): Promise<{ postUrn: string; postUrl?: string }> {
  const author = `urn:li:person:${subject}`;
  let mediaContent: { title: string; id: string } | undefined;
  if (media) {
    const image = media.mimeType === 'image/jpeg' || media.mimeType === 'image/png';
    const video = media.mimeType === 'video/mp4';
    if ((!image && !video) || !media.buffer.length ||
        (image && media.buffer.length > LINKEDIN_MAX_IMAGE_BYTES) ||
        (video && media.buffer.length > LINKEDIN_MAX_VIDEO_BYTES)) {
      throw new Error('The selected media type or size is not supported by LinkedIn publishing.');
    }
    const id = media.mimeType === 'video/mp4'
      ? await uploadVideo(accessToken, author, media.buffer)
      : await uploadImage(accessToken, author, media.buffer);
    mediaContent = { title: media.title.slice(0, 200), id };
  }

  const response = await linkedinRequest('/posts', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      author,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(mediaContent ? { content: { media: mediaContent } } : {}),
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  }, 'post');
  if (response.status !== 201) throw new LinkedInApiError(response.status, undefined, undefined, 'post');
  const postUrn = response.headers.get('x-restli-id')?.trim();
  if (!postUrn || !/^urn:li:(?:share|ugcPost):[A-Za-z0-9_-]+$/.test(postUrn)) {
    throw new Error('LinkedIn did not confirm a valid post identifier.');
  }
  let postUrl: string | undefined;
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await response.json() as { url?: unknown; postUrl?: unknown };
      const candidate = typeof body.url === 'string' ? body.url : body.postUrl;
      if (typeof candidate === 'string') {
        const parsed = new URL(candidate);
        if (parsed.protocol === 'https:' &&
            (parsed.hostname === 'linkedin.com' || parsed.hostname.endsWith('.linkedin.com')) &&
            !parsed.username && !parsed.password) {
          postUrl = parsed.toString();
        }
      }
    } catch {
      postUrl = undefined;
    }
  }
  return { postUrn, ...(postUrl ? { postUrl } : {}) };
}

export async function publishLinkedInTextPost(
  accessToken: string,
  subject: string,
  text: string,
): Promise<{ postUrn?: string; postUrl?: string }> {
  return publishLinkedInPost(accessToken, subject, text);
}
