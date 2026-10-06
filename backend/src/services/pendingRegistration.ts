import crypto from 'crypto';
import { getJwtSecret } from '../utils/jwt';

const deriveKey = () => crypto.createHash('sha256').update(getJwtSecret()).digest();

export const encryptPendingPassword = (password: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return {
    passwordCiphertext: ciphertext.toString('hex'),
    passwordIv: iv.toString('hex'),
    passwordAuthTag: cipher.getAuthTag().toString('hex'),
  };
};

export const decryptPendingPassword = (pending: {
  passwordCiphertext: string;
  passwordIv: string;
  passwordAuthTag: string;
}) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(pending.passwordIv, 'hex'));
  decipher.setAuthTag(Buffer.from(pending.passwordAuthTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(pending.passwordCiphertext, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

export const createVerificationCode = () => crypto.randomInt(100000, 1000000).toString();

export const hashVerificationCode = (email: string, code: string) =>
  crypto.createHmac('sha256', deriveKey()).update(`${email}:${code}`).digest('hex');

export const verificationCodeMatches = (email: string, code: string, expectedHash: string) => {
  const actual = Buffer.from(hashVerificationCode(email, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const hashRefreshToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const normalizeRefreshTokenStore = (tokens: string[]) =>
  tokens.map((token) => (/^[a-f0-9]{64}$/.test(token) ? token : hashRefreshToken(token)));

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]!));
