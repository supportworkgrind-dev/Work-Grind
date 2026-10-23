import { getOAuthConfigurationIssue } from './oauth';
import {
  LinkedInApiError,
  LINKEDIN_PUBLISHING_SCOPE,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  publishLinkedInPost,
} from './linkedinPublishing';
import {
  isYouTubePublishingConfigured,
  YOUTUBE_DESCRIPTION_MAX_LENGTH,
  YOUTUBE_PUBLISHING_SCOPES,
} from './youtubePublishing';

export type SocialProviderId = 'linkedin' | 'instagram' | 'facebook' | 'youtube';

export interface SocialProviderCapabilities {
  connect: boolean;
  publishText: boolean;
  publishMedia: boolean;
  schedule: boolean;
  analytics: boolean;
  organizationPublishing: boolean;
}

export interface SocialProviderDefinition {
  id: SocialProviderId;
  name: string;
  availability: 'available' | 'setup_required' | 'coming_soon';
  capabilities: SocialProviderCapabilities;
  requiredScopes: string[];
  maxTextLength?: number;
}

export interface SocialPublishResult {
  externalPostId?: string;
  externalPostUrl?: string;
}

export interface SocialProviderAdapter extends SocialProviderDefinition {
  validateText(text: string): string | null;
  publishText(
    accessToken: string,
    identityId: string,
    text: string,
    media?: { buffer: Buffer; mimeType: string; title: string },
  ): Promise<SocialPublishResult>;
}

const linkedin: SocialProviderAdapter = {
  id: 'linkedin',
  name: 'LinkedIn',
  availability: 'available',
  capabilities: {
    connect: true,
    publishText: true,
    publishMedia: true,
    schedule: true,
    analytics: false,
    organizationPublishing: false,
  },
  requiredScopes: [LINKEDIN_PUBLISHING_SCOPE],
  maxTextLength: LINKEDIN_TEXT_POST_MAX_LENGTH,
  validateText(text) {
    const normalized = text.trim();
    return normalized.length > 0 && normalized.length <= LINKEDIN_TEXT_POST_MAX_LENGTH
      ? null
      : `Post text must contain 1–${LINKEDIN_TEXT_POST_MAX_LENGTH} characters.`;
  },
  async publishText(accessToken, identityId, text, media) {
    const result = await publishLinkedInPost(accessToken, identityId, text, media);
    return {
      externalPostId: result.postUrn,
      ...(result.postUrl ? { externalPostUrl: result.postUrl } : {}),
    };
  },
};

const providerCatalog: SocialProviderDefinition[] = [
  linkedin,
  {
    id: 'instagram',
    name: 'Instagram',
    // No publishing adapter exists yet, so this is not a configuration gap.
    availability: 'coming_soon',
    capabilities: {
      connect: false,
      publishText: false,
      publishMedia: false,
      schedule: false,
      analytics: false,
      organizationPublishing: false,
    },
    requiredScopes: [],
  },
  {
    id: 'facebook',
    name: 'Facebook Pages',
    // No publishing adapter exists yet, so this is not a configuration gap.
    availability: 'coming_soon',
    capabilities: {
      connect: false,
      publishText: false,
      publishMedia: false,
      schedule: false,
      analytics: false,
      organizationPublishing: false,
    },
    requiredScopes: [],
  },
];

/**
 * YouTube uploads videos with a title and description. It becomes available once
 * the Google OAuth client used for YouTube consent is configured on the server.
 */
function youtubeDefinition(): SocialProviderDefinition {
  const configured = isYouTubePublishingConfigured();
  return {
    id: 'youtube',
    name: 'YouTube',
    availability: configured ? 'available' : 'setup_required',
    capabilities: {
      connect: configured,
      publishText: false,
      publishMedia: configured,
      schedule: false,
      analytics: false,
      organizationPublishing: false,
    },
    requiredScopes: [...YOUTUBE_PUBLISHING_SCOPES],
    maxTextLength: YOUTUBE_DESCRIPTION_MAX_LENGTH,
  };
}

/** LinkedIn is offered only when its OAuth client is configured on the server. */
function linkedinDefinition(): SocialProviderDefinition {
  const definition: SocialProviderDefinition = {
    id: linkedin.id,
    name: linkedin.name,
    availability: linkedin.availability,
    capabilities: linkedin.capabilities,
    requiredScopes: linkedin.requiredScopes,
    maxTextLength: linkedin.maxTextLength,
  };
  if (getOAuthConfigurationIssue('linkedin') === null) return definition;
  return {
    ...definition,
    availability: 'setup_required',
    capabilities: { ...definition.capabilities, connect: false, publishText: false, publishMedia: false, schedule: false },
  };
}

export function getSocialProviderCatalog(): SocialProviderDefinition[] {
  return [linkedinDefinition(), ...providerCatalog.filter((provider) => provider.id !== linkedin.id), youtubeDefinition()]
    .map((provider) => ({ ...provider, capabilities: { ...provider.capabilities } }));
}

export function getSocialProviderAdapter(provider: string): SocialProviderAdapter | null {
  return provider === linkedin.id ? linkedin : null;
}

export { LinkedInApiError };
