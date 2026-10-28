import type { Mirror } from '../../core';
import type { legal } from '../legal';

/** Urdu for the legal namespace; loaded only when Urdu is the active language. */
export const legalUr: Mirror<typeof legal.en> = {
};
