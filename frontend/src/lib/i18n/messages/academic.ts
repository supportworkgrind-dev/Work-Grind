import { defineMessages } from '../core';

/** Education administration (academic page and sections). */
export const academic = defineMessages(
  {
    // Keyed by ACADEMIC_SECTIONS ids (src/lib/academicSections.ts); the sidebar uses these.
    sections: {
      overview: 'Academic Overview',
      students: 'Students',
      teachers: 'Teachers',
      parents: 'Parents',
      departments: 'Departments',
      courses: 'Courses',
      classes: 'Classes',
      timetable: 'Timetable',
      assignments: 'Assignments',
      attendance: 'Attendance',
      exams: 'Exams',
      results: 'Results',
      fees: 'Fees',
    },
  },
  {
    sections: {
      overview: 'تعلیمی جائزہ',
      students: 'طلبہ',
      teachers: 'اساتذہ',
      parents: 'والدین',
      departments: 'شعبہ جات',
      courses: 'کورسز',
      classes: 'کلاسیں',
      timetable: 'ٹائم ٹیبل',
      assignments: 'اسائنمنٹس',
      attendance: 'حاضری',
      exams: 'امتحانات',
      results: 'نتائج',
      fees: 'فیس',
    },
  },
);
