import type { Mirror } from '../../core';
import type { tasks } from '../tasks';

/** Urdu for the tasks namespace; loaded only when Urdu is the active language. */
export const tasksUr: Mirror<typeof tasks.en> = {
};
