import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import { normalizeOrganizationRole, isAcademicOrganizationType } from '../config/organization';
import { AuthRequest } from './auth';

async function getAcademicMember(
  req: AuthRequest,
  res: Response
): Promise<{ role: string; organizationType: string } | null> {
  try {
    const user = await User.findById(req.user!.userId).select('companyId role isActive isVerified isDeleted');
    if (
      !user ||
      !user.isActive ||
      !user.isVerified ||
      user.isDeleted ||
      !user.companyId ||
      user.companyId.toString() !== req.user!.companyId
    ) {
      res.status(403).json({ success: false, message: 'Active organization membership is required.' });
      return null;
    }

    const company = await Company.findOne({ _id: user.companyId, isActive: true }).select('organizationType isActive');
    if (!company || !company.isActive) {
      res.status(404).json({ success: false, message: 'Organization not found' });
      return null;
    }
    if (!isAcademicOrganizationType(company.organizationType)) {
      res.status(403).json({ success: false, message: 'Academic features require an education organization.' });
      return null;
    }
    return { role: normalizeOrganizationRole(user.role, company.organizationType, 'employee'), organizationType: company.organizationType };
  } catch (error) {
    console.error('[Academic] Organization access check failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(503).json({ success: false, message: 'Unable to verify organization access.' });
    return null;
  }
}

export const requireAcademicRole = (...allowedRoles: string[]) => async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const member = await getAcademicMember(req, res);
  if (!member) return;

  const normalizedAllowedRoles = new Set(allowedRoles.map((role) => normalizeOrganizationRole(role, member.organizationType, 'employee')));
  const normalizedUserRole = normalizeOrganizationRole(member.role, member.organizationType, 'employee');

  if (!normalizedAllowedRoles.has(normalizedUserRole)) {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return;
  }
  next();
};

export const requireAcademicOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (await getAcademicMember(req, res)) {
    next();
  }
};

export const requireAcademicAdmin = requireAcademicRole('owner', 'founder', 'principal', 'director', 'admin', 'office_staff', 'dean', 'hod');
