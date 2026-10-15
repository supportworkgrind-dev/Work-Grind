import { RequestHandler } from 'express';
import { AuthRequest } from './auth';
import { deleteCacheKey, namespacedCacheKey } from '../utils/cache';

export const invalidateAnalyticsOverviewCache: RequestHandler = (req, res, next) => {
  const methodMutatesData = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const companyId = (req as AuthRequest).user?.companyId?.toString();
  if (!methodMutatesData || !companyId) {
    next();
    return;
  }

  const cacheKey = namespacedCacheKey('analytics:overview', companyId);
  res.once('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void deleteCacheKey(cacheKey);
    }
  });

  void deleteCacheKey(cacheKey);
  next();
};
