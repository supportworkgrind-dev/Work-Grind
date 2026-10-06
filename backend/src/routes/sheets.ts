import { Router } from 'express';
import {
  createSheet,
  createWorkbook,
  deleteSheet,
  deleteWorkbook,
  duplicateSheet,
  getWorkbook,
  getWorkbooks,
  replaceSheetData,
  updateCellStyles,
  updateCells,
  updateSheet,
  updateWorkbook,
} from '../controllers/sheets.controller';
import { authenticate, requireCompany, requireEntitlement } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();

router.use(authenticate, requireCompany, requireEntitlement('fileStorage'));

router.get('/workbooks', asyncHandler(getWorkbooks));
router.post('/workbooks', asyncHandler(createWorkbook));
router.get('/workbooks/:workbookId', validateObjectId('workbookId'), asyncHandler(getWorkbook));
router.patch('/workbooks/:workbookId', validateObjectId('workbookId'), asyncHandler(updateWorkbook));
router.delete('/workbooks/:workbookId', validateObjectId('workbookId'), asyncHandler(deleteWorkbook));

router.post('/workbooks/:workbookId/sheets', validateObjectId('workbookId'), asyncHandler(createSheet));
router.post(
  '/workbooks/:workbookId/sheets/:sheetId/duplicate',
  validateObjectId('workbookId', 'sheetId'),
  asyncHandler(duplicateSheet),
);
router.patch(
  '/workbooks/:workbookId/sheets/:sheetId/cells',
  validateObjectId('workbookId', 'sheetId'),
  asyncHandler(updateCells),
);
router.patch(
  '/workbooks/:workbookId/sheets/:sheetId/styles',
  validateObjectId('workbookId', 'sheetId'),
  asyncHandler(updateCellStyles),
);
router.put(
  '/workbooks/:workbookId/sheets/:sheetId/cells',
  validateObjectId('workbookId', 'sheetId'),
  asyncHandler(replaceSheetData),
);
router.patch(
  '/workbooks/:workbookId/sheets/:sheetId',
  validateObjectId('workbookId', 'sheetId'),
  asyncHandler(updateSheet),
);
router.delete(
  '/workbooks/:workbookId/sheets/:sheetId',
  validateObjectId('workbookId', 'sheetId'),
  asyncHandler(deleteSheet),
);

export default router;
