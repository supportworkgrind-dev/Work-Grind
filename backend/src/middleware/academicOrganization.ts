import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import { AuthRequest } from './auth';

async function getAcademicMember(
  req: AuthRequest,
  res: Response
): Promise<{ role: string } | null> {
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
    if (!['school', 'college', 'university'].includes(company.organizationType)) {
      res.status(403).json({ success: false, message: 'Academic features require an education organization.' });
      return null;
    }
    return { role: user.role };
  } catch (error) {
    console.error('[Academic] Organization access check failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(503).json({ success: false, message: 'Unable to verify organization access.' });
    return null;
  }
}

export const requireAcademicOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (await getAcademicMember(req, res)) {
    next();
  }
};

export const requireAcademicAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await getAcademicMember(req, res);
  if (!user) return;
  if (!['owner', 'admin'].includes(user.role)) {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return;
  }
  next();
};
