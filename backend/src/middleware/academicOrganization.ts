import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import { AuthRequest } from './auth';

export const requireAcademicOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const company = await Company.findById(req.user!.companyId).select('organizationType isActive');
    if (!company || !company.isActive) {
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }
    if (!['school', 'college', 'university'].includes(company.organizationType)) {
      res.status(403).json({ success: false, message: 'Academic features require an education organization.' });
      return;
    }
    next();
  } catch (error) {
    console.error('[Academic] Organization access check failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(503).json({ success: false, message: 'Unable to verify organization access.' });
  }
};
