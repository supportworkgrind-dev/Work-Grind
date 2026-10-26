import { academic } from '@/lib/i18n/messages/academic';

const ACADEMIC_SECTION_IDS = [
  'overview',
  'students',
  'teachers',
  'parents',
  'departments',
  'courses',
  'classes',
  'timetable',
  'assignments',
  'attendance',
  'exams',
  'results',
  'fees',
  'imports',
] as const;

/**
 * Sections of the academic workspace, in navigation order. `label` is the English
 * name; screens show the translated name with t(`academic.sections.${id}`).
 */
export const ACADEMIC_SECTIONS = ACADEMIC_SECTION_IDS.map((id) => ({ id, label: academic.en.sections[id] }));

export type AcademicSection = (typeof ACADEMIC_SECTIONS)[number]['id'];

export function isAcademicSection(value: string | null): value is AcademicSection {
  return ACADEMIC_SECTIONS.some((section) => section.id === value);
}
