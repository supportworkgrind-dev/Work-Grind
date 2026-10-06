import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { ensureUserCallingId, isValidCallingId, normalizeCallingId } from '../services/callingId';
import { getUserPresence } from '../utils/socket';

export async function getMyCallingId(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findOne({ _id: req.user!.userId, isActive: true, isDeleted: { $ne: true } }).select('_id');
  if (!user) {
    res.status(403).json({ success: false, message: 'Calling ID is unavailable for this account.' });
    return;
  }
  const callingId = await ensureUserCallingId(user._id);
  res.json({ success: true, callingId });
}

export const generateMyCallingId = getMyCallingId;

export async function resolveCallingId(req: AuthRequest, res: Response): Promise<void> {
  const callingId = normalizeCallingId(req.params.callingId);
  if (!isValidCallingId(callingId)) {
    res.status(400).json({ success: false, code: 'INVALID_CALLING_ID', message: 'Enter a valid WorkGrind Calling ID.' });
    return;
  }
  const user = await User.findOne({
    callingId,
    isActive: true,
    isDeleted: { $ne: true },
  }).select('callingId fullName avatar status incomingCallPrivacy').lean();
  if (!user) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Calling] Lookup miss', { requestedCallingId: callingId });
    }
    res.status(404).json({ success: false, code: 'CALLING_ID_NOT_FOUND', message: 'Calling ID is unavailable.' });
    return;
  }

  const presence = await getUserPresence(user._id.toString());
  const availability = presence?.availability ?? 'offline';

  if (process.env.NODE_ENV !== 'production') {
    console.info('[Calling] Lookup resolved', {
      resolvedUserId: user._id.toString(),
      callingId: user.callingId,
      availability,
    });
  }

  res.json({
    success: true,
    user: {
      callingId: user.callingId,
      displayName: user.fullName,
      avatar: user.avatar || null,
      availability,
    },
  });
}

export async function checkCallingIdAvailability(req: AuthRequest, res: Response): Promise<void> {
  const callingId = normalizeCallingId(req.params.callingId);
  if (!isValidCallingId(callingId)) {
    res.status(400).json({ success: false, code: 'INVALID_CALLING_ID', message: 'Calling IDs use the format WG-48291.' });
    return;
  }
  const alreadyAssigned = await User.exists({ callingId });
  res.json({ success: true, callingId, available: !alreadyAssigned });
}

export async function backfillWorkspaceCallingIds(req: AuthRequest, res: Response): Promise<void> {
  const cursor = User.find({
    companyId: req.user!.companyId,
    isActive: true,
    isDeleted: { $ne: true },
    $or: [
      { callingId: { $exists: false } },
      { callingId: null },
      { callingId: '' },
    ],
  }).select('_id').cursor();

  let generated = 0;
  for await (const user of cursor) {
    await ensureUserCallingId(user._id);
    generated += 1;
  }
  res.json({ success: true, generated });
}
