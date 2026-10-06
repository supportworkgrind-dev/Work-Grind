import { generateSignedAvatarUrl, isR2Configured } from './r2Storage';

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export async function refreshAvatarUrls<T>(value: T): Promise<T> {
  if (Array.isArray(value)) {
    return await Promise.all(value.map((item) => refreshAvatarUrls(item))) as T;
  }
  if (!isJsonRecord(value)) return value;

  const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [
    key,
    await refreshAvatarUrls(item),
  ] as const));
  const result = Object.fromEntries(entries) as JsonRecord;
  const storageKey = value.avatarStorageKey;
  if (isR2Configured() && typeof storageKey === 'string' && storageKey) {
    result.avatar = await generateSignedAvatarUrl(storageKey);
  }
  delete result.avatarStorageKey;
  return result as T;
}
