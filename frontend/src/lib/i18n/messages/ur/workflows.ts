import type { Mirror } from '../../core';
import type { workflows } from '../workflows';

/** Urdu for the workflows namespace; loaded only when Urdu is the active language. */
export const workflowsUr: Mirror<typeof workflows.en> = {
};
