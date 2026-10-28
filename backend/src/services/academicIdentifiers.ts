import mongoose from 'mongoose';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicImportLock from '../models/AcademicImportLock';
import AcademicPerson, { AcademicPersonType } from '../models/AcademicPerson';
import AcademicSequence from '../models/AcademicSequence';
import AcademicSettings, { AcademicRollNumberMode } from '../models/AcademicSettings';

export type AcademicIdentifierSettings = {
  studentIdPrefix: string;
  teacherIdPrefix: string;
  parentIdPrefix: string;
  idPadding: number;
  rollNumberMode: AcademicRollNumberMode;
  rollNumberPadding: number;
};

export const DEFAULT_IDENTIFIER_SETTINGS: AcademicIdentifierSettings = {
  studentIdPrefix: 'STU',
  teacherIdPrefix: 'TCH',
  parentIdPrefix: 'GRD',
  idPadding: 6,
  rollNumberMode: 'manual',
  rollNumberPadding: 2,
};

const IMPORT_LOCK_MS = 30 * 60_000;
const MAX_GENERATION_ATTEMPTS = 50;

export class AcademicImportBusyError extends Error {
  constructor() {
    super('Another import is already running for this institution. Wait for it to finish and try again.');
    this.name = 'AcademicImportBusyError';
  }
}

export async function getIdentifierSettings(companyId: mongoose.Types.ObjectId): Promise<AcademicIdentifierSettings> {
  const stored = await AcademicSettings.findOne({ companyId }).lean();
  if (!stored) return { ...DEFAULT_IDENTIFIER_SETTINGS };
  return {
    studentIdPrefix: stored.studentIdPrefix ?? DEFAULT_IDENTIFIER_SETTINGS.studentIdPrefix,
    teacherIdPrefix: stored.teacherIdPrefix ?? DEFAULT_IDENTIFIER_SETTINGS.teacherIdPrefix,
    parentIdPrefix: stored.parentIdPrefix ?? DEFAULT_IDENTIFIER_SETTINGS.parentIdPrefix,
    idPadding: stored.idPadding ?? DEFAULT_IDENTIFIER_SETTINGS.idPadding,
    rollNumberMode: stored.rollNumberMode ?? DEFAULT_IDENTIFIER_SETTINGS.rollNumberMode,
    rollNumberPadding: stored.rollNumberPadding ?? DEFAULT_IDENTIFIER_SETTINGS.rollNumberPadding,
  };
}

/** Validates an admin's settings update; returns the sanitized changes or an error message. */
export function parseIdentifierSettings(input: Record<string, unknown>): { settings?: Partial<AcademicIdentifierSettings>; error?: string } {
  const settings: Partial<AcademicIdentifierSettings> = {};
  for (const field of ['studentIdPrefix', 'teacherIdPrefix', 'parentIdPrefix'] as const) {
    if (input[field] === undefined) continue;
    const value = typeof input[field] === 'string' ? (input[field] as string).trim().toUpperCase() : '';
    if (!/^[A-Z0-9-]{1,12}$/.test(value)) return { error: 'ID prefixes may contain 1–12 letters, numbers, or hyphens.' };
    settings[field] = value;
  }
  if (input.idPadding !== undefined) {
    const value = Number(input.idPadding);
    if (!Number.isInteger(value) || value < 4 || value > 10) return { error: 'ID digits must be between 4 and 10.' };
    settings.idPadding = value;
  }
  if (input.rollNumberMode !== undefined) {
    if (input.rollNumberMode !== 'manual' && input.rollNumberMode !== 'sequential_per_class') return { error: 'Choose a supported roll number format.' };
    settings.rollNumberMode = input.rollNumberMode;
  }
  if (input.rollNumberPadding !== undefined) {
    const value = Number(input.rollNumberPadding);
    if (!Number.isInteger(value) || value < 1 || value > 6) return { error: 'Roll number digits must be between 1 and 6.' };
    settings.rollNumberPadding = value;
  }
  return { settings };
}

