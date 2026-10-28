import type { Mirror } from '../../core';
import type { moderation } from '../moderation';

/** Urdu for the moderation namespace; loaded only when Urdu is the active language. */
export const moderationUr: Mirror<typeof moderation.en> = {
};
