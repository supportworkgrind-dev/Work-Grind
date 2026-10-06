import mongoose from 'mongoose';
import User from '../models/User';
import { normalizeRefreshTokenStore } from './pendingRegistration';

const MIGRATION_ID = 'refresh-token-hash-v1';
const LEGACY_TOKEN_PATTERN = /^(?![a-f0-9]{64}$).+/;

export async function migrateRefreshTokensAtRest(): Promise<void> {
  const migrations = mongoose.connection.collection<any>('auth_migrations');
  if (await migrations.findOne({ _id: MIGRATION_ID })) return;

  let migratedUsers = 0;
  const cursor = User.find({
    refreshTokens: { $elemMatch: { $regex: LEGACY_TOKEN_PATTERN } },
  }).select('refreshTokens').lean().cursor();

  for await (const user of cursor) {
    const previousTokens = user.refreshTokens || [];
    const hashedTokens = normalizeRefreshTokenStore(previousTokens);
    const result = await User.updateOne(
      { _id: user._id, refreshTokens: previousTokens },
      { $set: { refreshTokens: hashedTokens } },
    );
    if (result.modifiedCount === 1) migratedUsers += 1;
  }

  await migrations.updateOne(
    { _id: MIGRATION_ID },
    { $setOnInsert: { completedAt: new Date() } },
    { upsert: true },
  );
  console.info(`[Auth] Hashed refresh tokens for ${migratedUsers} existing accounts.`);
}

export async function cleanupExpiredVerificationCodes(): Promise<void> {
  await User.updateMany(
    { verificationCodeExpiry: { $lte: new Date() } },
    {
      $unset: {
        verificationCodeHash: 1,
        verificationCodeExpiry: 1,
        verificationCodeAttempts: 1,
        verificationCodeResends: 1,
        verificationCodeSentAt: 1,
      },
    },
  );
}
