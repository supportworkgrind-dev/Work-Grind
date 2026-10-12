import {
  LinkedInApiError,
  LINKEDIN_PUBLISHING_SCOPE,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  publishLinkedInTextPost,
} from './linkedinPublishing';

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
  ): Promise<SocialPublishResult>;
}

const linkedin: SocialProviderAdapter = {
  id: 'linkedin',
  name: 'LinkedIn',
  availability: 'available',
  capabilities: {
    connect: true,
    publishText: true,
    publishMedia: false,
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
  async publishText(accessToken, identityId, text) {
    const result = await publishLinkedInTextPost(accessToken, identityId, text);
    return {
      ...(result.postUrn ? { externalPostId: result.postUrn } : {}),
      ...(result.postUrl ? { externalPostUrl: result.postUrl } : {}),
    };
  },
};

const providerCatalog: SocialProviderDefinition[] = [
  linkedin,
  {
    id: 'instagram',
    name: 'Instagram',
    availability: 'setup_required',
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
    availability: 'setup_required',
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
    id: 'youtube',
    name: 'YouTube',
    availability: 'setup_required',
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

export function getSocialProviderCatalog(): SocialProviderDefinition[] {
  return providerCatalog.map((provider) => ({ ...provider, capabilities: { ...provider.capabilities } }));
}

export function getSocialProviderAdapter(provider: string): SocialProviderAdapter | null {
  return provider === linkedin.id ? linkedin : null;
}

export { LinkedInApiError };
