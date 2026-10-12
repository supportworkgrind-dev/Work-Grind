import {
  ORGANIZATION_FEATURE_POLICIES,
  isOrganizationFeatureAllowed,
  type OrganizationFeature,
} from '../middleware/organizationAccess';
import type { AccountType, OrganizationType } from '../config/organization';

export const SOCKET_EVENT_FEATURES: Readonly<Record<string, OrganizationFeature>> = {
  'board:join': 'workspaceContent',
  'board:cursor': 'workspaceContent',
  'channel:join': 'educationCommunication',
  'dm:join': 'educationCommunication',
  'presence:sync': 'educationCommunication',
  'typing:start': 'educationCommunication',
  'typing:stop': 'educationCommunication',
  'message:read': 'educationCommunication',
  'meeting:join': 'educationMeetings',
  'meeting:signal': 'educationMeetings',
  'meeting:media-state': 'educationMeetings',
  'meeting:hand-raise': 'educationMeetings',
  'meeting:chat-message': 'educationMeetings',
  'meeting:end-session': 'educationMeetings',
  'call:join': 'globalCalling',
  'call:signal': 'globalCalling',
};

export const SOCKET_USER_EVENT_FEATURES: Readonly<Record<string, OrganizationFeature>> = {
  'call:incoming': 'globalCalling',
  'call:accepted': 'globalCalling',
  'call:ended': 'globalCalling',
  'dm:notification': 'educationCommunication',
  'notification:new': 'educationCommunication',
  'meeting:created': 'educationMeetings',
  'meeting:started': 'educationMeetings',
  'meeting:participant-joined': 'educationMeetings',
  'meeting:ended': 'educationMeetings',
  'user:presence': 'educationCommunication',
};

export interface SocketOrganizationContext {
  organizationType?: OrganizationType | string;
  accountType?: AccountType | string;
  role?: string;
}

export function canSocketAccessFeature(
  context: SocketOrganizationContext,
  feature: OrganizationFeature,
  entitlements: Record<string, boolean> | undefined,
): boolean {
  if (!context.organizationType || !context.accountType || !context.role) return false;
  const organization = {
    organizationType: context.organizationType as OrganizationType,
    accountType: context.accountType as AccountType,
  };
  const policy = ORGANIZATION_FEATURE_POLICIES[feature];
  return isOrganizationFeatureAllowed(organization, context.role, feature) &&
    (!policy.entitlement || entitlements?.[policy.entitlement] === true);
}

export function socketEventFeature(eventName: string): OrganizationFeature | undefined {
  return SOCKET_EVENT_FEATURES[eventName];
}

export function socketUserEventFeature(eventName: string): OrganizationFeature | undefined {
  return SOCKET_USER_EVENT_FEATURES[eventName];
}
