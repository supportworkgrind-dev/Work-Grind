import { Router } from 'express';
import { authenticateConnectApiKey } from '../middleware/connectApiKey';
import { asyncHandler } from '../middleware/asyncHandler';
import { CONNECT_RESOURCES } from '../models/DeveloperAccess';
import {
  connectResourceMiddleware, createConnectResource, getConnectResource,
  listConnectResource, updateConnectResource,
} from '../controllers/connectApi.controller';

const router = Router();
router.use(authenticateConnectApiKey);
router.get('/:resource', connectResourceMiddleware, asyncHandler(listConnectResource));
router.post('/:resource', connectResourceMiddleware, asyncHandler(createConnectResource));
router.get('/:resource/:id', connectResourceMiddleware, asyncHandler(getConnectResource));
router.patch('/:resource/:id', connectResourceMiddleware, asyncHandler(updateConnectResource));
router.use((req, res) => {
  const resource = req.path.split('/').filter(Boolean)[0];
  if (CONNECT_RESOURCES.some((item) => item === resource)) {
    res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'This method is not available for the requested resource.' } });
    return;
  }
  res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Supported resources: contacts, companies, deals, projects, tasks, team.' } });
});
router.use((error: any, _req: any, res: any, next: any) => {
  if (res.headersSent) { next(error); return; }
  if (error?.name === 'ValidationError') {
    res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'The supplied resource data is invalid.' } });
    return;
  }
  if (error?.name === 'CastError') {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'A resource identifier is invalid.' } });
    return;
  }
  if (error?.code === 11000) {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'The request conflicts with an existing record.' } });
    return;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The WorkGrind API could not complete this request.' } });
});

export default router;
