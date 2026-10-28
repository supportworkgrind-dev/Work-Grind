import type { Mirror } from '../../core';
import type { projects } from '../projects';

/** Urdu for the projects namespace; loaded only when Urdu is the active language. */
export const projectsUr: Mirror<typeof projects.en> = {
};
