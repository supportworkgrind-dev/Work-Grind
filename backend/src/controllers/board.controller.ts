import { Response } from 'express';
import mongoose from 'mongoose';
import Board, { WhiteboardElementType } from '../models/Board';
import { AuthRequest } from '../middleware/auth';

type BoardElementInput = {
  id?: string;
  type?: WhiteboardElementType;
  color?: string;
  width?: number;
  fill?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
};

const DEFAULT_CONTENT = {
  background: '#f8fafc',
  viewport: { zoom: 1, x: 0, y: 0 },
  elements: [],
};

const sanitizeElement = (element: BoardElementInput = {}) => {
  const type = ['stroke', 'rect', 'circle', 'text'].includes(String(element.type || '')) ? element.type as WhiteboardElementType : 'stroke';
  const normalized: Record<string, any> = { id: element.id || `item-${Math.random().toString(36).slice(2, 10)}`, type };

  if (typeof element.color === 'string') normalized.color = element.color;
  if (typeof element.width === 'number') normalized.width = Math.max(1, Math.min(12, element.width));
  if (typeof element.fill === 'string') normalized.fill = element.fill;
  if (typeof element.x === 'number') normalized.x = element.x;
  if (typeof element.y === 'number') normalized.y = element.y;
  if (typeof element.w === 'number') normalized.w = Math.max(0, element.w);
  if (typeof element.h === 'number') normalized.h = Math.max(0, element.h);
  if (typeof element.r === 'number') normalized.r = element.r;
  if (Array.isArray(element.points)) normalized.points = element.points.slice(0, 1500).map((p) => ({ x: Number(p?.x ?? 0), y: Number(p?.y ?? 0) }));
  if (typeof element.text === 'string') normalized.text = element.text.slice(0, 500);
  if (typeof element.fontSize === 'number') normalized.fontSize = Math.max(10, Math.min(72, element.fontSize));
  if (typeof element.fontWeight === 'number') normalized.fontWeight = Math.max(400, Math.min(800, element.fontWeight));

  return normalized;
};

const sanitizeContent = (content: any) => {
  const safeContent = { ...DEFAULT_CONTENT, ...(content ?? {}) };

  if (!safeContent.viewport || typeof safeContent.viewport !== 'object') {
    safeContent.viewport = { zoom: 1, x: 0, y: 0 };
  }

  safeContent.viewport = {
    zoom: Number(safeContent.viewport.zoom ?? 1),
    x: Number(safeContent.viewport.x ?? 0),
    y: Number(safeContent.viewport.y ?? 0),
  };

  safeContent.background = typeof safeContent.background === 'string' ? safeContent.background : '#f8fafc';
  safeContent.elements = Array.isArray(safeContent.elements) ? safeContent.elements.slice(0, 500).map(sanitizeElement) : [];
  return safeContent;
};

export const getBoards = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Company membership required.' });
    return;
  }

  const boards = await Board.find({ companyId: req.user.companyId }).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, boards });
};

export const createBoard = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Company membership required.' });
    return;
  }

  const { name, description, content } = req.body || {};
  const boardName = typeof name === 'string' ? name.trim() : '';

  if (!boardName) {
    res.status(400).json({ success: false, message: 'Board name is required.' });
    return;
  }

  const board = await Board.create({
    companyId: req.user.companyId,
    createdBy: req.user.userId,
    name: boardName,
    description: typeof description === 'string' ? description.trim().slice(0, 500) : '',
    content: sanitizeContent(content),
  });

  res.status(201).json({ success: true, board });
};

export const getBoardById = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Company membership required.' });
    return;
  }

  const board = await Board.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
  if (!board) {
    res.status(404).json({ success: false, message: 'Board not found.' });
    return;
  }

  res.json({ success: true, board });
};

export const updateBoard = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Company membership required.' });
    return;
  }

  const board = await Board.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!board) {
    res.status(404).json({ success: false, message: 'Board not found.' });
    return;
  }

  const { name, description, content } = req.body || {};

  if (typeof name === 'string') {
    board.name = name.trim() || board.name;
  }

  if (typeof description === 'string') {
    board.description = description.trim().slice(0, 500);
  }

  if (content !== undefined) {
    board.content = sanitizeContent(content);
  }

  board.lastEditedBy = new mongoose.Types.ObjectId(req.user.userId);
  await board.save();

  res.json({ success: true, board });
};

export const deleteBoard = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.companyId) {
    res.status(403).json({ success: false, message: 'Company membership required.' });
    return;
  }

  const result = await Board.deleteOne({ _id: req.params.id, companyId: req.user.companyId });
  if (result.deletedCount === 0) {
    res.status(404).json({ success: false, message: 'Board not found.' });
    return;
  }

  res.json({ success: true });
};