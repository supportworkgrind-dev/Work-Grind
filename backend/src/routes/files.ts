import { Router } from 'express';
import {
  getFiles, uploadFile, downloadFile,
  updateFile, deleteFile, getFolders, createFolder, deleteFolder,
  storageHealth,
} from '../controllers/file.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { upload, validateUploadedContent } from '../middleware/upload';
import { validateObjectId } from '../middleware/validateObjectId';
import { requireAnyOrganizationFeature } from '../middleware/organizationAccess';

const router = Router();

router.use(
  authenticate,
  requireAnyOrganizationFeature('workspaceContent', 'soloWorkspace', 'educationFiles'),
  requireEntitlement('fileStorage'),
);

router.get('/',                              getFiles);
router.post('/upload',                       upload.single('file'), validateUploadedContent, uploadFile);
router.get('/folders/list',                  getFolders);
router.post('/folders',                      createFolder);
router.delete('/folders/:id',                validateObjectId('id'), deleteFolder);
router.get('/storage/health',                storageHealth);

// These must come AFTER /folders/list and /storage/health to avoid route conflicts
router.get('/:id/download',                  validateObjectId('id'), downloadFile);
router.patch('/:id',                         validateObjectId('id'), updateFile);
router.delete('/:id',                        validateObjectId('id'), deleteFile);

export default router;
