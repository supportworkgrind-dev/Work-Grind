import { Router } from 'express';
import { authenticate, requireEntitlement } from '../middleware/auth';
import {
	addComment,
	archiveBoard,
	convertBoardToProject,
	convertBoardToTasks,
	createBoard,
	deleteBoard,
	duplicateBoard,
	getBoardById,
	getBoardAsset,
	getBoards,
	getVersions,
	reactToComment,
	restoreVersion,
	shareBoard,
	toggleFavorite,
	updateBoard,
	uploadBoardAsset,
} from '../controllers/whiteboard.controller';
import { validateObjectId } from '../middleware/validateObjectId';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate, requireEntitlement('tasksProjects'));

router.get('/', getBoards);
router.post('/', createBoard);
router.get('/:id/versions', validateObjectId('id'), getVersions);
router.post('/:id/versions/:versionId/restore', validateObjectId('id', 'versionId'), restoreVersion);
router.post('/:id/assets', validateObjectId('id'), requireEntitlement('fileStorage'), upload.single('file'), uploadBoardAsset);
router.get('/:id/assets/:assetId', validateObjectId('id'), getBoardAsset);
router.post('/:id/comments', validateObjectId('id'), addComment);
router.post('/:id/comments/:commentId/reactions', validateObjectId('id', 'commentId'), reactToComment);
router.post('/:id/share', validateObjectId('id'), shareBoard);
router.post('/:id/duplicate', validateObjectId('id'), duplicateBoard);
router.patch('/:id/favorite', validateObjectId('id'), toggleFavorite);
router.patch('/:id/archive', validateObjectId('id'), archiveBoard);
router.post('/:id/to-tasks', validateObjectId('id'), convertBoardToTasks);
router.post('/:id/to-project', validateObjectId('id'), convertBoardToProject);
router.get('/:id', validateObjectId('id'), getBoardById);
router.patch('/:id', validateObjectId('id'), updateBoard);
router.delete('/:id', validateObjectId('id'), deleteBoard);

export default router;