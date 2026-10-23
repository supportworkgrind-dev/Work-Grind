import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import {
  AccountType,
  OrganizationType,
  isOrganizationRoleEligible,
  isWorkspaceAdministrator,
  resolveWorkspaceClassification,
  roleMatches,
} from '../config/organization';
import { AuthRequest } from './auth';
import { getCompanySubscription } from '../services/companySubscription';
import { getRequestSubscription, getVerifiedMembership } from './requestContext';
import type { EntitlementId } from '../config/subscription';

export type OrganizationFeature =
  | 'academic'
  | 'academicAdmin'
  | 'businessCrm'
  | 'clientPortal'
  | 'businessAdmin'
  | 'businessAnalytics'
  | 'businessIntegrations'
  | 'businessAutomation'
  | 'socialPublishing'
  | 'billingAdmin'
  | 'memberDirectory'
  | 'workspaceContent'
  | 'soloWorkspace'
  | 'companyWorkspace'
  | 'educationCommunication'
  | 'educationMeetings'
  | 'educationFiles'
  | 'educationAi'
  | 'workspaceSettings'
  | 'globalCalling'
  | 'calendar';

type FeaturePolicy = {
  organizationTypes: readonly OrganizationType[];
  accountTypes: readonly AccountType[];
  roles: readonly string[] | 'eligible';
  entitlement?: EntitlementId;
};

const ALL_EDUCATION_ROLES = [
  'owner', 'principal', 'admin', 'teacher', 'student', 'parent', 'dean', 'hod', 'manager', 'employee',
] as const;
const ACADEMIC_ADMIN_ROLES = ['owner', 'principal', 'admin', 'dean', 'hod'] as const;
const BUSINESS_ADMIN_ROLES = ['owner', 'admin', 'manager'] as const;
const SOCIAL_PUBLISHING_BUSINESS_ROLES = ['owner', 'admin', 'manager', 'employee'] as const;
const BUSINESS_TYPES = ['business'] as const;
const EDUCATION_TYPES = ['school', 'college', 'university'] as const;
const COMPANY_ACCOUNTS = ['company'] as const;
const INDIVIDUAL_ACCOUNTS = ['individual'] as const;

export const ORGANIZATION_FEATURE_POLICIES: Record<OrganizationFeature, FeaturePolicy> = {
  soloWorkspace: { organizationTypes: BUSINESS_TYPES, accountTypes: INDIVIDUAL_ACCOUNTS, roles: ['owner'] },
  companyWorkspace: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: 'eligible' },
  academic: { organizationTypes: EDUCATION_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: 'eligible' },
  academicAdmin: { organizationTypes: EDUCATION_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: ACADEMIC_ADMIN_ROLES },
  businessCrm: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: BUSINESS_ADMIN_ROLES },
  clientPortal: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: BUSINESS_ADMIN_ROLES },
  businessAdmin: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: BUSINESS_ADMIN_ROLES },
  businessAnalytics: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: BUSINESS_ADMIN_ROLES, entitlement: 'advancedAnalytics' },
  businessIntegrations: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: BUSINESS_ADMIN_ROLES },
  businessAutomation: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: BUSINESS_ADMIN_ROLES },
  // Business team and Solo workspaces only; schools, colleges and universities
  // do not get Social Publishing.
  socialPublishing: {
    organizationTypes: BUSINESS_TYPES,
    accountTypes: [...COMPANY_ACCOUNTS, ...INDIVIDUAL_ACCOUNTS],
    roles: SOCIAL_PUBLISHING_BUSINESS_ROLES,
  },
  billingAdmin: {
    organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES],
    accountTypes: [...COMPANY_ACCOUNTS, ...INDIVIDUAL_ACCOUNTS],
    roles: ['owner', 'admin'],
  },
  memberDirectory: {
    organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES],
    accountTypes: COMPANY_ACCOUNTS,
    roles: ['owner', 'admin', 'manager', 'principal', 'dean', 'hod'],
  },
  workspaceContent: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: 'eligible' },
  educationCommunication: { organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES], accountTypes: COMPANY_ACCOUNTS, roles: 'eligible', entitlement: 'teamChat' },
  educationMeetings: { organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES], accountTypes: COMPANY_ACCOUNTS, roles: 'eligible', entitlement: 'meetingsCalendar' },
  educationFiles: { organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES], accountTypes: [...COMPANY_ACCOUNTS, ...INDIVIDUAL_ACCOUNTS], roles: 'eligible', entitlement: 'fileStorage' },
  educationAi: { organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES], accountTypes: [...COMPANY_ACCOUNTS, ...INDIVIDUAL_ACCOUNTS], roles: 'eligible', entitlement: 'aiAssistant' },
  workspaceSettings: {
    organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES],
    accountTypes: [...COMPANY_ACCOUNTS, ...INDIVIDUAL_ACCOUNTS],
    roles: ['owner', 'admin', 'principal'],
  },
  globalCalling: { organizationTypes: BUSINESS_TYPES, accountTypes: COMPANY_ACCOUNTS, roles: 'eligible' },
  calendar: { organizationTypes: [...BUSINESS_TYPES, ...EDUCATION_TYPES], accountTypes: [...COMPANY_ACCOUNTS, ...INDIVIDUAL_ACCOUNTS], roles: 'eligible', entitlement: 'meetingsCalendar' },
};

