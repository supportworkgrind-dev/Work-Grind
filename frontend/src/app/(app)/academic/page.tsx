'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { useAuthStore } from '@/store/useAuthStore';
import { PageHeader } from '@/components/common/PageHeader';
import { BookOpen, GraduationCap, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { ACADEMIC_SECTIONS, isAcademicSection } from '@/lib/academicSections';

type AcademicPerson = {
  _id: string;
  type: 'student' | 'teacher' | 'parent';
  firstName: string;
  lastName: string;
  email?: string;
  externalId?: string;
  status?: 'active' | 'inactive';
};

type AcademicDepartment = { _id: string; name: string; code: string; description?: string };
type AcademicCourse = { _id: string; name: string; code: string; departmentId: string | AcademicDepartment; credits?: number };
type AcademicGuardianLink = { _id: string; studentId: string; guardianId: string; relationship: 'parent' | 'guardian' | 'other' };
type AcademicClass = { _id: string; name: string; academicYear: string; departmentId?: string | AcademicDepartment; courseIds?: (string | AcademicCourse)[] };
type AcademicEnrollment = {
  _id: string;
  studentId: AcademicPerson | string;
  classId: AcademicClass | string | null;
  enrolledAt: string;
  status?: 'active' | 'completed' | 'withdrawn';
};
type AcademicTeachingAssignment = {
  _id: string;
  teacherId: AcademicPerson | string | null;
  classId: AcademicClass | string | null;
};
type AcademicSchedule = {
  _id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  classId: AcademicClass | string | null;
};
type AcademicAssignment = {
  _id: string;
  title: string;
  dueAt?: string;
  pointsPossible: number;
  classId: AcademicClass | string | null;
};
type AcademicAttendance = {
  _id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  studentId: AcademicPerson | string | null;
  classId: AcademicClass | string | null;
  note?: string;
};
type AcademicAssessment = {
  _id: string;
  title: string;
  type: 'exam' | 'quiz' | 'test' | 'project';
  pointsPossible: number;
  classId: AcademicClass | string | null;
  scheduledAt?: string;
};
type AcademicResult = {
  _id: string;
  pointsEarned: number;
  assessmentId: (AcademicAssessment & { title: string }) | string | null;
  studentId: AcademicPerson | string | null;
  feedback?: string;
};
type AcademicFeeCharge = {
  _id: string;
  studentId: AcademicPerson | string | null;
  invoiceNumber: string;
  description: string;
  amountMinor: number;
  paidAmountMinor: number;
  currency: string;
  dueAt?: string;
  isVoided?: boolean;
};

type AcademicPortal = {
  profile: AcademicPerson;
  students: AcademicPerson[];
  enrollments: AcademicEnrollment[];
  schedules: AcademicSchedule[];
  assignments: AcademicAssignment[];
  assessments: AcademicAssessment[];
  attendance: AcademicAttendance[];
  results: AcademicResult[];
  feeCharges: AcademicFeeCharge[];
  teachingAssignments: AcademicTeachingAssignment[];
};

type AcademicCrudResource =
  | 'people' | 'departments' | 'courses' | 'classes' | 'guardians' | 'enrollments'
  | 'teaching-assignments' | 'schedules' | 'assignments' | 'attendance'
  | 'assessments' | 'results' | 'fees';

type AcademicEditField = {
  key: string;
  label: string;
  value: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'select' | 'multiselect';
  options?: { value: string; label: string }[];
  required?: boolean;
  maxLength?: number;
};

type AcademicEditState = {
  resource: AcademicCrudResource;
  id: string;
  title: string;
  fields: AcademicEditField[];
};

function getPopulatedName<T extends { _id: string }>(value: T | string | null, fallback: string): string {
  if (!value || typeof value === 'string') return fallback;
  if ('name' in value && typeof value.name === 'string') return value.name;
  if ('title' in value && typeof value.title === 'string') return value.title;
  if ('firstName' in value && typeof value.firstName === 'string') {
    const lastName = 'lastName' in value && typeof value.lastName === 'string' ? value.lastName : '';
    return `${value.firstName} ${lastName}`.trim();
  }
  return fallback;
}

function getRecordId(value: { _id: string } | string | null | undefined): string {
  return value && typeof value === 'object' ? value._id : value ?? '';
}

function editField(
  key: string,
  label: string,
  value: unknown,
  options: Omit<AcademicEditField, 'key' | 'label' | 'value'> = {}
): AcademicEditField {
  let normalizedValue = value instanceof Date
    ? value.toISOString()
    : typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  if (options.type === 'date' && normalizedValue) normalizedValue = normalizedValue.slice(0, 10);
  return { key, label, value: normalizedValue, ...options };
}

function formatMinorCurrency(amountMinor: number, currency: string): string {
  const fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountMinor / (10 ** fractionDigits));
}

