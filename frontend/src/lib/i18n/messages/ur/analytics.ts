import type { Mirror } from '../../core';
import type { analytics } from '../analytics';

/** Urdu for the analytics namespace; loaded only when Urdu is the active language. */
export const analyticsUr: Mirror<typeof analytics.en> = {
};
