import { randomInt } from 'crypto';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';

function isCallingIdCollision(error: any): boolean {
  return error?.code === 11000 && (error?.keyPattern?.callingId || String(error?.message || '').includes('callingId_unique'));
}

export async function generateAvailableCallingId(): Promise<string> {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const digits = 5 + Math.floor(attempt / 16);
    const candidate = `WG-${randomInt(10 ** (digits - 1), 10 ** digits)}`;
    if (!await User.exists({ callingId: candidate })) return candidate;
  }
  throw new Error('Unable to allocate a unique WorkGrind Calling ID.');
}

export async function createWorkGrindUser(data: Record<string, unknown>): Promise<IUser> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const callingId = await generateAvailableCallingId();
    try {
      return await User.create({ ...data, callingId } as Partial<IUser>);
    } catch (error) {
      if (!isCallingIdCollision(error)) throw error;
    }
  }
  throw new Error('Unable to allocate a unique WorkGrind Calling ID.');
}

export async function ensureUserCallingId(userId: string | mongoose.Types.ObjectId): Promise<string> {
  const current = await User.findById(userId).select('callingId');
  if (!current) throw new Error('User not found.');
  if (current.callingId) return current.callingId;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const callingId = await generateAvailableCallingId();
    try {
      const updated = await User.findOneAndUpdate(
        {
          _id: userId,
          $or: [
            { callingId: { $exists: false } },
            { callingId: null },
            { callingId: '' },
          ],
        },
        { $set: { callingId } },
        { new: true, runValidators: true },
      ).select('callingId');
      if (updated?.callingId) return updated.callingId;

      const latest = await User.findById(userId).select('callingId');
      if (!latest) throw new Error('User not found.');
      if (latest.callingId) return latest.callingId;
    } catch (error) {
      if (!isCallingIdCollision(error)) throw error;
    }
  }
  throw new Error('Unable to allocate a unique WorkGrind Calling ID.');
}

export function normalizeCallingId(value: string): string {
  const normalized = value.trim().toUpperCase();
  return /^\d{5,8}$/.test(normalized) ? `WG-${normalized}` : normalized;
}

export function isValidCallingId(value: string): boolean {
  return /^WG-\d{5,8}$/.test(value);
}
