import type { Mirror } from '../../core';
import type { files } from '../files';

/** Urdu for the files namespace; loaded only when Urdu is the active language. */
export const filesUr: Mirror<typeof files.en> = {
};
