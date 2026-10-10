export const ACADEMIC_SECTIONS = [
  { id: 'overview', label: 'Academic Overview' },
  { id: 'students', label: 'Students' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'parents', label: 'Parents' },
  { id: 'departments', label: 'Departments' },
  { id: 'courses', label: 'Courses' },
  { id: 'classes', label: 'Classes' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'exams', label: 'Exams' },
  { id: 'results', label: 'Results' },
  { id: 'fees', label: 'Fees' },
] as const;

export type AcademicSection = (typeof ACADEMIC_SECTIONS)[number]['id'];

export function isAcademicSection(value: string | null): value is AcademicSection {
  return ACADEMIC_SECTIONS.some((section) => section.id === value);
}