export default function AcademicPage() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section');
  const activeSection = isAcademicSection(requestedSection) ? requestedSection : 'overview';
  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const isEducationWorkspace = !!company?.organizationType && company.organizationType !== 'business';
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [people, setPeople] = useState<AcademicPerson[]>([]);
  const [departments, setDepartments] = useState<AcademicDepartment[]>([]);
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<AcademicGuardianLink[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [enrollments, setEnrollments] = useState<AcademicEnrollment[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<AcademicTeachingAssignment[]>([]);
  const [schedules, setSchedules] = useState<AcademicSchedule[]>([]);
  const [assignments, setAssignments] = useState<AcademicAssignment[]>([]);
  const [attendance, setAttendance] = useState<AcademicAttendance[]>([]);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [results, setResults] = useState<AcademicResult[]>([]);
  const [feeCharges, setFeeCharges] = useState<AcademicFeeCharge[]>([]);
  const [portal, setPortal] = useState<AcademicPortal | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseDepartmentId, setCourseDepartmentId] = useState('');
  const [courseCredits, setCourseCredits] = useState('');
  const [personFirstName, setPersonFirstName] = useState('');
  const [personLastName, setPersonLastName] = useState('');
  const [personType, setPersonType] = useState<AcademicPerson['type']>('student');
  const [guardianStudentId, setGuardianStudentId] = useState('');
  const [guardianParentId, setGuardianParentId] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState<AcademicGuardianLink['relationship']>('parent');
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [classDepartmentId, setClassDepartmentId] = useState('');
  const [enrollmentStudentId, setEnrollmentStudentId] = useState('');
  const [enrollmentClassId, setEnrollmentClassId] = useState('');
  const [teachingTeacherId, setTeachingTeacherId] = useState('');
  const [teachingClassId, setTeachingClassId] = useState('');
  const [scheduleClassId, setScheduleClassId] = useState('');
  const [scheduleDay, setScheduleDay] = useState('1');
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [scheduleEnd, setScheduleEnd] = useState('10:00');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentPoints, setAssignmentPoints] = useState('100');
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [attendanceStudentId, setAttendanceStudentId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceStatus, setAttendanceStatus] = useState<AcademicAttendance['status']>('present');
  const [assessmentClassId, setAssessmentClassId] = useState('');
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [assessmentType, setAssessmentType] = useState<AcademicAssessment['type']>('exam');
  const [assessmentPoints, setAssessmentPoints] = useState('100');
  const [resultAssessmentId, setResultAssessmentId] = useState('');
  const [resultStudentId, setResultStudentId] = useState('');
  const [resultPoints, setResultPoints] = useState('');
  const [feeStudentId, setFeeStudentId] = useState('');
  const [feeInvoiceNumber, setFeeInvoiceNumber] = useState('');
  const [feeDescription, setFeeDescription] = useState('');
  const [feeAmountMinor, setFeeAmountMinor] = useState('');
  const [feeCurrency, setFeeCurrency] = useState('USD');
  const [paymentChargeId, setPaymentChargeId] = useState('');
  const [paymentAmountMinor, setPaymentAmountMinor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'other'>('bank_transfer');
  const [editing, setEditing] = useState<AcademicEditState | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});

  const loadAdminData = useCallback(async () => {
    const [peopleResponse, departmentsResponse, coursesResponse, guardianResponse, classesResponse, enrollmentResponse, teachingResponse, schedulesResponse, assignmentsResponse, attendanceResponse, assessmentsResponse, resultsResponse, feesResponse] = await Promise.all([
      api.get('/academic/people'),
      api.get('/academic/departments'),
      api.get('/academic/courses'),
      api.get('/academic/guardians'),
      api.get('/academic/classes'),
      api.get('/academic/enrollments'),
      api.get('/academic/teaching-assignments'),
      api.get('/academic/schedules'),
      api.get('/academic/assignments'),
      api.get('/academic/attendance'),
      api.get('/academic/assessments'),
      api.get('/academic/results'),
      api.get('/academic/fees'),
    ]);
    setPeople(peopleResponse.data.people);
    setDepartments(departmentsResponse.data.departments);
    setCourses(coursesResponse.data.courses);
    setGuardianLinks(guardianResponse.data.links);
    setClasses(classesResponse.data.classes);
    setEnrollments(enrollmentResponse.data.enrollments);
    setTeachingAssignments(teachingResponse.data.teachingAssignments);
    setSchedules(schedulesResponse.data.schedules);
    setAssignments(assignmentsResponse.data.assignments);
    setAttendance(attendanceResponse.data.attendance);
    setAssessments(assessmentsResponse.data.assessments);
    setResults(resultsResponse.data.results);
    setFeeCharges(feesResponse.data.charges);
  }, []);

  useEffect(() => {
    if (!isEducationWorkspace) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (isAdmin) {
          await loadAdminData();
        } else {
          const response = await api.get('/academic/portal/me');
          if (active) setPortal(response.data);
        }
      } catch (requestError) {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load academic records.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isAdmin, isEducationWorkspace, loadAdminData]);

  const submit = async (event: FormEvent, operation: () => Promise<void>) => {
    event.preventDefault();
    await runAdminMutation(operation);
  };

  const runAdminMutation = async (operation: () => Promise<void>, successMessage = 'Changes saved.') => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await operation();
      await loadAdminData();
      setSuccess(successMessage);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save this academic record.'));
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (resource: AcademicCrudResource, id: string, title: string, fields: AcademicEditField[]) => {
    setEditing({ resource, id, title, fields });
    setEditDraft(Object.fromEntries(fields.map((field) => [field.key, field.value])));
    setError('');
    setSuccess('');
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const payload: Record<string, unknown> = {};
    for (const field of editing.fields) {
      const value = editDraft[field.key] ?? '';
      if (!value && !field.required) {
        if (['dueAt', 'validFrom', 'validUntil', 'completedAt', 'scheduledAt'].includes(field.key)) payload[field.key] = null;
        else if (['email', 'externalId', 'description', 'instructions', 'location', 'note', 'feedback'].includes(field.key)) payload[field.key] = null;
        continue;
      }
      if (field.type === 'number' || field.key === 'dayOfWeek') payload[field.key] = Number(value);
      else if (field.type === 'multiselect') payload[field.key] = value ? value.split(',').filter(Boolean) : [];
      else if (field.type === 'date') payload[field.key] = value ? new Date(value).toISOString() : null;
      else payload[field.key] = value;
    }
    await runAdminMutation(async () => {
      await api.patch(`/academic/${editing.resource}/${editing.id}`, payload);
      setEditing(null);
    }, 'Academic record updated.');
  };

  const deleteRecord = async (resource: AcademicCrudResource, id: string, title: string) => {
    const operationLabel = resource === 'fees' ? 'Void' : 'Delete';
    if (!window.confirm(`${operationLabel} "${title}"? This action may be blocked if other records depend on it.`)) return;
    await runAdminMutation(async () => {
      await api.delete(`/academic/${resource}/${id}`);
    }, resource === 'fees' ? 'Fee charge voided.' : 'Academic record deleted.');
  };
  const selectedPaymentCharge = feeCharges.find((charge) => charge._id === paymentChargeId);

  if (!isEducationWorkspace) {
    return <div className="academic-card m-6"><h1 className="academic-heading">Education workspace required</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Academic tools are available in school, college, and university workspaces. An owner or admin can change the organization type in <Link className="underline" href="/settings">workspace settings</Link>.</p></div>;
  }

  const sectionTitle = ACADEMIC_SECTIONS.find((section) => section.id === activeSection)?.label ?? 'Academic Overview';
  const sectionClass = (section: string) => activeSection === section ? '' : 'hidden';

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={sectionTitle}
        subtitle={company?.name ? `${company.name} · ${company.organizationType}` : 'Education workspace'}
        icon={GraduationCap}
      />
      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
      <nav aria-label="Academic sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {ACADEMIC_SECTIONS.map((section) => (
          <Link key={section.id} href={`/academic?section=${section.id}`} aria-current={activeSection === section.id ? 'page' : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium ${activeSection === section.id ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'theme-border'}`}>
            {section.label}
          </Link>
        ))}
      </nav>
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="h-4 w-4 animate-spin" /> Loading academic records…</div>
      ) : isAdmin ? (
        <>
          {activeSection === 'overview' && <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="People" value={people.length} icon={Users} />
            <SummaryCard label="Departments" value={departments.length} icon={BookOpen} />
            <SummaryCard label="Active enrollments" value={enrollments.length} icon={GraduationCap} />
            <SummaryCard label="Courses" value={courses.length} icon={BookOpen} />
            <SummaryCard label="Classes" value={classes.length} icon={GraduationCap} />
            <SummaryCard label="Outstanding fee records" value={feeCharges.filter((charge) => !charge.isVoided && charge.paidAmountMinor < charge.amountMinor).length} icon={Users} />
          </div>}

          <div className="grid gap-6 xl:grid-cols-2">
            <section className={`academic-card ${sectionClass('departments')}`}>
              <h2 className="academic-heading">Add department</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/departments', { name: departmentName, code: departmentCode });
                setDepartmentName('');
                setDepartmentCode('');
              })}>
                <label>Department name<input required maxLength={120} value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} /></label>
                <label>Code<input required maxLength={30} value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value)} /></label>
                <SubmitButton saving={saving} label="Add department" />
              </form>
              <div className="mt-5 space-y-2">{departments.length ? departments.map((department) => <RecordRow key={department._id} title={department.name} detail={department.code}
                onEdit={() => beginEdit('departments', department._id, department.name, [
                  editField('name', 'Department name', department.name, { required: true, maxLength: 120 }),
                  editField('code', 'Code', department.code, { required: true, maxLength: 30 }),
                  editField('description', 'Description', (department as AcademicDepartment & { description?: string }).description, { maxLength: 1000 }),
                ])}
                onDelete={() => void deleteRecord('departments', department._id, department.name)} />) : <EmptyState label="No departments yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('students')} ${sectionClass('teachers')} ${sectionClass('parents')}`}>
              <h2 className="academic-heading">Register a person</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                const type = activeSection === 'teachers' ? 'teacher' : activeSection === 'parents' ? 'parent' : personType;
                await api.post('/academic/people', { type, firstName: personFirstName, lastName: personLastName });
                setPersonFirstName('');
                setPersonLastName('');
              })}>
                {activeSection === 'overview' ? <label>Role<select value={personType} onChange={(event) => setPersonType(event.target.value as AcademicPerson['type'])}><option value="student">Student</option><option value="teacher">Teacher</option><option value="parent">Parent / guardian</option></select></label> : <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{activeSection}</p>}
                <label>First name<input required maxLength={100} value={personFirstName} onChange={(event) => setPersonFirstName(event.target.value)} /></label>
                <label>Last name<input required maxLength={100} value={personLastName} onChange={(event) => setPersonLastName(event.target.value)} /></label>
                <SubmitButton saving={saving} label="Register person" />
              </form>
              <div className="mt-5 space-y-2">{people.filter((person) => activeSection === 'overview' || person.type === activeSection.slice(0, -1)).length ? people.filter((person) => activeSection === 'overview' || person.type === activeSection.slice(0, -1)).slice(0, 100).map((person) => <RecordRow key={person._id} title={`${person.firstName} ${person.lastName}`} detail={person.type}
                onEdit={() => beginEdit('people', person._id, `${person.firstName} ${person.lastName}`, [
                  editField('firstName', 'First name', person.firstName, { required: true, maxLength: 100 }),
                  editField('lastName', 'Last name', person.lastName, { required: true, maxLength: 100 }),
                  editField('email', 'Email', person.email, { maxLength: 254 }),
                  editField('externalId', 'External ID', person.externalId, { maxLength: 100 }),
                  editField('status', 'Status', person.status, { type: 'select', required: true, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }),
                ])}
                onDelete={() => void deleteRecord('people', person._id, `${person.firstName} ${person.lastName}`)} />) : <EmptyState label={`No ${activeSection === 'overview' ? 'people' : activeSection} registered yet.`} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('courses')}`}>
              <h2 className="academic-heading">Add course</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/courses', { name: courseName, code: courseCode, departmentId: courseDepartmentId, ...(courseCredits ? { credits: Number(courseCredits) } : {}) });
                setCourseName('');
                setCourseCode('');
                setCourseCredits('');
              })}>
                <label>Course name<input required maxLength={160} value={courseName} onChange={(event) => setCourseName(event.target.value)} /></label>
                <label>Course code<input required maxLength={30} value={courseCode} onChange={(event) => setCourseCode(event.target.value)} /></label>
                <label>Department<select required value={courseDepartmentId} onChange={(event) => setCourseDepartmentId(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
                <label>Credits<input type="number" min="0" max="100" value={courseCredits} onChange={(event) => setCourseCredits(event.target.value)} /></label>
                <SubmitButton saving={saving || departments.length === 0} label="Add course" />
                {departments.length === 0 && <p className="text-xs text-amber-700">Add a department before creating courses.</p>}
              </form>
              <div className="mt-5 space-y-2">{courses.length ? courses.map((course) => <RecordRow key={course._id} title={course.name} detail={`${course.code} · ${getPopulatedName(course.departmentId, 'Department')}`}
                onEdit={() => beginEdit('courses', course._id, course.name, [
                  editField('name', 'Course name', course.name, { required: true, maxLength: 160 }),
                  editField('code', 'Course code', course.code, { required: true, maxLength: 30 }),
                  editField('departmentId', 'Department', getRecordId(course.departmentId), { type: 'select', required: true, options: departments.map((department) => ({ value: department._id, label: department.name })) }),
                  editField('credits', 'Credits', course.credits, { type: 'number' }),
                ])}
                onDelete={() => void deleteRecord('courses', course._id, course.name)} />) : <EmptyState label="No courses yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('classes')}`}>
              <h2 className="academic-heading">Create a class</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/classes', { name: className, academicYear, departmentId: classDepartmentId, courseIds: [] });
                setClassName('');
                setAcademicYear('');
                setClassDepartmentId('');
              })}>
                <label>Class name<input required maxLength={120} value={className} onChange={(event) => setClassName(event.target.value)} /></label>
                <label>Academic year<input required maxLength={30} placeholder="2026–2027" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} /></label>
                <label>Department<select required value={classDepartmentId} onChange={(event) => setClassDepartmentId(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
                <SubmitButton saving={saving || departments.length === 0} label="Add class" />
                {departments.length === 0 && <p className="text-xs text-amber-700">Add a department before creating classes.</p>}
              </form>
              <div className="mt-5 space-y-2">{classes.length ? classes.map((academicClass) => <RecordRow key={academicClass._id} title={academicClass.name} detail={academicClass.academicYear}
                onEdit={() => beginEdit('classes', academicClass._id, academicClass.name, [
                  editField('name', 'Class name', academicClass.name, { required: true, maxLength: 120 }),
                  editField('academicYear', 'Academic year', academicClass.academicYear, { required: true, maxLength: 30 }),
                  editField('departmentId', 'Department', getRecordId(academicClass.departmentId), { type: 'select', required: true, options: departments.map((department) => ({ value: department._id, label: department.name })) }),
                  editField('courseIds', 'Courses', (academicClass.courseIds ?? []).map((course) => typeof course === 'string' ? course : course._id).join(','), { type: 'multiselect', options: courses.map((course) => ({ value: course._id, label: course.name })) }),
                ])}
                onDelete={() => void deleteRecord('classes', academicClass._id, academicClass.name)} />) : <EmptyState label="No classes yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('classes')}`}>
              <h2 className="academic-heading">Enroll a student</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/enrollments', { studentId: enrollmentStudentId, classId: enrollmentClassId });
                setEnrollmentStudentId('');
                setEnrollmentClassId('');
              })}>
                <label>Student<select required value={enrollmentStudentId} onChange={(event) => setEnrollmentStudentId(event.target.value)}><option value="">Select student</option>{people.filter((person) => person.type === 'student').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Class<select required value={enrollmentClassId} onChange={(event) => setEnrollmentClassId(event.target.value)}><option value="">Select class</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <SubmitButton saving={saving} label="Enroll student" />
              </form>
              <div className="mt-5 space-y-2">{enrollments.length ? enrollments.map((enrollment) => <RecordRow key={enrollment._id} title={getPopulatedName(enrollment.studentId, 'Student')} detail={getPopulatedName(enrollment.classId, 'Class')}
                onEdit={() => beginEdit('enrollments', enrollment._id, getPopulatedName(enrollment.studentId, 'Student'), [
                  editField('status', 'Enrollment status', (enrollment as AcademicEnrollment & { status?: string }).status, { type: 'select', required: true, options: [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'withdrawn', label: 'Withdrawn' }] }),
                ])}
                onDelete={() => void deleteRecord('enrollments', enrollment._id, getPopulatedName(enrollment.studentId, 'Student'))} />) : <EmptyState label="No enrollments yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('teachers')}`}>
              <h2 className="academic-heading">Assign a teacher to a class</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/teaching-assignments', { teacherId: teachingTeacherId, classId: teachingClassId });
                setTeachingTeacherId('');
                setTeachingClassId('');
              })}>
                <label>Teacher<select required value={teachingTeacherId} onChange={(event) => setTeachingTeacherId(event.target.value)}><option value="">Select teacher</option>{people.filter((person) => person.type === 'teacher').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Class<select required value={teachingClassId} onChange={(event) => setTeachingClassId(event.target.value)}><option value="">Select class</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <SubmitButton saving={saving || !people.some((person) => person.type === 'teacher') || classes.length === 0} label="Assign teacher" />
              </form>
              <div className="mt-5 space-y-2">{teachingAssignments.length ? teachingAssignments.map((assignment) => <RecordRow key={assignment._id} title={getPopulatedName(assignment.teacherId, 'Teacher')} detail={getPopulatedName(assignment.classId, 'Class')}
                onEdit={() => beginEdit('teaching-assignments', assignment._id, getPopulatedName(assignment.teacherId, 'Teacher'), [
                  editField('teacherId', 'Teacher', getRecordId(assignment.teacherId), { type: 'select', required: true, options: people.filter((person) => person.type === 'teacher').map((person) => ({ value: person._id, label: `${person.firstName} ${person.lastName}` })) }),
                  editField('classId', 'Class', getRecordId(assignment.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                ])}
                onDelete={() => void deleteRecord('teaching-assignments', assignment._id, getPopulatedName(assignment.teacherId, 'Teacher'))} />) : <EmptyState label="No teaching assignments yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('timetable')}`}>
              <h2 className="academic-heading">Add timetable session</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/schedules', { classId: scheduleClassId, dayOfWeek: Number(scheduleDay), startTime: scheduleStart, endTime: scheduleEnd, location: scheduleLocation });
                setScheduleLocation('');
              })}>
                <label>Class<select required value={scheduleClassId} onChange={(event) => setScheduleClassId(event.target.value)}><option value="">Select class</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <label>Weekday<select value={scheduleDay} onChange={(event) => setScheduleDay(event.target.value)}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-3"><label>Start<input type="time" required value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} /></label><label>End<input type="time" required value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} /></label></div>
                <label>Location<input maxLength={160} value={scheduleLocation} onChange={(event) => setScheduleLocation(event.target.value)} /></label>
                <SubmitButton saving={saving || classes.length === 0} label="Add timetable session" />
              </form>
              <div className="mt-5 space-y-2">{schedules.length ? schedules.map((schedule) => <RecordRow key={schedule._id} title={getPopulatedName(schedule.classId, 'Class')} detail={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][schedule.dayOfWeek - 1]} · ${schedule.startTime}–${schedule.endTime}`}
                onEdit={() => beginEdit('schedules', schedule._id, getPopulatedName(schedule.classId, 'Class'), [
                  editField('classId', 'Class', getRecordId(schedule.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                  editField('dayOfWeek', 'Weekday', schedule.dayOfWeek, { type: 'select', required: true, options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => ({ value: String(index + 1), label: day })) }),
                  editField('startTime', 'Start time', schedule.startTime, { type: 'time', required: true }),
                  editField('endTime', 'End time', schedule.endTime, { type: 'time', required: true }),
                  editField('location', 'Location', schedule.location, { maxLength: 160 }),
                ])}
                onDelete={() => void deleteRecord('schedules', schedule._id, getPopulatedName(schedule.classId, 'Class'))} />) : <EmptyState label="No timetable sessions yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('assignments')}`}>
              <h2 className="academic-heading">Create assignment</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/assignments', { classId: assignmentClassId, title: assignmentTitle, pointsPossible: Number(assignmentPoints) });
                setAssignmentTitle('');
              })}>
                <label>Class<select required value={assignmentClassId} onChange={(event) => setAssignmentClassId(event.target.value)}><option value="">Select class</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <label>Title<input required maxLength={180} value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} /></label>
                <label>Points possible<input required type="number" min="0" max="100000" value={assignmentPoints} onChange={(event) => setAssignmentPoints(event.target.value)} /></label>
                <SubmitButton saving={saving || classes.length === 0} label="Create assignment" />
              </form>
              <div className="mt-5 space-y-2">{assignments.length ? assignments.map((assignment) => <RecordRow key={assignment._id} title={assignment.title} detail={`${getPopulatedName(assignment.classId, 'Class')} · ${assignment.pointsPossible} pts`}
                onEdit={() => beginEdit('assignments', assignment._id, assignment.title, [
                  editField('classId', 'Class', getRecordId(assignment.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                  editField('title', 'Assignment title', assignment.title, { required: true, maxLength: 180 }),
                  editField('dueAt', 'Due date', assignment.dueAt, { type: 'date' }),
                  editField('pointsPossible', 'Points possible', assignment.pointsPossible, { type: 'number', required: true }),
                ])}
                onDelete={() => void deleteRecord('assignments', assignment._id, assignment.title)} />) : <EmptyState label="No assignments yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('attendance')}`}>
              <h2 className="academic-heading">Record attendance</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.put('/academic/attendance', { classId: attendanceClassId, studentId: attendanceStudentId, date: attendanceDate, status: attendanceStatus });
              })}>
                <label>Class<select required value={attendanceClassId} onChange={(event) => { setAttendanceClassId(event.target.value); setAttendanceStudentId(''); }}><option value="">Select class</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name}</option>)}</select></label>
                <label>Student<select required value={attendanceStudentId} onChange={(event) => setAttendanceStudentId(event.target.value)}><option value="">Select student</option>{people.filter((person) => person.type === 'student' && enrollments.some((enrollment) => typeof enrollment.studentId === 'object' && enrollment.studentId._id === person._id && enrollment.classId && typeof enrollment.classId === 'object' && enrollment.classId._id === attendanceClassId)).map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Date<input required type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label>
                <label>Status<select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as AcademicAttendance['status'])}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></label>
                <SubmitButton saving={saving || classes.length === 0} label="Save attendance" />
              </form>
              <div className="mt-5 space-y-2">{attendance.length ? attendance.map((entry) => <RecordRow key={entry._id} title={getPopulatedName(entry.studentId, 'Student')} detail={`${new Date(entry.date).toLocaleDateString()} · ${entry.status}`}
                onEdit={() => beginEdit('attendance', entry._id, getPopulatedName(entry.studentId, 'Student'), [
                  editField('status', 'Attendance status', entry.status, { type: 'select', required: true, options: ['present', 'absent', 'late', 'excused'].map((status) => ({ value: status, label: status })) }),
                  editField('note', 'Note', (entry as AcademicAttendance & { note?: string }).note, { maxLength: 500 }),
                ])}
                onDelete={() => void deleteRecord('attendance', entry._id, getPopulatedName(entry.studentId, 'Student'))} />) : <EmptyState label="No attendance records yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('exams')}`}>
              <h2 className="academic-heading">Create exam or assessment</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/assessments', { classId: assessmentClassId, title: assessmentTitle, type: assessmentType, pointsPossible: Number(assessmentPoints) });
                setAssessmentTitle('');
              })}>
                <label>Class<select required value={assessmentClassId} onChange={(event) => setAssessmentClassId(event.target.value)}><option value="">Select class</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name}</option>)}</select></label>
                <label>Title<input required maxLength={180} value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} /></label>
                <label>Type<select value={assessmentType} onChange={(event) => setAssessmentType(event.target.value as AcademicAssessment['type'])}><option value="exam">Exam</option><option value="quiz">Quiz</option><option value="test">Test</option><option value="project">Project</option></select></label>
                <label>Maximum points<input required type="number" min="0" max="100000" value={assessmentPoints} onChange={(event) => setAssessmentPoints(event.target.value)} /></label>
                <SubmitButton saving={saving || classes.length === 0} label="Create assessment" />
              </form>
              <div className="mt-5 space-y-2">{assessments.length ? assessments.map((assessment) => <RecordRow key={assessment._id} title={assessment.title} detail={`${assessment.type} · ${assessment.pointsPossible} pts`}
                onEdit={() => beginEdit('assessments', assessment._id, assessment.title, [
                  editField('classId', 'Class', getRecordId(assessment.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                  editField('title', 'Assessment title', assessment.title, { required: true, maxLength: 180 }),
                  editField('type', 'Type', assessment.type, { type: 'select', required: true, options: ['exam', 'quiz', 'test', 'project'].map((type) => ({ value: type, label: type })) }),
                  editField('scheduledAt', 'Scheduled date', (assessment as AcademicAssessment & { scheduledAt?: string }).scheduledAt, { type: 'date' }),
                  editField('pointsPossible', 'Maximum points', assessment.pointsPossible, { type: 'number', required: true }),
                ])}
                onDelete={() => void deleteRecord('assessments', assessment._id, assessment.title)} />) : <EmptyState label="No exams or assessments yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('results')}`}>
              <h2 className="academic-heading">Record a result</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.put('/academic/results', { assessmentId: resultAssessmentId, studentId: resultStudentId, pointsEarned: Number(resultPoints) });
                setResultPoints('');
              })}>
                <label>Assessment<select required value={resultAssessmentId} onChange={(event) => setResultAssessmentId(event.target.value)}><option value="">Select assessment</option>{assessments.map((assessment) => <option key={assessment._id} value={assessment._id}>{assessment.title}</option>)}</select></label>
                <label>Student<select required value={resultStudentId} onChange={(event) => setResultStudentId(event.target.value)}><option value="">Select student</option>{people.filter((person) => person.type === 'student' && enrollments.some((enrollment) => typeof enrollment.studentId === 'object' && enrollment.studentId._id === person._id && enrollment.classId && typeof enrollment.classId === 'object' && enrollment.classId._id === assessments.find((assessment) => assessment._id === resultAssessmentId)?.classId)).map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Points earned<input required type="number" min="0" max={assessments.find((assessment) => assessment._id === resultAssessmentId)?.pointsPossible ?? 100000} value={resultPoints} onChange={(event) => setResultPoints(event.target.value)} /></label>
                <SubmitButton saving={saving || !assessments.length} label="Save result" />
              </form>
              <div className="mt-5 space-y-2">{results.length ? results.map((result) => <RecordRow key={result._id} title={getPopulatedName(result.studentId, 'Student')} detail={`${getPopulatedName(result.assessmentId, 'Assessment')} · ${result.pointsEarned} pts`}
                onEdit={() => beginEdit('results', result._id, getPopulatedName(result.studentId, 'Student'), [
                  editField('pointsEarned', 'Points earned', result.pointsEarned, { type: 'number', required: true }),
                  editField('feedback', 'Feedback', (result as AcademicResult & { feedback?: string }).feedback, { maxLength: 2000 }),
                ])}
                onDelete={() => void deleteRecord('results', result._id, getPopulatedName(result.studentId, 'Student'))} />) : <EmptyState label="No results recorded yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('fees')}`}>
              <h2 className="academic-heading">Create fee charge</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/fees', {
                  studentId: feeStudentId,
                  invoiceNumber: feeInvoiceNumber,
                  description: feeDescription,
                  amountMinor: Number(feeAmountMinor),
                  currency: feeCurrency,
                });
                setFeeInvoiceNumber('');
                setFeeDescription('');
                setFeeAmountMinor('');
              })}>
                <label>Student<select required value={feeStudentId} onChange={(event) => setFeeStudentId(event.target.value)}><option value="">Select student</option>{people.filter((person) => person.type === 'student').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Invoice number<input required maxLength={40} value={feeInvoiceNumber} onChange={(event) => setFeeInvoiceNumber(event.target.value)} /></label>
                <label>Description<input required maxLength={180} value={feeDescription} onChange={(event) => setFeeDescription(event.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3"><label>Amount (minor units)<input required type="number" min="1" step="1" value={feeAmountMinor} onChange={(event) => setFeeAmountMinor(event.target.value)} /></label><label>ISO currency<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={feeCurrency} onChange={(event) => setFeeCurrency(event.target.value.toUpperCase())} /></label></div>
                <SubmitButton saving={saving || !people.some((person) => person.type === 'student')} label="Create fee charge" />
              </form>
            </section>

            <section className={`academic-card ${sectionClass('fees')}`}>
              <h2 className="academic-heading">Record offline payment</h2>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>Records payments received outside WorkGrind; this does not charge a payment method.</p>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post(`/academic/fees/${paymentChargeId}/payments`, { amountMinor: Number(paymentAmountMinor), method: paymentMethod });
                setPaymentAmountMinor('');
              })}>
                <label>Open charge<select required value={paymentChargeId} onChange={(event) => setPaymentChargeId(event.target.value)}><option value="">Select charge</option>{feeCharges.filter((charge) => !charge.isVoided && charge.paidAmountMinor < charge.amountMinor).map((charge) => <option key={charge._id} value={charge._id}>{getPopulatedName(charge.studentId, 'Student')} · {charge.invoiceNumber} · {formatMinorCurrency(charge.amountMinor - charge.paidAmountMinor, charge.currency)} due</option>)}</select></label>
                <label>Payment amount (minor units)<input required type="number" min="1" step="1" max={selectedPaymentCharge ? selectedPaymentCharge.amountMinor - selectedPaymentCharge.paidAmountMinor : undefined} value={paymentAmountMinor} onChange={(event) => setPaymentAmountMinor(event.target.value)} /></label>
                <label>Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other offline payment</option></select></label>
                <SubmitButton saving={saving || !feeCharges.some((charge) => charge._id === paymentChargeId && charge.paidAmountMinor < charge.amountMinor)} label="Record payment" />
              </form>
            </section>

            <section className={`academic-card xl:col-span-2 ${sectionClass('fees')}`}>
              <h2 className="academic-heading">Fee register</h2>
              <div className="space-y-2">{feeCharges.length ? feeCharges.map((charge) => <RecordRow key={charge._id} title={`${getPopulatedName(charge.studentId, 'Student')} · ${charge.invoiceNumber} · ${charge.description}`} detail={`${formatMinorCurrency(charge.paidAmountMinor, charge.currency)} / ${formatMinorCurrency(charge.amountMinor, charge.currency)} paid`}
                onEdit={() => beginEdit('fees', charge._id, charge.invoiceNumber, [
                  editField('invoiceNumber', 'Invoice number', charge.invoiceNumber, { required: true, maxLength: 40 }),
                  editField('description', 'Description', charge.description, { required: true, maxLength: 180 }),
                  editField('amountMinor', 'Amount (minor units)', charge.amountMinor, { type: 'number', required: true }),
                  editField('currency', 'ISO currency', charge.currency, { required: true, maxLength: 3 }),
                  editField('dueAt', 'Due date', charge.dueAt, { type: 'date' }),
                ])}
                onDelete={charge.isVoided ? undefined : () => void deleteRecord('fees', charge._id, charge.invoiceNumber)} />) : <EmptyState label="No fee records yet." />}</div>
            </section>

            <section className={`academic-card ${sectionClass('parents')}`}>
              <h2 className="academic-heading">Link a parent or guardian</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/guardians', { studentId: guardianStudentId, guardianId: guardianParentId, relationship: guardianRelationship });
                setGuardianStudentId('');
                setGuardianParentId('');
              })}>
                <label>Student<select required value={guardianStudentId} onChange={(event) => setGuardianStudentId(event.target.value)}><option value="">Select student</option>{people.filter((person) => person.type === 'student').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Parent / guardian<select required value={guardianParentId} onChange={(event) => setGuardianParentId(event.target.value)}><option value="">Select parent</option>{people.filter((person) => person.type === 'parent').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>Relationship<select value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value as AcademicGuardianLink['relationship'])}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label>
                <SubmitButton saving={saving || !people.some((person) => person.type === 'parent') || !people.some((person) => person.type === 'student')} label="Link records" />
              </form>
              <div className="mt-5 space-y-2">{guardianLinks.length ? guardianLinks.map((link) => {
                const student = people.find((person) => person._id === link.studentId);
                const guardian = people.find((person) => person._id === link.guardianId);
                return <RecordRow key={link._id} title={`${student ? `${student.firstName} ${student.lastName}` : 'Student'} — ${guardian ? `${guardian.firstName} ${guardian.lastName}` : 'Parent'}`} detail={link.relationship}
                  onEdit={() => beginEdit('guardians', link._id, 'Parent or guardian link', [
                    editField('studentId', 'Student', link.studentId, { type: 'select', required: true, options: people.filter((person) => person.type === 'student').map((person) => ({ value: person._id, label: `${person.firstName} ${person.lastName}` })) }),
                    editField('guardianId', 'Parent / guardian', link.guardianId, { type: 'select', required: true, options: people.filter((person) => person.type === 'parent').map((person) => ({ value: person._id, label: `${person.firstName} ${person.lastName}` })) }),
                    editField('relationship', 'Relationship', link.relationship, { type: 'select', required: true, options: ['parent', 'guardian', 'other'].map((relationship) => ({ value: relationship, label: relationship })) }),
                  ])}
                  onDelete={() => void deleteRecord('guardians', link._id, 'Parent or guardian link')} />;
              }) : <EmptyState label="No parent or guardian links yet." />}</div>
            </section>
          </div>
        </>
      ) : portal ? (
        <>
          {activeSection === 'overview' && <>
            <section className="academic-card">
              <h2 className="academic-heading">Welcome, {portal.profile.firstName}</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{portal.profile.type === 'parent' ? 'Academic information for linked students.' : portal.profile.type === 'teacher' ? 'Your assigned classes and academic activity.' : 'Your academic profile and progress.'}</p>
            </section>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Students visible to you" value={portal.students.length} icon={Users} />
              <SummaryCard label="Current classes" value={portal.enrollments.length} icon={GraduationCap} />
              <SummaryCard label="Upcoming academic work" value={portal.assignments.length + portal.assessments.length} icon={BookOpen} />
            </div>
          </>}
          {activeSection === 'students' && <section className="academic-card">
            <h2 className="academic-heading">Students</h2>
            {portal.students.length ? portal.students.map((student) => <RecordRow key={student._id} title={`${student.firstName} ${student.lastName}`} detail={student.externalId ?? student.type} />) : <EmptyState label="No student profiles are available to this account." />}
          </section>}
          {activeSection === 'teachers' && <section className="academic-card">
            <h2 className="academic-heading">Teachers</h2>
            {portal.profile.type === 'teacher'
              ? <RecordRow title={`${portal.profile.firstName} ${portal.profile.lastName}`} detail="Your teacher profile" />
              : <EmptyState label="Teacher directory access is limited to workspace administrators." />}
          </section>}
          {activeSection === 'parents' && <section className="academic-card">
            <h2 className="academic-heading">Parents</h2>
            {portal.profile.type === 'parent'
              ? <RecordRow title={`${portal.profile.firstName} ${portal.profile.lastName}`} detail="Your parent / guardian profile" />
              : <EmptyState label="Parent directory access is limited to workspace administrators." />}
          </section>}
          {(activeSection === 'departments' || activeSection === 'courses') && <section className="academic-card">
            <EmptyState label="Department and course management is available to workspace administrators." />
          </section>}
          {activeSection === 'classes' && <section className="academic-card">
            <h2 className="academic-heading">Classes</h2>
            {portal.enrollments.length ? portal.enrollments.map((enrollment) => <RecordRow key={enrollment._id} title={getPopulatedName(enrollment.classId, 'Class')} detail={portal.profile.type === 'parent' ? getPopulatedName(enrollment.studentId, 'Student') : ''} />) : <EmptyState label="No active class enrollments are available." />}
          </section>}
          {activeSection === 'timetable' && <section className="academic-card">
            <h2 className="academic-heading">Timetable</h2>
            {portal.schedules.length ? portal.schedules.map((schedule) => <RecordRow key={schedule._id} title={getPopulatedName(schedule.classId, 'Class')} detail={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][schedule.dayOfWeek - 1]} · ${schedule.startTime}–${schedule.endTime}`} />) : <EmptyState label="No timetable sessions are published." />}
          </section>}
          {activeSection === 'assignments' && <section className="academic-card">
            <h2 className="academic-heading">Assignments</h2>
            {portal.assignments.length ? portal.assignments.map((assignment) => <RecordRow key={assignment._id} title={assignment.title} detail={`${getPopulatedName(assignment.classId, 'Class')} · ${assignment.pointsPossible} pts`} />) : <EmptyState label="No assignments are available." />}
          </section>}
          {activeSection === 'attendance' && <section className="academic-card">
            <h2 className="academic-heading">Attendance</h2>
            {portal.attendance.length ? portal.attendance.map((entry) => <RecordRow key={entry._id} title={getPopulatedName(entry.classId, 'Class')} detail={`${new Date(entry.date).toLocaleDateString()} · ${entry.status}`} />) : <EmptyState label="No attendance records are available." />}
          </section>}
          {activeSection === 'exams' && <section className="academic-card">
            <h2 className="academic-heading">Exams and assessments</h2>
            {portal.assessments.length ? portal.assessments.map((assessment) => <RecordRow key={assessment._id} title={assessment.title} detail={`${getPopulatedName(assessment.classId, 'Class')} · ${assessment.type} · ${assessment.pointsPossible} pts`} />) : <EmptyState label="No exams or assessments are scheduled." />}
          </section>}
          {activeSection === 'results' && <section className="academic-card">
            <h2 className="academic-heading">Results</h2>
            {portal.results.length ? portal.results.map((result) => <RecordRow key={result._id} title={getPopulatedName(result.assessmentId, 'Assessment')} detail={`${result.pointsEarned} pts`} />) : <EmptyState label="No results are available." />}
          </section>}
          {activeSection === 'fees' && <section className="academic-card">
            <h2 className="academic-heading">Fees</h2>
            {portal.profile.type === 'teacher'
              ? <EmptyState label="Fee records are not available to teacher accounts." />
              : portal.feeCharges.length ? portal.feeCharges.map((charge) => <RecordRow key={charge._id} title={`${charge.invoiceNumber} · ${charge.description}`} detail={`${formatMinorCurrency(charge.paidAmountMinor, charge.currency)} / ${formatMinorCurrency(charge.amountMinor, charge.currency)} paid`} />) : <EmptyState label="No fee charges are available." />}
          </section>}
        </>
      ) : (
        <div className="academic-card"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error || 'This account does not have an academic profile linked yet.'}</p></div>
      )}
      {editing && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditing(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="academic-edit-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
            <h2 id="academic-edit-title" className="academic-heading">Edit {editing.title}</h2>
            <form className="academic-form" onSubmit={saveEdit}>
              {editing.fields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.type === 'select' ? (
                    <select required={field.required} value={editDraft[field.key] ?? ''} onChange={(event) => setEditDraft((draft) => ({ ...draft, [field.key]: event.target.value }))}>
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.type === 'multiselect' ? (
                    <select
                      multiple
                      value={(editDraft[field.key] ?? '').split(',').filter(Boolean)}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, [field.key]: Array.from(event.target.selectedOptions, (option) => option.value).join(',') }))}
                      className="min-h-24"
                    >
                      {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input
                      required={field.required}
                      type={field.type ?? 'text'}
                      maxLength={field.maxLength}
                      min={field.type === 'number' ? field.key === 'credits' ? '0' : '0' : undefined}
                      step={field.type === 'number' && field.key.includes('Minor') ? '1' : undefined}
                      value={editDraft[field.key] ?? ''}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, [field.key]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn-secondary" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
                <SubmitButton saving={saving} label="Save changes" />
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return <div className="academic-card flex items-center gap-4"><div className="rounded-xl p-3" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}><Icon className="h-5 w-5" /></div><div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p><p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p></div></div>;
}

function SubmitButton({ saving, label }: { saving: boolean; label: string }) {
  return <button type="submit" className="btn-primary" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{label}</button>;
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-xl border border-dashed px-3 py-4 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>{label}</p>;
}

function RecordRow({
  title,
  detail,
  onEdit,
  onDelete,
}: {
  title: string;
  detail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-base)' }}>
      <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
      <span className="shrink-0 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{detail}</span>
      {(onEdit || onDelete) && (
        <span className="flex shrink-0 gap-1">
          {onEdit && <button type="button" aria-label={`Edit ${title}`} title="Edit" disabled={false} onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Pencil className="h-4 w-4" /></button>}
          {onDelete && <button type="button" aria-label={`Delete ${title}`} title="Delete" onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>}
        </span>
      )}
    </div>
  );
}
