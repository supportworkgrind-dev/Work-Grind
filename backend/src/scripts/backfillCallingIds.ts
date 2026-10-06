import mongoose from 'mongoose';
import { connectDB } from '../utils/db';
import User from '../models/User';
import { ensureUserCallingId } from '../services/callingId';

async function backfillCallingIds(): Promise<void> {
  const connection = await connectDB();
  if (!connection) {
    throw new Error('MONGODB_URI must be configured to backfill Calling IDs.');
  }

  const missingCallingIdFilter = {
    isActive: true,
    isDeleted: { $ne: true },
    $or: [
      { callingId: { $exists: false } },
      { callingId: null },
      { callingId: '' },
    ],
  };

  let generated = 0;
  while (true) {
    const users = await User.find(missingCallingIdFilter)
      .sort({ _id: 1 })
      .select('_id')
      .limit(500)
      .lean();
    if (users.length === 0) break;
    for (const user of users) {
      await ensureUserCallingId(user._id);
      generated += 1;
    }
  }
  console.log(`Calling ID backfill complete: ${generated} active accounts assigned an ID.`);
  await mongoose.disconnect();
}

backfillCallingIds().catch(async (error) => {
  console.error('Calling ID backfill failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // Preserve the original backfill error.
  }
  process.exitCode = 1;
});
