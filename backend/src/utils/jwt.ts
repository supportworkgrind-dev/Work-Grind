import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface TokenPayload {
  userId: string;
  companyId: string;
  role: string;
  isSuperAdmin?: boolean;
  mfaPending?: boolean;
  mfaAuthenticated?: boolean;
}

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET is missing from environment');
  }
  return secret;
};

export const getRefreshJwtSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_REFRESH_SECRET is missing from environment');
  }
  return secret;
};

export const getBearerToken = (header?: string): string | null => {
  if (!header) return null;
  const candidate = header.startsWith('Bearer ') ? header.slice(7) : header;
  const token = candidate.trim();
  return token || null;
};

export const generateAccessToken = (p: TokenPayload) =>
  jwt.sign(p, getJwtSecret(), { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any });

export const generateMfaChallengeToken = (userId: string, companyId: string) =>
  jwt.sign(
    { userId, companyId, role: 'super_admin', isSuperAdmin: true, mfaPending: true },
    getJwtSecret(),
    { expiresIn: '5m' },
  );

export const generateRefreshToken = (p: TokenPayload) =>
  jwt.sign({ ...p, jti: uuidv4() }, getRefreshJwtSecret(), { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any });

export const verifyAccessToken = (t: string) => {
  const payload = jwt.verify(t, getJwtSecret()) as TokenPayload & { phoneVerificationPending?: boolean };
  if (payload.phoneVerificationPending) throw new Error('Deprecated phone verification token');
  return payload;
};
export const verifyRefreshToken = (t: string) => jwt.verify(t, getRefreshJwtSecret()) as TokenPayload & { jti: string };
