export const LINKEDIN_TEXT_POST_MAX_LENGTH = 3000;
export const LINKEDIN_PUBLISHING_SCOPE = 'w_member_social';

export class LinkedInApiError extends Error {
  constructor(readonly status: number) {
    super(`LinkedIn API request failed with status ${status}.`);
    this.name = 'LinkedInApiError';
  }
}

export function getLinkedInApiVersion(): string {
  const version = process.env.LINKEDIN_API_VERSION?.trim() || '202609';
  if (!/^\d{6}$/.test(version)) {
    throw new Error('LINKEDIN_API_VERSION must use the YYYYMM format.');
  }
  return version;
}

export async function publishLinkedInTextPost(
  accessToken: string,
  subject: string,
  text: string,
): Promise<{ postUrn?: string }> {
  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': getLinkedInApiVersion(),
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:person:${subject}`,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status !== 201) {
    throw new LinkedInApiError(response.status);
  }
  const postUrn = response.headers.get('x-restli-id')?.trim();
  return postUrn ? { postUrn } : {};
}
