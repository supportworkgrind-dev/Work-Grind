import { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import Board, { BoardPermission } from '../models/Board';
import Project from '../models/Project';
import Task from '../models/Task';
import User from '../models/User';
import { emitToCompany, getIO } from '../utils/socket';
import { findAccessibleBoard, permissionForBoard, permitsPermission } from '../services/boardAccess';
import { isR2Configured, uploadFile as r2Upload, deleteFile as r2Delete, readPrivateFile } from '../services/r2Storage';
import { releaseStorage, reserveStorage } from '../utils/planLimits';

const MAX_SCENE_BYTES = 6 * 1024 * 1024;
const MAX_SCENE_ELEMENTS = 2500;
const MAX_VERSIONS = 20;
const VERSION_INTERVAL_MS = 10 * 60 * 1000;
const SCENE_TYPES = new Set(['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'image', 'frame', 'magicframe', 'embeddable']);
const asyncHandler = (handler: (req: AuthRequest, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req as AuthRequest, res).catch(next);
  };

const userId = (req: AuthRequest) => req.user!.userId;
const companyId = (req: AuthRequest) => req.user!.companyId;
const userRole = (req: AuthRequest) => req.user!.role;
const boardRoom = (id: string) => `board:${id}`;

function sceneFromInput(input: any): { elements: any[]; appState: Record<string, unknown> } | null {
  if (!input || !Array.isArray(input.elements) || input.elements.length > MAX_SCENE_ELEMENTS) return null;

  let encoded: string;
  try {
    encoded = JSON.stringify(input);
  } catch {
    return null;
  }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_SCENE_BYTES) return null;

  const elements = input.elements.filter((element: any) =>
    element && typeof element === 'object' && typeof element.id === 'string' && element.id.length <= 100 && SCENE_TYPES.has(element.type)
  );
  const sourceState = input.appState && typeof input.appState === 'object' ? input.appState : {};
  const appState: Record<string, unknown> = {};
  for (const key of ['viewBackgroundColor', 'scrollX', 'scrollY', 'zoom', 'gridSize', 'theme']) {
    const value = sourceState[key];
    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) appState[key] = value;
  }
  return { elements, appState };
}

function sceneChanged(a: any, b: any): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function broadcastBoard(board: any, event = 'board:changed') {
  getIO()?.to(boardRoom(board._id.toString())).emit(event, {
    boardId: board._id.toString(),
    name: board.name,
    content: board.content,
    updatedAt: board.updatedAt,
    lastEditedBy: board.lastEditedBy?.toString(),
  });
}

function populateBoard(board: any) {
  return board.populate([
    { path: 'createdBy', select: 'fullName avatar' },
    { path: 'lastEditedBy', select: 'fullName avatar' },
    { path: 'members.userId', select: 'fullName avatar email' },
    { path: 'comments.userId', select: 'fullName avatar' },
    { path: 'comments.mentions', select: 'fullName avatar' },
  ]).then((populated: any) => {
    const output = populated.toObject();
    output.assets = populated.assets.map((asset: any) => ({
      assetId: asset.assetId,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.size,
      excalidrawFileId: asset.excalidrawFileId,
    }));
    return output;
  });
}

function matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/gif') return buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

const requireBoard = async (req: AuthRequest, res: Response, permission: BoardPermission, includeArchived = false) => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Workspace membership required.' });
    return null;
  }
  const board = await findAccessibleBoard({
    boardId: req.params.id,
    companyId: companyId(req),
    userId: userId(req),
    role: userRole(req),
    permission,
    includeArchived,
  });
  if (!board) res.status(404).json({ success: false, message: 'Board not found.' });
  return board;
};

export const getBoards = asyncHandler(async (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Workspace membership required.' });
    return;
  }

  const filter: Record<string, any> = {
    companyId: companyId(req),
    archivedAt: req.query.archived === 'true' ? { $ne: null } : null,
    $or: [
      { visibility: 'workspace' },
      { createdBy: userId(req) },
      { 'members.userId': userId(req) },
    ],
  };
  if (req.query.search && typeof req.query.search === 'string') {
    filter.name = { $regex: req.query.search.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (req.query.favorite === 'true') filter.favorites = userId(req);

  const boards = await Board.find(filter)
    .select('name description visibility workspacePermission createdBy lastEditedBy favorites projectId meetingId documentId createdAt updatedAt')
    .populate('createdBy', 'fullName avatar')
    .populate('lastEditedBy', 'fullName avatar')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, boards });
});

