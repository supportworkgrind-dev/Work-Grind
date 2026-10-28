import type { Mirror } from '../../core';
import type { ai } from '../ai';

/** Urdu for the ai namespace; loaded only when Urdu is the active language. */
export const aiUr: Mirror<typeof ai.en> = {};
