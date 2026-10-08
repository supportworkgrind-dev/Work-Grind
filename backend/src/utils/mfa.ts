import crypto from 'crypto';
import { authenticator, totp } from 'otplib';
import QRCode from 'qrcode';

const driftTolerantTotp = totp.clone({ window: 1 });

// Derive 32-byte AES key from environment secret
const getEncryptionKey = (): Buffer => {
  const secretSource =
    process.env.MFA_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'workgrind-mfa-default-secure-salt-key-32bytes';
  return crypto.createHash('sha256').update(secretSource).digest();
};

// ─── AES-256-GCM Encryption / Decryption ────────────────────────────────────

/**
 * Encrypts a TOTP secret using AES-256-GCM.
 * Stored format: ivHex:authTagHex:encryptedHex
 */
export const encryptSecret = (plainText: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12-byte IV standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret.
 */
export const decryptSecret = (encryptedPayload: string): string => {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted MFA payload format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

// ─── TOTP Provisioning & Verification ───────────────────────────────────────

/**
 * Generates a standard base32 TOTP secret.
 */
export const generateTotpSecret = (): string => {
  return authenticator.generateSecret();
};

/**
 * Generates the otpauth URI and a base64 QR Code Data URL for scanning.
 */
export const generateTotpProvisioning = async (
  email: string,
  secret: string
): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> => {
  const issuer = 'WorkGrind Admin';
  const otpauthUrl = authenticator.keyuri(email, issuer, secret);

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 2,
    width: 256,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  return { otpauthUrl, qrCodeDataUrl };
};

/**
 * Verifies a 6-digit TOTP token against a plain secret with +/- 1 window drift tolerance.
 */
export const verifyTotp = (token: string, secret: string): boolean => {
  const cleaned = token.replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return false;
  }
  try {
    return driftTolerantTotp.check(cleaned, secret);
  } catch {
    return false;
  }
};

// ─── One-Time Recovery Codes ───────────────────────────────────────────────

/**
 * Generates 8 random one-time recovery codes (formatted as XXXX-XXXX).
 */
export const generateRecoveryCodes = (count = 8): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
};

/**
 * Hashes a recovery code with SHA-256 and salt for secure storage.
 */
export const hashRecoveryCode = (code: string): string => {
  const normalized = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return crypto
    .createHash('sha256')
    .update(normalized + ':tf_recovery_salt_v1')
    .digest('hex');
};

/**
 * Verifies if an input recovery code matches any of the stored hashes.
 * If valid, returns { valid: true, remainingHashedCodes } with that code consumed.
 */
export const verifyAndConsumeRecoveryCode = (
  inputCode: string,
  storedHashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } => {
  if (!inputCode || !storedHashedCodes || storedHashedCodes.length === 0) {
    return { valid: false, remainingHashedCodes: storedHashedCodes || [] };
  }

  const inputHash = hashRecoveryCode(inputCode);
  const index = storedHashedCodes.indexOf(inputHash);

  if (index === -1) {
    return { valid: false, remainingHashedCodes: storedHashedCodes };
  }

  // Consume the code
  const remaining = [...storedHashedCodes];
  remaining.splice(index, 1);
  return { valid: true, remainingHashedCodes: remaining };
};