function isSupportedOrganizationType(value: unknown): value is OrganizationType {
  return value === 'business' || value === 'school' || value === 'college' || value === 'university';
}

export function requireAnyOrganizationFeature(...features: OrganizationFeature[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const organizationType = req.user?.organizationType;
    const accountType = req.user?.accountType;
    const role = req.user?.role;
    if (
      !isSupportedOrganizationType(organizationType) ||
      (accountType !== 'company' && accountType !== 'individual') ||
      typeof role !== 'string'
    ) {
      res.status(403).json({ success: false, message: 'Active workspace context is required' });
      return;
    }

    const organization = { organizationType, accountType };
    if (features.some((feature) => isOrganizationFeatureAllowed(organization, role, feature))) {
      next();
      return;
    }

    res.status(403).json({ success: false, message: 'This feature is not available for your workspace role' });
  };
}

export function isOrganizationFeatureAllowed(
  organization: { organizationType: OrganizationType; accountType: AccountType },
  role: string,
  feature: OrganizationFeature,
): boolean {
  const policy = ORGANIZATION_FEATURE_POLICIES[feature];
  // Callers pass a classification already resolved from the stored record
  // (authenticate, the membership lookup, or a hydrated document). Here only
  // casing is normalized: a missing or unknown value is refused, never defaulted.
  if (!organization.organizationType || !organization.accountType) return false;
  const classification = resolveWorkspaceClassification(organization.organizationType, organization.accountType);
  if (!classification.organizationType || !classification.accountType) return false;
  organization = { organizationType: classification.organizationType, accountType: classification.accountType };
  const roles = feature === 'socialPublishing' && organization.accountType === 'individual'
    ? ['owner']
    : policy.roles;
  return policy.organizationTypes.includes(organization.organizationType) &&
    policy.accountTypes.includes(organization.accountType) &&
    (roles === 'eligible'
      ? isOrganizationRoleEligible(role, organization.organizationType)
      : roleMatches(role, roles, organization.organizationType));
}

export function isOrganizationAdminRole(role: string, organizationType: string): boolean {
  return roleMatches(role, ['owner', 'admin', 'manager'], organizationType);
}

type OrganizationMembership = {
  role: string;
  companyId: string;
  organizationType?: string;
  accountType?: string;
};

