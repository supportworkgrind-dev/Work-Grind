import type { Mirror } from '../../core';
import type { calendar } from '../calendar';

/** Urdu for the calendar namespace; loaded only when Urdu is the active language. */
export const calendarUr: Mirror<typeof calendar.en> = {
};
