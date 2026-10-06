import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
import Company from '../models/Company';
import User from '../models/User';

export async function requireDeveloperAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.userId || !req.user.companyId) {
      res.status(403).json({ success: false, message: 'Workspace membership is required.' });
      return;
    }
    const [user, company] = await Promise.all([
      User.findById(req.user.userId).select('companyId role isActive'),
      Company.exists({ _id: req.user.companyId, isActive: true }),
    ]);
    if (!user?.isActive || !company || user.companyId?.toString() !== req.user.companyId || !['owner', 'admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Active workspace owner or admin access is required.' });
      return;
    }
    next();
  } catch {
    res.status(503).json({ success: false, message: 'Developer authorization is temporarily unavailable.' });
  }
}
