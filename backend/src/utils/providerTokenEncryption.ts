import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const source = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error('Token encryption is not configured.');
  return crypto.createHash('sha256').update(source).digest();
}

export function encryptProviderToken(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptProviderToken(value: string): string {
  const parts = value.split(':');
  if (parts.length !== 3 || parts.some((part) => !/^[a-f0-9]+$/i.test(part))) {
    throw new Error('Encrypted provider token has an invalid format.');
  }
  const [ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Encrypted provider token has an invalid format.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
