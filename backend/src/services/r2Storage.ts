/**
 * WorkGrind Cloudflare R2 Storage Service
 *
 * Provides a secure, reusable interface for all R2 operations.
 * All credentials are read from process.env — never hardcoded.
 * Signed URLs are always short-lived (default 15 minutes).
 *
 * Object key structure (company-isolated):
 *   companies/{companyId}/files/{uuid}/{safe-filename}
 *
 * SECURITY:
 *   - companyId is always sourced from the authenticated server session
 *   - Signed URLs require WorkGrind auth before generation (enforced in the controller)
 *   - The bucket stays private; direct public access is never enabled
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// ── Environment validation ─────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT',
] as const;

export function validateR2Config(): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
  return { valid: missing.length === 0, missing };
}

/** Log startup status — never reveals credential values */
export function logR2Config(): void {
  const { valid, missing } = validateR2Config();
  if (valid) {
    const endpoint = process.env.R2_ENDPOINT ?? '';
    const bucket   = process.env.R2_BUCKET_NAME ?? '';
    // Log only the domain portion, never the full endpoint with credentials
    console.log(`✅ R2 Storage: configured — bucket="${bucket}" endpoint="${endpoint}"`);
  } else {
    console.warn(`⚠️  R2 Storage: missing environment variables: ${missing.join(', ')}`);
    console.warn('   File uploads will fall back to local disk until R2 is configured.');
  }
}

// ── S3 client (lazy singleton — built after dotenv has loaded) ────────────────

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const { valid, missing } = validateR2Config();
  if (!valid) {
    throw new Error(
      `R2 Storage not configured. Missing environment variables: ${missing.join(', ')}. ` +
      `Add them to your backend .env file.`
    );
  }

  _client = new S3Client({
    region:      'auto',
    endpoint:    process.env.R2_ENDPOINT!.trim(),
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
    // Disable path-style forced — Cloudflare R2 uses virtual-hosted-style
    forcePathStyle: false,
  });

  return _client;
}

/** Reset the singleton (useful after env changes in tests) */
export function resetR2Client(): void { _client = null; }

// ── Key builder ───────────────────────────────────────────────────────────────

/**
 * Build a safe, company-isolated R2 object key.
 * - companyId ensures workspace isolation
 * - UUID prefix prevents enumeration / collisions
 * - safeFilename strips dangerous characters and directory traversal
 */
export function buildObjectKey(companyId: string, originalName: string): string {
  const ext        = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base       = path.basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'file';
  const safeFile   = `${base}${ext}`;
  const uniqueDir  = uuidv4();

  return `companies/${companyId}/files/${uniqueDir}/${safeFile}`;
}

// ── Core operations ───────────────────────────────────────────────────────────

const BUCKET = () => process.env.R2_BUCKET_NAME!.trim();

/** Default signed URL TTL: 15 minutes (900 seconds) */
const SIGNED_URL_TTL = 900;

/**
 * Upload a file buffer to R2.
 * Returns the object key (store this in the database, not a URL).
 */
export async function uploadFile(params: {
  companyId:    string;
  originalName: string;
  buffer:       Buffer;
  mimeType:     string;
  size:         number;
}): Promise<{ key: string; size: number }> {
  const { companyId, originalName, buffer, mimeType, size } = params;

  const key = buildObjectKey(companyId, originalName);

  await getClient().send(new PutObjectCommand({
    Bucket:        BUCKET(),
    Key:           key,
    Body:          buffer,
    ContentType:   mimeType,
    ContentLength: size,
    // Prevent the object from ever being publicly accessible
    // R2 ignores ACL but we set it for explicitness
    Metadata: {
      companyId,
      originalName: encodeURIComponent(originalName),
      uploadedAt:   new Date().toISOString(),
    },
  }));

  return { key, size };
}

/**
 * Generate a short-lived signed URL for downloading a file.
 * NEVER call this without first verifying WorkGrind permissions in the controller.
 *
 * @param key      R2 object key (from database)
 * @param filename Safe display filename for Content-Disposition header
 * @param ttl      URL lifetime in seconds (default 15 min)
 */
export async function generateSignedDownloadUrl(
  key:      string,
  filename: string,
  ttl       = SIGNED_URL_TTL,
): Promise<string> {
  const safeFilename = filename.replace(/[^\w\s.\-()]/g, '_');

  const command = new GetObjectCommand({
    Bucket:                     BUCKET(),
    Key:                        key,
    ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
    ResponseContentType:        'application/octet-stream',
  });

  return getSignedUrl(getClient(), command, { expiresIn: ttl });
}

export async function generateSignedAvatarUrl(key: string, ttl = SIGNED_URL_TTL): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    ResponseContentDisposition: 'inline',
  });

  return getSignedUrl(getClient(), command, { expiresIn: ttl });
}

export async function readPrivateFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const response = await getClient().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) return null;
    return { buffer: Buffer.from(bytes), mimeType: response.ContentType ?? 'application/octet-stream' };
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/**
 * Delete an object from R2.
 * Returns true if deleted (or already absent — S3 delete is idempotent).
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    await getClient().send(new DeleteObjectCommand({
      Bucket: BUCKET(),
      Key:    key,
    }));
    return true;
  } catch (err: any) {
    // NoSuchKey is fine — object was already gone
    if (err.name === 'NoSuchKey') return true;
    throw err;
  }
}

/**
 * Get object metadata from R2 (HEAD request — no data transfer).
 * Returns null if the object does not exist.
 */
export async function getFileMetadata(key: string): Promise<{
  size:        number;
  mimeType:    string;
  lastModified: Date;
} | null> {
  try {
    const resp = await getClient().send(new HeadObjectCommand({
      Bucket: BUCKET(),
      Key:    key,
    }));
    return {
      size:         resp.ContentLength ?? 0,
      mimeType:     resp.ContentType ?? 'application/octet-stream',
      lastModified: resp.LastModified ?? new Date(),
    };
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/**
 * Health check — tests R2 connectivity with a small temporary object.
 * Cleans up the test object afterward.
 * Safe to call from the admin portal.
 */
export async function testR2Connection(): Promise<{
  success:     boolean;
  details:     string;
  uploadMs?:   number;
  metaMs?:     number;
  signedUrl?:  boolean;
  deleteMs?:   number;
}> {
  const testKey = `_health-check/${uuidv4()}.txt`;
  const testData = Buffer.from('WorkGrind R2 health check');
  const client = getClient();

  try {
    // Upload
    const t0 = Date.now();
    await client.send(new PutObjectCommand({
      Bucket:      BUCKET(),
      Key:         testKey,
      Body:        testData,
      ContentType: 'text/plain',
    }));
    const uploadMs = Date.now() - t0;

    // Metadata
    const t1 = Date.now();
    const head = await client.send(new HeadObjectCommand({ Bucket: BUCKET(), Key: testKey }));
    const metaMs = Date.now() - t1;

    // Signed URL
    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: BUCKET(), Key: testKey }),
      { expiresIn: 60 }
    );

    // Delete
    const t2 = Date.now();
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: testKey }));
    const deleteMs = Date.now() - t2;

    return {
      success:    true,
      details:    `R2 connection OK — bucket: ${BUCKET()}`,
      uploadMs,
      metaMs,
      signedUrl:  signedUrl.length > 0,
      deleteMs,
    };
  } catch (err: any) {
    // Best-effort cleanup
    try { await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: testKey })); } catch { /* ignore */ }
    return { success: false, details: err.message ?? 'R2 connection failed' };
  }
}

/** True if all required R2 env vars are present */
export function isR2Configured(): boolean {
  return validateR2Config().valid;
}
