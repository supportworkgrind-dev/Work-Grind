import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import {
  AccountType,
  OrganizationType,
  isOrganizationRoleEligible,
  roleMatches,
} from '../config/organization';
import { AuthRequest } from './auth';
import { getCompanySubscription } from '../services/companySubscription';
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
  return policy.organizationTypes.includes(organization.organizationType) &&
    policy.accountTypes.includes(organization.accountType) &&
    (policy.roles === 'eligible'
      ? isOrganizationRoleEligible(role, organization.organizationType)
      : roleMatches(role, policy.roles, organization.organizationType));
}

export function isOrganizationAdminRole(role: string, organizationType: string): boolean {
  return roleMatches(role, ['owner', 'admin', 'manager'], organizationType);
}

export function requireOrganizationFeature(feature: OrganizationFeature) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      const user = await User.findById(req.user.userId)
        .select('companyId role isActive isVerified isDeleted');
      if (
        !user ||
        !user.isActive ||
        !user.isVerified ||
        user.isDeleted ||
        !user.companyId ||
        user.companyId.toString() !== req.user.companyId
      ) {
        res.status(403).json({ success: false, message: 'Active organization membership is required.' });
        return;
      }

      const company = await Company.findOne({ _id: user.companyId, isActive: true })
        .select('organizationType accountType');
      if (!company) {
        res.status(403).json({ success: false, message: 'An active organization is required.' });
        return;
      }

      const role = user.role || '';
      const organization = {
        organizationType: company.organizationType,
        accountType: company.accountType,
      };
      let allowed = isOrganizationFeatureAllowed(organization, role, feature);
      const policy = ORGANIZATION_FEATURE_POLICIES[feature];
      if (allowed && policy.entitlement) {
        const subscription = await getCompanySubscription(company._id.toString());
        allowed = subscription.hasActiveAccess && subscription.planConfig.entitlements[policy.entitlement];
      }

      if (!allowed) {
        res.status(403).json({
          success: false,
          code: 'ORGANIZATION_FEATURE_FORBIDDEN',
          message: 'This feature is not available for your organization or role.',
        });
        return;
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
