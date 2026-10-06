import { Router } from 'express';
import {
  getDocuments, createDocument, getDocumentById,
  updateDocument, deleteDocument, addDocumentComment,
} from '../controllers/document.controller';
import { authenticate, requireEntitlement } from '../middleware/auth';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();

router.use(authenticate, requireEntitlement('fileStorage'));

router.get('/',  getDocuments);
router.post('/', createDocument);
router.get('/:id',          validateObjectId('id'), getDocumentById);
router.patch('/:id',        validateObjectId('id'), updateDocument);
router.delete('/:id',       validateObjectId('id'), deleteDocument);
router.post('/:id/comments',validateObjectId('id'), addDocumentComment);

export default router;
