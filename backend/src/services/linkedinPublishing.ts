export const LINKEDIN_TEXT_POST_MAX_LENGTH = 3000;
export const LINKEDIN_PUBLISHING_SCOPE = 'w_member_social';
export const LINKEDIN_MAX_IMAGE_BYTES = 36 * 1024 * 1024;
export const LINKEDIN_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest';

export class LinkedInApiError extends Error {
  constructor(readonly status: number) {
    super(`LinkedIn API request failed with status ${status}.`);
    this.name = 'LinkedInApiError';
  }
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
): Promise<Response> {
  const response = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    ...init,
    headers: { ...apiHeaders(accessToken, typeof init.body === 'string'), ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new LinkedInApiError(response.status);
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
  });
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
  if (!uploadResponse.ok) throw new LinkedInApiError(uploadResponse.status);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const statusResponse = await linkedinRequest(`/images/${encodeURIComponent(imageUrn)}`, accessToken);
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
  });
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
  if (!/^urn:li:video:[A-Za-z0-9_-]+$/.test(videoUrn) || !uploadToken ||
      !Array.isArray(instructions) || instructions.length === 0) {
    throw new Error('LinkedIn returned incomplete video upload instructions.');
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
    if (!response.ok) throw new LinkedInApiError(response.status);
    const etag = response.headers.get('etag')?.replace(/^"|"$/g, '');
    if (!etag) throw new Error('LinkedIn did not confirm a video upload part.');
    uploadedPartIds.push(etag);
  }

  await linkedinRequest('/videos?action=finalizeUpload', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
    }),
  });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const statusResponse = await linkedinRequest(`/videos/${encodeURIComponent(videoUrn)}`, accessToken);
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
  });
  if (response.status !== 201) throw new LinkedInApiError(response.status);
  const postUrn = response.headers.get('x-restli-id')?.trim();
  if (!postUrn || !/^urn:li:(?:share|ugcPost):[A-Za-z0-9_-]+$/.test(postUrn)) {
    throw new Error('LinkedIn did not confirm a valid post identifier.');
  }
  return { postUrn };
}

export async function publishLinkedInTextPost(
  accessToken: string,
  subject: string,
  text: string,
): Promise<{ postUrn?: string; postUrl?: string }> {
  return publishLinkedInPost(accessToken, subject, text);
}
