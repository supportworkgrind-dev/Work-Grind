import mongoose from 'mongoose';
import Board, { BoardPermission, IBoard } from '../models/Board';

const PERMISSION_LEVEL: Record<BoardPermission, number> = { view: 1, comment: 2, edit: 3 };

export function permissionForBoard(board: Pick<IBoard, 'createdBy' | 'visibility' | 'workspacePermission' | 'members'>, userId: string, role: string): BoardPermission | null {
  if (board.createdBy.toString() === userId || role === 'owner' || role === 'admin') return 'edit';

  const directMember = board.members.find((member) => member.userId.toString() === userId);
  if (directMember) return directMember.permission;
  if (board.visibility === 'workspace') return board.workspacePermission;
  return null;
}

export function permitsPermission(actual: BoardPermission | null, required: BoardPermission): boolean {
  return actual !== null && PERMISSION_LEVEL[actual] >= PERMISSION_LEVEL[required];
}

export async function findAccessibleBoard(options: {
  boardId: string;
  companyId: string;
  userId: string;
  role: string;
  permission: BoardPermission;
  includeArchived?: boolean;
}): Promise<IBoard | null> {
  if (!mongoose.isValidObjectId(options.boardId) || !mongoose.isValidObjectId(options.companyId)) return null;

  const board = await Board.findOne({
    _id: options.boardId,
    companyId: options.companyId,
    ...(options.includeArchived ? {} : { archivedAt: null }),
  });
  if (!board || !permitsPermission(permissionForBoard(board, options.userId, options.role), options.permission)) return null;
  return board;
}