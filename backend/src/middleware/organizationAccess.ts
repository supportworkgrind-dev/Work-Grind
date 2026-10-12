import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import {
  isAcademicOrganizationType,
  isOrganizationRoleEligible,
  roleMatches,
} from '../config/organization';
import { AuthRequest } from './auth';

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
  | 'memberDirectory';

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

      const role = user.role || 'employee';
      const isAcademic = isAcademicOrganizationType(company.organizationType);
      const eligible = isOrganizationRoleEligible(role, company.organizationType);
      let allowed = false;

      switch (feature) {
        case 'academic':
          allowed = isAcademic && eligible;
          break;
        case 'academicAdmin':
          allowed = isAcademic && eligible && roleMatches(
            role,
            ['owner', 'principal', 'admin', 'dean', 'hod'],
            company.organizationType,
          );
          break;
        case 'businessCrm':
          allowed = company.organizationType === 'business' &&
            company.accountType === 'company' &&
            roleMatches(role, ['owner', 'admin', 'manager'], company.organizationType);
          break;
        case 'clientPortal':
          allowed = company.organizationType === 'business' &&
            company.accountType === 'company' &&
            roleMatches(role, ['owner', 'admin', 'manager'], company.organizationType);
          break;
        case 'businessAdmin':
          allowed = company.organizationType === 'business' &&
            roleMatches(role, ['owner', 'admin', 'manager'], company.organizationType);
          break;
        case 'businessAnalytics':
        case 'businessIntegrations':
        case 'businessAutomation':
          allowed = company.organizationType === 'business' &&
            roleMatches(role, ['owner', 'admin', 'manager'], company.organizationType);
          break;
        case 'billingAdmin':
          allowed = eligible && roleMatches(role, ['owner', 'admin'], company.organizationType);
          break;
        case 'memberDirectory':
          allowed = isAcademic
            ? eligible && roleMatches(role, ['owner', 'principal', 'admin', 'dean', 'hod'], company.organizationType)
            : roleMatches(role, ['owner', 'admin', 'manager'], company.organizationType);
          break;
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