export const createBoard = asyncHandler(async (req, res) => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Workspace membership required.' });
    return;
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
  if (!name) {
    res.status(400).json({ success: false, message: 'Board name is required.' });
    return;
  }
  const content = req.body.content === undefined ? { elements: [], appState: {} } : sceneFromInput(req.body.content);
  if (!content) {
    res.status(400).json({ success: false, message: 'Board content is invalid or exceeds the supported size.' });
    return;
  }

  const board = await Board.create({
    companyId: companyId(req),
    createdBy: userId(req),
    name,
    description: typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 500) : '',
    visibility: req.body.visibility === 'private' ? 'private' : 'workspace',
    workspacePermission: ['view', 'comment', 'edit'].includes(req.body.workspacePermission) ? req.body.workspacePermission : 'edit',
    content,
  });
  res.status(201).json({ success: true, board: await populateBoard(board) });
});

export const getBoardById = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'view', true);
  if (!board) return;
  if (board.archivedAt && userRole(req) !== 'owner' && userRole(req) !== 'admin' && board.createdBy.toString() !== userId(req)) {
    res.status(404).json({ success: false, message: 'Board not found.' });
    return;
  }
  res.json({
    success: true,
    board: await populateBoard(board),
    permission: permissionForBoard(board, userId(req), userRole(req)),
  });
});