export async function saveIdentifierSettings(
  companyId: mongoose.Types.ObjectId,
  changes: Partial<AcademicIdentifierSettings>,
  userId: mongoose.Types.ObjectId,
): Promise<AcademicIdentifierSettings> {
  await AcademicSettings.findOneAndUpdate(
    { companyId },
    { $set: { ...changes, updatedBy: userId }, $setOnInsert: { companyId } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return getIdentifierSettings(companyId);
}

/** Atomically increments and returns a per-institution counter. */
export async function nextSequenceValue(companyId: mongoose.Types.ObjectId, key: string): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const sequence = await AcademicSequence.findOneAndUpdate(
        { companyId, key },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      if (sequence) return sequence.value;
    } catch (error) {
      // Two first-time upserts can race on the unique index; the retry increments the winner's document.
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
  }
  throw new Error('Unable to reserve the next academic identifier.');
}

export function personIdPrefix(settings: AcademicIdentifierSettings, type: AcademicPersonType): string {
  return type === 'student' ? settings.studentIdPrefix : type === 'teacher' ? settings.teacherIdPrefix : settings.parentIdPrefix;
}

export function formatSequenceId(prefix: string, value: number, padding: number): string {
  return `${prefix}-${String(value).padStart(padding, '0')}`;
}

/**
 * Reserves a permanent, unused person ID such as STU-000042. Numbers come from
 * an atomic counter; an ID an administrator already typed by hand is skipped.
 */
export async function generatePersonExternalId(
  companyId: mongoose.Types.ObjectId,
  type: AcademicPersonType,
  settings: AcademicIdentifierSettings,
  isTaken: (candidate: string) => boolean = () => false,
): Promise<string> {
  const prefix = personIdPrefix(settings, type);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = formatSequenceId(prefix, await nextSequenceValue(companyId, `person:${type}`), settings.idPadding);
    if (isTaken(candidate.toUpperCase())) continue;
    if (!await AcademicPerson.exists({ companyId, externalId: candidate })) return candidate;
  }
  throw new Error('Unable to generate a unique ID. Check the configured ID prefix.');
}

/** Reserves the next unused roll number within one class. */
export async function generateRollNumber(
  companyId: mongoose.Types.ObjectId,
  classId: mongoose.Types.ObjectId,
  settings: AcademicIdentifierSettings,
  isTaken: (candidate: string) => boolean = () => false,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = String(await nextSequenceValue(companyId, `roll:${classId.toString()}`)).padStart(settings.rollNumberPadding, '0');
    if (isTaken(candidate.toUpperCase())) continue;
    if (!await AcademicEnrollment.exists({ companyId, classId, rollNumber: candidate })) return candidate;
  }
  throw new Error('Unable to generate a unique roll number for this class.');
}

/** Ensures only one import writes to an institution at a time. */
export async function acquireImportLock(companyId: mongoose.Types.ObjectId, jobId: mongoose.Types.ObjectId): Promise<void> {
  const now = new Date();
  try {
    const lock = await AcademicImportLock.findOneAndUpdate(
      { companyId, expiresAt: { $lte: now } },
      { $set: { jobId, expiresAt: new Date(now.getTime() + IMPORT_LOCK_MS) } },
      { upsert: true, new: true },
    );
    if (!lock || lock.jobId.toString() !== jobId.toString()) throw new AcademicImportBusyError();
  } catch (error) {
    // An unexpired lock makes the filter miss, so the upsert collides with it.
    if ((error as { code?: number })?.code === 11000) throw new AcademicImportBusyError();
    throw error;
  }
}

export async function refreshImportLock(companyId: mongoose.Types.ObjectId, jobId: mongoose.Types.ObjectId): Promise<void> {
  await AcademicImportLock.updateOne({ companyId, jobId }, { $set: { expiresAt: new Date(Date.now() + IMPORT_LOCK_MS) } });
}

export async function releaseImportLock(companyId: mongoose.Types.ObjectId, jobId: mongoose.Types.ObjectId): Promise<void> {
  await AcademicImportLock.deleteOne({ companyId, jobId });
}