async function loadOrganizationMembership(
  req: AuthRequest,
  userId: string,
  expectedCompanyId: string | undefined,
): Promise<OrganizationMembership | 'no_membership' | 'no_organization'> {
  const verified = getVerifiedMembership(req, userId);
  if (verified) {
    if (!verified.companyId || verified.companyId !== expectedCompanyId) return 'no_membership';
    return verified;
  }

  const user = await User.findById(userId)
    .select('companyId role isActive isVerified isDeleted')
    .lean();
  if (
    !user ||
    !user.isActive ||
    !user.isVerified ||
    user.isDeleted ||
    !user.companyId ||
    user.companyId.toString() !== expectedCompanyId
  ) {
    return 'no_membership';
  }
  const company = await Company.findOne({ _id: user.companyId, isActive: true })
    .select('organizationType accountType')
    .lean();
  if (!company) return 'no_organization';
  return {
    role: user.role || '',
    companyId: company._id.toString(),
    ...resolveWorkspaceClassification(company.organizationType, company.accountType),
  };
}

/**
 * Workspace administration (settings, invite credentials, member status and
 * roles, removals, audit trail). Uses the role and organization authenticate
 * just read from the database, never values supplied by the client.
 */
export function requireWorkspaceAdministrator(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.userId) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (!isWorkspaceAdministrator(req.user.role, req.user.organizationType)) {
    res.status(403).json({
      success: false,
      code: 'WORKSPACE_ADMIN_REQUIRED',
      message: 'Only workspace owners and administrators can make this change.',
    });
    return;
  }
  next();
}

/** Why a feature was refused, without user identifiers, for diagnosing access reports. */
function logFeatureDenial(
  feature: OrganizationFeature,
  reason: 'organization_or_role' | 'plan_entitlement' | 'inactive_subscription',
  organization: { organizationType?: string; accountType?: string },
  role: string,
): void {
  console.warn('[OrganizationAccess] Feature refused.', {
    feature,
    reason,
    organizationType: organization.organizationType ?? 'unknown',
    accountType: organization.accountType ?? 'unknown',
    role: role || 'none',
  });
}

export function requireOrganizationFeature(feature: OrganizationFeature) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      const membership = await loadOrganizationMembership(req, req.user.userId, req.user.companyId);
      if (membership === 'no_membership') {
        res.status(403).json({ success: false, message: 'Active organization membership is required.' });
        return;
      }
      if (membership === 'no_organization') {
        res.status(403).json({ success: false, message: 'An active organization is required.' });
        return;
      }

      const { role, companyId } = membership;
      const organization = {
        organizationType: membership.organizationType as OrganizationType,
        accountType: membership.accountType as AccountType,
      };
      if (!isOrganizationFeatureAllowed(organization, role, feature)) {
        logFeatureDenial(feature, 'organization_or_role', organization, role);
        res.status(403).json({
          success: false,
          code: 'ORGANIZATION_FEATURE_FORBIDDEN',
          message: 'This feature is not available for your organization or role.',
        });
        return;
      }
      const policy = ORGANIZATION_FEATURE_POLICIES[feature];
      if (policy.entitlement) {
        // A company member's effective subscription is the company's, so the
        // one authenticate already resolved for this request is reused.
        const effective = await getRequestSubscription(req, req.user.userId);
        const subscription = effective.companyId === companyId
          ? effective
          : await getCompanySubscription(companyId);
        // The workspace and role qualify; only the plan or subscription does not.
        if (!subscription.hasActiveAccess || !subscription.planConfig.entitlements[policy.entitlement]) {
          logFeatureDenial(feature, subscription.hasActiveAccess ? 'plan_entitlement' : 'inactive_subscription', organization, role);
          res.status(403).json({
            success: false,
            code: subscription.hasActiveAccess ? 'PLAN_UPGRADE_REQUIRED' : 'SUBSCRIPTION_REQUIRED',
            message: subscription.hasActiveAccess
              ? 'Your workspace plan does not include this feature.'
              : 'Your workspace subscription is not active.',
            requiresUpgrade: true,
            billingPath: '/billing',
          });
          return;
        }
      }
      next();
    } catch (error) {
      console.error('[OrganizationAccess] Feature authorization failed.', {
        feature,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      res.status(503).json({
        success: false,
        code: 'ORGANIZATION_ACCESS_UNAVAILABLE',
        message: 'Unable to verify organization access.',
      });
    }
  };
}