export const updateBoard = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit');
  if (!board) return;

  const { name, description, content, visibility, workspacePermission, projectId, meetingId, documentId } = req.body || {};
  if (typeof name === 'string') board.name = name.trim().slice(0, 120) || board.name;
  if (typeof description === 'string') board.description = description.trim().slice(0, 500);

  if (visibility !== undefined || workspacePermission !== undefined) {
    if (board.createdBy.toString() !== userId(req) && userRole(req) !== 'owner' && userRole(req) !== 'admin') {
      res.status(403).json({ success: false, message: 'Only the board owner or workspace administrator can change sharing.' });
      return;
    }
    if (visibility !== undefined) {
      if (!['private', 'workspace'].includes(visibility)) {
        res.status(400).json({ success: false, message: 'Invalid board visibility.' });
        return;
      }
      board.visibility = visibility;
    }
    if (workspacePermission !== undefined) {
      if (!['view', 'comment', 'edit'].includes(workspacePermission)) {
        res.status(400).json({ success: false, message: 'Invalid workspace permission.' });
        return;
      }
      board.workspacePermission = workspacePermission;
    }
  }

  if (content !== undefined) {
    if (req.body.baseUpdatedAt) {
      const submittedAt = new Date(req.body.baseUpdatedAt).getTime();
      if (!Number.isFinite(submittedAt) || submittedAt !== board.updatedAt.getTime()) {
        res.status(409).json({ success: false, code: 'BOARD_VERSION_CONFLICT', message: 'This board changed elsewhere. Reload the latest version before saving.', updatedAt: board.updatedAt });
        return;
      }
    }
    const nextContent = sceneFromInput(content);
    if (!nextContent) {
      res.status(400).json({ success: false, message: 'Board content is invalid or exceeds the supported size.' });
      return;
    }
    if (sceneChanged(board.content, nextContent)) {
      const lastVersionAt = board.versions[board.versions.length - 1]?.createdAt?.getTime() ?? 0;
      if (!lastVersionAt || Date.now() - lastVersionAt >= VERSION_INTERVAL_MS) {
        board.versions.push({
          name: `Snapshot ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
          content: board.content,
          createdBy: new mongoose.Types.ObjectId(userId(req)),
          createdAt: new Date(),
        } as any);
        if (board.versions.length > MAX_VERSIONS) board.versions.splice(0, board.versions.length - MAX_VERSIONS);
      }
      board.content = nextContent;
    }
  }

  const associations = [
    ['projectId', projectId, Project],
  ] as const;
  for (const [field, value, Model] of associations) {
    if (value === undefined) continue;
    if (value === null || value === '') {
      (board as any)[field] = undefined;
      continue;
    }
    if (!mongoose.isValidObjectId(value) || !await Model.exists({ _id: value, companyId: companyId(req) })) {
      res.status(400).json({ success: false, message: `Invalid ${field}.` });
      return;
    }
    (board as any)[field] = value;
  }
  if (meetingId !== undefined) {
    if (meetingId === null || meetingId === '') board.meetingId = undefined;
    else if (mongoose.isValidObjectId(meetingId) && await mongoose.model('Meeting').exists({ _id: meetingId, companyId: companyId(req) })) board.meetingId = meetingId;
    else { res.status(400).json({ success: false, message: 'Invalid meetingId.' }); return; }
  }
  if (documentId !== undefined) {
    if (documentId === null || documentId === '') board.documentId = undefined;
    else if (mongoose.isValidObjectId(documentId) && await mongoose.model('Document').exists({ _id: documentId, companyId: companyId(req) })) board.documentId = documentId;
    else { res.status(400).json({ success: false, message: 'Invalid documentId.' }); return; }
  }

  board.lastEditedBy = new mongoose.Types.ObjectId(userId(req));
  await board.save();
  broadcastBoard(board);
  res.json({ success: true, board: await populateBoard(board) });
});

export const deleteBoard = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit', true);
  if (!board) return;
  if (board.createdBy.toString() !== userId(req) && userRole(req) !== 'owner' && userRole(req) !== 'admin') {
    res.status(403).json({ success: false, message: 'Only the board owner or workspace administrator can delete this board.' });
    return;
  }
  for (const asset of board.assets) {
    if (asset.storageKey) {
      const referencedElsewhere = await Board.exists({ _id: { $ne: board._id }, companyId: companyId(req), 'assets.storageKey': asset.storageKey });
      if (!referencedElsewhere) await r2Delete(asset.storageKey);
    }
  }
  const releasedBytes = board.assets.reduce((total, asset) => total + (asset.size || 0), 0);
  await Board.deleteOne({ _id: board._id, companyId: companyId(req) });
  if (releasedBytes) await releaseStorage(userId(req), releasedBytes);
  getIO()?.to(boardRoom(board._id.toString())).emit('board:deleted', { boardId: board._id.toString() });
  res.json({ success: true });
});

export const duplicateBoard = asyncHandler(async (req, res) => {
  const source = await requireBoard(req, res, 'view');
  if (!source) return;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : `${source.name} copy`.slice(0, 120);
  const board = await Board.create({
    companyId: companyId(req),
    createdBy: userId(req),
    name: name || `${source.name} copy`.slice(0, 120),
    description: source.description,
    visibility: 'private',
    content: source.content,
    assets: source.assets.map((asset: any) => ({ ...asset.toObject(), _id: undefined, uploadedBy: userId(req) })),
    projectId: source.projectId,
    meetingId: source.meetingId,
    documentId: source.documentId,
  });
  res.status(201).json({ success: true, board: await populateBoard(board) });
});

export const uploadBoardAsset = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit');
  if (!board) return;
  if (!req.file || !req.file.mimetype.startsWith('image/') || req.file.size > 10 * 1024 * 1024 || !matchesImageSignature(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ success: false, message: 'Upload a valid PNG, JPEG, GIF, or WEBP image under 10 MB.' });
    return;
  }
  const excalidrawFileId = typeof req.body?.excalidrawFileId === 'string' ? req.body.excalidrawFileId : '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(excalidrawFileId)) {
    res.status(400).json({ success: false, message: 'Invalid canvas file ID.' });
    return;
  }
  if (!isR2Configured()) {
    res.status(503).json({ success: false, code: 'R2_NOT_CONFIGURED', message: 'Private image storage is not configured for this workspace.' });
    return;
  }

  const reservation = await reserveStorage(userId(req), req.file.size);
  if (!reservation.allowed) {
    res.status(403).json({ success: false, code: reservation.code, message: reservation.reason, requiresUpgrade: reservation.upgrade });
    return;
  }
  let storageKey = '';
  try {
    const uploadResult = await r2Upload({ companyId: companyId(req), originalName: req.file.originalname, buffer: req.file.buffer, mimeType: req.file.mimetype, size: req.file.size });
    storageKey = uploadResult.key;
    const assetId = uuidv4();
    board.assets.push({ assetId, fileName: req.file.originalname.slice(0, 180), mimeType: req.file.mimetype, size: req.file.size, storageKey, excalidrawFileId, uploadedBy: new mongoose.Types.ObjectId(userId(req)) } as any);
    await board.save();
    res.status(201).json({ success: true, asset: { assetId, excalidrawFileId, mimeType: req.file.mimetype, size: req.file.size } });
  } catch (error) {
    if (storageKey) await r2Delete(storageKey).catch(() => undefined);
    await releaseStorage(userId(req), req.file.size).catch(() => undefined);
    throw error;
  }
});

export const getBoardAsset = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'view', true);
  if (!board) return;
  const asset = board.assets.find((item) => item.assetId === req.params.assetId);
  if (!asset?.storageKey) {
    res.status(404).json({ success: false, message: 'Image not found.' });
    return;
  }
  const file = await readPrivateFile(asset.storageKey);
  if (!file || !file.mimeType.startsWith('image/')) {
    res.status(404).json({ success: false, message: 'Image not found.' });
    return;
  }
  res.set({ 'Content-Type': file.mimeType, 'Content-Length': String(file.buffer.length), 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(file.buffer);
});

export const shareBoard = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit');
  if (!board) return;
  if (board.createdBy.toString() !== userId(req) && userRole(req) !== 'owner' && userRole(req) !== 'admin') {
    res.status(403).json({ success: false, message: 'Only the board owner or workspace administrator can manage access.' });
    return;
  }
  const members = Array.isArray(req.body?.members) ? req.body.members.slice(0, 100) : null;
  if (!members) {
    res.status(400).json({ success: false, message: 'Members must be an array.' });
    return;
  }
  const ids = members.map((member: any) => String(member?.userId ?? ''));
  if (ids.some((id: string) => !mongoose.isValidObjectId(id))) {
    res.status(400).json({ success: false, message: 'A board member ID is invalid.' });
    return;
  }
  const users = await User.find({ _id: { $in: ids }, companyId: companyId(req), isActive: true }).select('_id');
  if (users.length !== new Set(ids).size) {
    res.status(400).json({ success: false, message: 'Every invited person must be an active member of this workspace.' });
    return;
  }
  board.members = members.map((member: any) => ({
    userId: new mongoose.Types.ObjectId(String(member.userId)),
    permission: (['view', 'comment', 'edit'].includes(member.permission) ? member.permission : 'view') as BoardPermission,
  })) as any;
  await board.save();
  res.json({ success: true, board: await populateBoard(board) });
});

export const toggleFavorite = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'view', true);
  if (!board) return;
  const index = board.favorites.findIndex((id) => id.toString() === userId(req));
  if (index >= 0) board.favorites.splice(index, 1);
  else board.favorites.push(new mongoose.Types.ObjectId(userId(req)));
  await board.save();
  res.json({ success: true, isFavorite: index < 0 });
});

export const archiveBoard = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit', true);
  if (!board) return;
  if (board.createdBy.toString() !== userId(req) && userRole(req) !== 'owner' && userRole(req) !== 'admin') {
    res.status(403).json({ success: false, message: 'Only the board owner or workspace administrator can archive this board.' });
    return;
  }
  board.archivedAt = req.body?.archived === false ? undefined : new Date();
  await board.save();
  res.json({ success: true, board });
});

export const getVersions = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'view', true);
  if (!board) return;
  const versions = await Board.findById(board._id).select('versions').populate('versions.createdBy', 'fullName avatar').lean();
  res.json({ success: true, versions: versions?.versions ?? [] });
});

export const restoreVersion = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit', true);
  if (!board) return;
  const version = board.versions.find((item: any) => item._id.toString() === req.params.versionId);
  if (!version) {
    res.status(404).json({ success: false, message: 'Version not found.' });
    return;
  }
  board.versions.push({ name: `Before restore ${new Date().toLocaleString()}`, content: board.content, createdBy: new mongoose.Types.ObjectId(userId(req)), createdAt: new Date() } as any);
  if (board.versions.length > MAX_VERSIONS) board.versions.splice(0, board.versions.length - MAX_VERSIONS);
  board.content = version.content;
  board.lastEditedBy = new mongoose.Types.ObjectId(userId(req));
  await board.save();
  broadcastBoard(board);
  res.json({ success: true, board: await populateBoard(board) });
});

export const addComment = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'comment');
  if (!board) return;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim().slice(0, 2000) : '';
  if (!content) {
    res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
    return;
  }
  const mentionIds = Array.isArray(req.body.mentions) ? req.body.mentions.slice(0, 30).map(String) : [];
  if (mentionIds.some((id: string) => !mongoose.isValidObjectId(id))) {
    res.status(400).json({ success: false, message: 'A mention ID is invalid.' });
    return;
  }
  const validUsers = await User.find({ _id: { $in: mentionIds }, companyId: companyId(req), isActive: true }).select('_id');
  if (validUsers.length !== new Set(mentionIds).size) {
    res.status(400).json({ success: false, message: 'Mentions must refer to active members of this workspace.' });
    return;
  }
  board.comments.push({ userId: new mongoose.Types.ObjectId(userId(req)), content, mentions: validUsers.map((user) => user._id), reactions: [], createdAt: new Date() } as any);
  await board.save();
  const populated = await populateBoard(board);
  const comment = populated.comments[populated.comments.length - 1];
  getIO()?.to(boardRoom(board._id.toString())).emit('board:comment', { boardId: board._id.toString(), comment });
  res.status(201).json({ success: true, comment });
});

export const reactToComment = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'comment');
  if (!board) return;
  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji : '';
  if (!['👍', '❤️', '🎉', '👀', '✅'].includes(emoji)) {
    res.status(400).json({ success: false, message: 'Unsupported reaction.' });
    return;
  }
  const comment = board.comments.find((item: any) => item._id.toString() === req.params.commentId);
  if (!comment) {
    res.status(404).json({ success: false, message: 'Comment not found.' });
    return;
  }
  const existing = comment.reactions.findIndex((reaction: any) => reaction.userId.toString() === userId(req) && reaction.emoji === emoji);
  if (existing >= 0) comment.reactions.splice(existing, 1);
  else comment.reactions.push({ userId: new mongoose.Types.ObjectId(userId(req)), emoji } as any);
  await board.save();
  res.json({ success: true, reactions: comment.reactions });
});

export const convertBoardToTasks = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit');
  if (!board) return;
  if (!['owner', 'admin', 'manager'].includes(userRole(req))) {
    res.status(403).json({ success: false, message: 'A manager role is required to create workspace tasks.' });
    return;
  }
  const selected = Array.isArray(req.body?.elementIds) ? new Set(req.body.elementIds.map(String)) : null;
  const stickyNotes = board.content.elements.filter((element: any) =>
    element?.type === 'text' && typeof element.text === 'string' && element.text.trim() && (!selected || selected.has(String(element.id)))
  ).slice(0, 40);
  if (!stickyNotes.length) {
    res.status(400).json({ success: false, message: 'Select at least one text item to convert.' });
    return;
  }
  const tasks = await Task.create(stickyNotes.map((element: any) => ({
    companyId: companyId(req),
    creatorId: userId(req),
    title: element.text.trim().replace(/\s+/g, ' ').slice(0, 200),
    description: `Created from whiteboard: ${board.name}`,
    projectId: board.projectId,
    priority: 'medium',
    status: 'todo',
    tags: ['whiteboard'],
  })));
  tasks.forEach((task) => emitToCompany(companyId(req), 'task:created', task));
  res.status(201).json({ success: true, tasks });
});

export const convertBoardToProject = asyncHandler(async (req, res) => {
  const board = await requireBoard(req, res, 'edit');
  if (!board) return;
  if (!['owner', 'admin', 'manager'].includes(userRole(req))) {
    res.status(403).json({ success: false, message: 'A manager role is required to create workspace projects.' });
    return;
  }
  const notes = board.content.elements.filter((element: any) => element?.type === 'text' && typeof element.text === 'string' && element.text.trim()).slice(0, 40);
  const project = await Project.create({
    companyId: companyId(req),
    managerId: userId(req),
    assigneeId: userId(req),
    name: board.name.slice(0, 100),
    description: board.description || 'Created from a WorkGrind whiteboard.',
    status: 'planning',
    priority: 'medium',
    members: [{ userId: new mongoose.Types.ObjectId(userId(req)), role: 'manager' }],
    progress: 0,
  });
  const tasks = notes.length ? await Task.create(notes.map((note: any) => ({
    companyId: companyId(req),
    creatorId: userId(req),
    projectId: project._id,
    title: note.text.trim().replace(/\s+/g, ' ').slice(0, 200),
    description: `Created from whiteboard: ${board.name}`,
    priority: 'medium',
    status: 'todo',
    tags: ['whiteboard'],
  }))) : [];
  board.projectId = project._id;
  await board.save();
  emitToCompany(companyId(req), 'project:created', project);
  tasks.forEach((task) => emitToCompany(companyId(req), 'task:created', task));
  res.status(201).json({ success: true, project, tasks });
});

export const verifyBoardSocketAccess = async (boardId: string, company: string, user: string, role: string) => {
  const board = await Board.findOne({ _id: boardId, companyId: company, archivedAt: null }).select('createdBy visibility workspacePermission members').lean();
  return Boolean(board && permitsPermission(permissionForBoard(board as any, user, role), 'view'));
};