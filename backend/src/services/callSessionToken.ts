import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/jwt';

export interface CallSessionTokenPayload {
  purpose: 'workgrind-call-session';
  sessionId: string;
  userId: string;
}

const TOKEN_AUDIENCE = 'workgrind-call-media';

export function createCallSessionToken(sessionId: string, userId: string): string {
  return jwt.sign(
    { purpose: 'workgrind-call-session', sessionId, userId },
    getJwtSecret(),
    { audience: TOKEN_AUDIENCE, expiresIn: '3m' },
  );
}

export function verifyCallSessionToken(token: string): CallSessionTokenPayload {
  const payload = jwt.verify(token, getJwtSecret(), { audience: TOKEN_AUDIENCE }) as jwt.JwtPayload & Partial<CallSessionTokenPayload>;
  if (payload.purpose !== 'workgrind-call-session' || typeof payload.sessionId !== 'string' || typeof payload.userId !== 'string') {
    throw new Error('Invalid call session token.');
  }
  return payload as CallSessionTokenPayload;
}
