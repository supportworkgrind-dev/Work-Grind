import { NextFunction, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import { AuthRequest } from './auth';

export const requireAcademicAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      return;
    }
    if (!['owner', 'admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const company = await Company.findOne({ _id: user.companyId, isActive: true }).select('organizationType isActive');
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
