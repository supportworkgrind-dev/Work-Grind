'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/useAuthStore';
import { PageHeader } from '@/components/common/PageHeader';
import { BookOpen, GraduationCap, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { ACADEMIC_SECTIONS, isAcademicSection } from '@/lib/academicSections';
import { canAccessAcademicSection, canAccessOrganizationFeature, isEducationOrganization, permissionRole } from '@/lib/organizationAccess';
import { renderRich, useI18n, useT } from '@/lib/i18n';
import { AcademicImportPanel } from '@/components/academic/AcademicImportPanel';

type AcademicPerson = {
  _id: string;
  type: 'student' | 'teacher' | 'parent';
  firstName: string;
  lastName: string;
  email?: string;
  externalId?: string;
  status?: 'active' | 'inactive';
};

type AcademicDepartment = {
  _id: string; name: string; code: string; description?: string;
  authorizedDeanUserIds?: string[]; authorizedHodUserIds?: string[];
};
type WorkspaceMember = { _id: string; fullName: string; role: string };
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

/** Converts an amount in the currency's minor units (e.g. cents) to major units. */
function toMajorUnits(amountMinor: number, currency: string): number {
  // Only reads the currency's number of decimals; the amount is displayed with formatCurrency.
  const fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return amountMinor / (10 ** fractionDigits);
}

// Message keys under academic.weekdays, in dayOfWeek order (1 = Monday).
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
const ASSESSMENT_TYPES = ['exam', 'quiz', 'test', 'project'] as const;
const GUARDIAN_RELATIONSHIPS = ['parent', 'guardian', 'other'] as const;
/** Record dates are shown numerically (e.g. 10/24/2026 in English). */
const RECORD_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
/** Groups under academic.values: labels for values the API sends. */
type ValueGroup = 'personType' | 'personGroup' | 'attendanceStatus' | 'assessmentType' | 'relationship';

export default function AcademicPage() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section');
  const activeSection = isAcademicSection(requestedSection) ? requestedSection : 'overview';
  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const isEducationWorkspace = isEducationOrganization(company);
  const isAdmin = canAccessOrganizationFeature(company, user?.role, 'academicAdmin');
  const visibleAcademicSections = ACADEMIC_SECTIONS.filter((section) =>
    canAccessAcademicSection(user?.role, section.id, company?.organizationType),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [people, setPeople] = useState<AcademicPerson[]>([]);
  const [departments, setDepartments] = useState<AcademicDepartment[]>([]);
  // Deans and heads of department act only on departments assigned to them;
  // institution administrators (as on the server) make those assignments.
  const canAssignDepartmentLeaders = ['owner', 'principal', 'admin'].includes(permissionRole(user?.role));
  const [departmentLeaders, setDepartmentLeaders] = useState<WorkspaceMember[]>([]);
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
  const [feeDueAt, setFeeDueAt] = useState('');
  const [paymentChargeId, setPaymentChargeId] = useState('');
  const [paymentAmountMinor, setPaymentAmountMinor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'other'>('bank_transfer');
  const [editing, setEditing] = useState<AcademicEditState | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const t = useT('academic');
  const tc = useT('common');
  const { tOptional, formatDate, formatCurrency } = useI18n();

  // Values the API sends keep their raw text when no label exists for them.
  const valueLabel = (group: ValueGroup, value: string) => tOptional(`academic.values.${group}.${value}`) ?? value;
  const institutionLabel = company?.organizationType && company.organizationType !== 'business'
    ? t(`institutionTypes.${company.organizationType}`)
    : t('sections.overview');
  const formatMinorCurrency = (amountMinor: number, currency: string) => formatCurrency(toMajorUnits(amountMinor, currency), currency);
  const formatPoints = (points: number) => t('points', { points: String(points) });
  const weekdayOptions = WEEKDAYS.map((day, index) => ({ value: String(index + 1), label: t(`weekdays.long.${day}`) }));
  const scheduleDetail = (schedule: AcademicSchedule) => {
    const day = WEEKDAYS[schedule.dayOfWeek - 1];
    return `${day ? t(`weekdays.short.${day}`) : schedule.dayOfWeek} · ${schedule.startTime}–${schedule.endTime}`;
  };
  const feePaidDetail = (charge: AcademicFeeCharge) => t('fees.paidOfTotal', {
    paid: formatMinorCurrency(charge.paidAmountMinor, charge.currency),
    total: formatMinorCurrency(charge.amountMinor, charge.currency),
  });

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
    if (canAssignDepartmentLeaders) {
      const membersResponse = await api.get('/users');
      setDepartmentLeaders((membersResponse.data.users as WorkspaceMember[])
        .filter((member) => ['dean', 'hod'].includes(permissionRole(member.role))));
    }
  }, [canAssignDepartmentLeaders]);

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
        if (active) setError(describeApiError(requestError, t('errors.loadFailed')).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isAdmin, isEducationWorkspace, loadAdminData, t]);

  const submit = async (event: FormEvent, operation: () => Promise<void>) => {
    event.preventDefault();
    if (saving) return;
    await runAdminMutation(operation);
  };

  const runAdminMutation = async (operation: () => Promise<void>, successMessage = t('toast.saved')) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await operation();
      try {
        await loadAdminData();
      } catch (loadError) {
        console.error('Failed to reload academic data after mutation', loadError);
      }
      setSuccess(successMessage);
    } catch (requestError) {
      setError(describeApiError(requestError, t('errors.saveFailed')).message);
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
    if (saving || !editing) return;
    const payload: Record<string, unknown> = {};
    for (const field of editing.fields) {
      const value = editDraft[field.key] ?? '';
      // Removing every dean or head of department is a real change, not an omitted field.
      if (!value && ['authorizedDeanUserIds', 'authorizedHodUserIds'].includes(field.key)) {
        payload[field.key] = [];
        continue;
      }
      if (!value && !field.required) {
        if (['dueAt', 'validFrom', 'validUntil', 'completedAt', 'scheduledAt'].includes(field.key)) payload[field.key] = null;
        else if (['email', 'externalId', 'description', 'instructions', 'location', 'note', 'feedback'].includes(field.key)) payload[field.key] = null;
        continue;
      }
      if (field.type === 'number' || field.key === 'dayOfWeek') payload[field.key] = Number(value);
      else if (field.type === 'multiselect') payload[field.key] = value ? value.split(',').filter(Boolean) : [];
      else if (field.type === 'date') payload[field.key] = value ? new Date(value).toISOString() : null;
      else if (field.key === 'currency') payload[field.key] = String(value).trim().toUpperCase();
      else payload[field.key] = value;
    }
    await runAdminMutation(async () => {
      await api.patch(`/academic/${editing.resource}/${editing.id}`, payload);
      setEditing(null);
    }, t('toast.updated'));
  };

  const deleteRecord = async (resource: AcademicCrudResource, id: string, title: string) => {
    if (saving) return;
    const question = resource === 'fees' ? t('confirm.void', { title }) : t('confirm.delete', { title });
    if (!window.confirm(question)) return;
    await runAdminMutation(async () => {
      await api.delete(`/academic/${resource}/${id}`);
    }, resource === 'fees' ? t('toast.feeVoided') : t('toast.deleted'));
  };
  const selectedPaymentCharge = feeCharges.find((charge) => charge._id === paymentChargeId);
  const departmentDetail = (department: AcademicDepartment) => {
    if (!canAssignDepartmentLeaders) return department.code;
    const leaderIds = [...(department.authorizedDeanUserIds ?? []), ...(department.authorizedHodUserIds ?? [])];
    const names = departmentLeaders.filter((member) => leaderIds.includes(member._id)).map((member) => member.fullName);
    return names.length
      ? t('departments.leaders', { code: department.code, leaders: names.join(', ') })
      : t('departments.unassigned', { code: department.code });
  };

  if (!isEducationWorkspace) {
    return <div className="academic-card m-6"><h1 className="academic-heading">{t('gate.title')}</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{renderRich(t('gate.body'), { link: (chunk) => <Link className="underline" href="/settings">{chunk}</Link> })}</p></div>;
  }

  const sectionTitle = t(`sections.${activeSection}`);
  const sectionClass = (section: string) => activeSection === section ? '' : 'hidden';
  const peopleEmptyKey = activeSection === 'students' || activeSection === 'teachers' || activeSection === 'parents' ? activeSection : 'overview';

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={sectionTitle}
        subtitle={company?.name
          ? `${institutionLabel} · ${t('header.subtitleWithWorkspace', { workspace: company.name })}`
          : `${institutionLabel} · ${t('header.subtitle')}`}
        icon={GraduationCap}
      />
      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
      <nav aria-label={t('sectionsNav')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {visibleAcademicSections.map((section) => (
          <Link key={section.id} href={`/academic?section=${section.id}`} aria-current={activeSection === section.id ? 'page' : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium ${activeSection === section.id ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'theme-border'}`}>
            {t(`sections.${section.id}`)}
          </Link>
        ))}
      </nav>
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}</div>
      ) : isAdmin ? (
        <>
          {activeSection === 'overview' && <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label={t('summary.people')} value={people.length} icon={Users} />
            <SummaryCard label={t('summary.departments')} value={departments.length} icon={BookOpen} />
            <SummaryCard label={t('summary.activeEnrollments')} value={enrollments.length} icon={GraduationCap} />
            <SummaryCard label={t('summary.courses')} value={courses.length} icon={BookOpen} />
            <SummaryCard label={t('summary.classes')} value={classes.length} icon={GraduationCap} />
            <SummaryCard label={t('summary.outstandingFees')} value={feeCharges.filter((charge) => !charge.isVoided && charge.paidAmountMinor < charge.amountMinor).length} icon={Users} />
          </div>}

          <div className="grid gap-6 xl:grid-cols-2">
            {activeSection === 'imports' && <AcademicImportPanel />}
            <section className={`academic-card ${sectionClass('departments')}`}>
              <h2 className="academic-heading">{t('departments.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/departments', { name: departmentName, code: departmentCode });
                setDepartmentName('');
                setDepartmentCode('');
              })}>
                <label>{t('fields.departmentName')}<input required maxLength={120} value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} /></label>
                <label>{t('fields.code')}<input required maxLength={30} value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value)} /></label>
                <SubmitButton saving={saving} label={t('departments.submit')} />
              </form>
              <div className="mt-5 space-y-2">{departments.length ? departments.map((department) => <RecordRow key={department._id} title={department.name} detail={departmentDetail(department)}
                onEdit={() => beginEdit('departments', department._id, department.name, [
                  editField('name', t('fields.departmentName'), department.name, { required: true, maxLength: 120 }),
                  editField('code', t('fields.code'), department.code, { required: true, maxLength: 30 }),
                  editField('description', t('fields.description'), (department as AcademicDepartment & { description?: string }).description, { maxLength: 1000 }),
                  ...(canAssignDepartmentLeaders ? [
                    editField('authorizedHodUserIds', t('fields.departmentHeads'), (department.authorizedHodUserIds ?? []).join(','), {
                      type: 'multiselect',
                      options: departmentLeaders.filter((member) => member.role === 'hod').map((member) => ({ value: member._id, label: member.fullName })),
                    }),
                    ...(company?.organizationType === 'university' ? [
                      editField('authorizedDeanUserIds', t('fields.deans'), (department.authorizedDeanUserIds ?? []).join(','), {
                        type: 'multiselect',
                        options: departmentLeaders.filter((member) => member.role === 'dean').map((member) => ({ value: member._id, label: member.fullName })),
                      }),
                    ] : []),
                  ] : []),
                ])}
                onDelete={() => void deleteRecord('departments', department._id, department.name)} />) : <EmptyState label={t('departments.empty')} />}</div>
            </section>

            <section className={`academic-card ${['overview', 'students', 'teachers', 'parents'].includes(activeSection) ? '' : 'hidden'}`}>
              <h2 className="academic-heading">{t('people.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                const type = activeSection === 'teachers' ? 'teacher' : activeSection === 'parents' ? 'parent' : personType;
                await api.post('/academic/people', { type, firstName: personFirstName, lastName: personLastName });
                setPersonFirstName('');
                setPersonLastName('');
              })}>
                {activeSection === 'overview' ? <label>{t('fields.role')}<select value={personType} onChange={(event) => setPersonType(event.target.value as AcademicPerson['type'])}><option value="student">{t('options.personType.student')}</option><option value="teacher">{t('options.personType.teacher')}</option><option value="parent">{t('options.personType.parent')}</option></select></label> : <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{valueLabel('personGroup', activeSection)}</p>}
                <label>{t('fields.firstName')}<input required maxLength={100} value={personFirstName} onChange={(event) => setPersonFirstName(event.target.value)} /></label>
                <label>{t('fields.lastName')}<input required maxLength={100} value={personLastName} onChange={(event) => setPersonLastName(event.target.value)} /></label>
                <SubmitButton saving={saving} label={t('people.submit')} />
              </form>
              <div className="mt-5 space-y-2">{people.filter((person) => activeSection === 'overview' || person.type === activeSection.slice(0, -1)).length ? people.filter((person) => activeSection === 'overview' || person.type === activeSection.slice(0, -1)).slice(0, 100).map((person) => <RecordRow key={person._id} title={`${person.firstName} ${person.lastName}`} detail={valueLabel('personType', person.type)}
                onEdit={() => beginEdit('people', person._id, `${person.firstName} ${person.lastName}`, [
                  editField('firstName', t('fields.firstName'), person.firstName, { required: true, maxLength: 100 }),
                  editField('lastName', t('fields.lastName'), person.lastName, { required: true, maxLength: 100 }),
                  editField('email', t('fields.email'), person.email, { maxLength: 254 }),
                  editField('externalId', t('fields.externalId'), person.externalId, { maxLength: 100 }),
                  editField('status', t('fields.status'), person.status, { type: 'select', required: true, options: [{ value: 'active', label: t('options.personStatus.active') }, { value: 'inactive', label: t('options.personStatus.inactive') }] }),
                ])}
                onDelete={() => void deleteRecord('people', person._id, `${person.firstName} ${person.lastName}`)} />) : <EmptyState label={t(`people.empty.${peopleEmptyKey}`)} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('courses')}`}>
              <h2 className="academic-heading">{t('courses.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/courses', { name: courseName, code: courseCode, departmentId: courseDepartmentId, ...(courseCredits ? { credits: Number(courseCredits) } : {}) });
                setCourseName('');
                setCourseCode('');
                setCourseCredits('');
              })}>
                <label>{t('fields.courseName')}<input required maxLength={160} value={courseName} onChange={(event) => setCourseName(event.target.value)} /></label>
                <label>{t('fields.courseCode')}<input required maxLength={30} value={courseCode} onChange={(event) => setCourseCode(event.target.value)} /></label>
                <label>{t('fields.department')}<select required value={courseDepartmentId} onChange={(event) => setCourseDepartmentId(event.target.value)}><option value="">{t('select.department')}</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
                <label>{t('fields.credits')}<input type="number" min="0" max="100" value={courseCredits} onChange={(event) => setCourseCredits(event.target.value)} /></label>
                <SubmitButton saving={saving} disabled={departments.length === 0} label={t('courses.submit')} />
                {departments.length === 0 && <p className="text-xs text-amber-700">{t('courses.needsDepartment')}</p>}
              </form>
              <div className="mt-5 space-y-2">{courses.length ? courses.map((course) => <RecordRow key={course._id} title={course.name} detail={`${course.code} · ${getPopulatedName(course.departmentId, t('fallback.department'))}`}
                onEdit={() => beginEdit('courses', course._id, course.name, [
                  editField('name', t('fields.courseName'), course.name, { required: true, maxLength: 160 }),
                  editField('code', t('fields.courseCode'), course.code, { required: true, maxLength: 30 }),
                  editField('departmentId', t('fields.department'), getRecordId(course.departmentId), { type: 'select', required: true, options: departments.map((department) => ({ value: department._id, label: department.name })) }),
                  editField('credits', t('fields.credits'), course.credits, { type: 'number' }),
                ])}
                onDelete={() => void deleteRecord('courses', course._id, course.name)} />) : <EmptyState label={t('courses.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('classes')}`}>
              <h2 className="academic-heading">{t('classes.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/classes', { name: className, academicYear, departmentId: classDepartmentId, courseIds: [] });
                setClassName('');
                setAcademicYear('');
                setClassDepartmentId('');
              })}>
                <label>{t('fields.className')}<input required maxLength={120} value={className} onChange={(event) => setClassName(event.target.value)} /></label>
                <label>{t('fields.academicYear')}<input required maxLength={30} placeholder="2026–2027" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} /></label>
                <label>{t('fields.department')}<select required value={classDepartmentId} onChange={(event) => setClassDepartmentId(event.target.value)}><option value="">{t('select.department')}</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
                <SubmitButton saving={saving} disabled={departments.length === 0} label={t('classes.submit')} />
                {departments.length === 0 && <p className="text-xs text-amber-700">{t('classes.needsDepartment')}</p>}
              </form>
              <div className="mt-5 space-y-2">{classes.length ? classes.map((academicClass) => <RecordRow key={academicClass._id} title={academicClass.name} detail={academicClass.academicYear}
                onEdit={() => beginEdit('classes', academicClass._id, academicClass.name, [
                  editField('name', t('fields.className'), academicClass.name, { required: true, maxLength: 120 }),
                  editField('academicYear', t('fields.academicYear'), academicClass.academicYear, { required: true, maxLength: 30 }),
                  editField('departmentId', t('fields.department'), getRecordId(academicClass.departmentId), { type: 'select', required: true, options: departments.map((department) => ({ value: department._id, label: department.name })) }),
                  editField('courseIds', t('fields.courses'), (academicClass.courseIds ?? []).map((course) => typeof course === 'string' ? course : course._id).join(','), { type: 'multiselect', options: courses.map((course) => ({ value: course._id, label: course.name })) }),
                ])}
                onDelete={() => void deleteRecord('classes', academicClass._id, academicClass.name)} />) : <EmptyState label={t('classes.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('classes')}`}>
              <h2 className="academic-heading">{t('enrollments.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/enrollments', { studentId: enrollmentStudentId, classId: enrollmentClassId });
                setEnrollmentStudentId('');
                setEnrollmentClassId('');
              })}>
                <label>{t('fields.student')}<select required value={enrollmentStudentId} onChange={(event) => setEnrollmentStudentId(event.target.value)}><option value="">{t('select.student')}</option>{people.filter((person) => person.type === 'student').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.class')}<select required value={enrollmentClassId} onChange={(event) => setEnrollmentClassId(event.target.value)}><option value="">{t('select.class')}</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <SubmitButton saving={saving} disabled={!people.some((person) => person.type === 'student') || classes.length === 0} label={t('enrollments.submit')} />
              </form>
              <div className="mt-5 space-y-2">{enrollments.length ? enrollments.map((enrollment) => <RecordRow key={enrollment._id} title={getPopulatedName(enrollment.studentId, t('fallback.student'))} detail={getPopulatedName(enrollment.classId, t('fallback.class'))}
                onEdit={() => beginEdit('enrollments', enrollment._id, getPopulatedName(enrollment.studentId, t('fallback.student')), [
                  editField('status', t('fields.enrollmentStatus'), (enrollment as AcademicEnrollment & { status?: string }).status, { type: 'select', required: true, options: [{ value: 'active', label: t('options.enrollmentStatus.active') }, { value: 'completed', label: t('options.enrollmentStatus.completed') }, { value: 'withdrawn', label: t('options.enrollmentStatus.withdrawn') }] }),
                ])}
                onDelete={() => void deleteRecord('enrollments', enrollment._id, getPopulatedName(enrollment.studentId, t('fallback.student')))} />) : <EmptyState label={t('enrollments.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('teachers')}`}>
              <h2 className="academic-heading">{t('teaching.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/teaching-assignments', { teacherId: teachingTeacherId, classId: teachingClassId });
                setTeachingTeacherId('');
                setTeachingClassId('');
              })}>
                <label>{t('fields.teacher')}<select required value={teachingTeacherId} onChange={(event) => setTeachingTeacherId(event.target.value)}><option value="">{t('select.teacher')}</option>{people.filter((person) => person.type === 'teacher').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.class')}<select required value={teachingClassId} onChange={(event) => setTeachingClassId(event.target.value)}><option value="">{t('select.class')}</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <SubmitButton saving={saving} disabled={!people.some((person) => person.type === 'teacher') || classes.length === 0} label={t('teaching.submit')} />
              </form>
              <div className="mt-5 space-y-2">{teachingAssignments.length ? teachingAssignments.map((assignment) => <RecordRow key={assignment._id} title={getPopulatedName(assignment.teacherId, t('fallback.teacher'))} detail={getPopulatedName(assignment.classId, t('fallback.class'))}
                onEdit={() => beginEdit('teaching-assignments', assignment._id, getPopulatedName(assignment.teacherId, t('fallback.teacher')), [
                  editField('teacherId', t('fields.teacher'), getRecordId(assignment.teacherId), { type: 'select', required: true, options: people.filter((person) => person.type === 'teacher').map((person) => ({ value: person._id, label: `${person.firstName} ${person.lastName}` })) }),
                  editField('classId', t('fields.class'), getRecordId(assignment.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                ])}
                onDelete={() => void deleteRecord('teaching-assignments', assignment._id, getPopulatedName(assignment.teacherId, t('fallback.teacher')))} />) : <EmptyState label={t('teaching.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('timetable')}`}>
              <h2 className="academic-heading">{t('timetable.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/schedules', { classId: scheduleClassId, dayOfWeek: Number(scheduleDay), startTime: scheduleStart, endTime: scheduleEnd, location: scheduleLocation });
                setScheduleLocation('');
              })}>
                <label>{t('fields.class')}<select required value={scheduleClassId} onChange={(event) => setScheduleClassId(event.target.value)}><option value="">{t('select.class')}</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <label>{t('fields.weekday')}<select value={scheduleDay} onChange={(event) => setScheduleDay(event.target.value)}>{weekdayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-3"><label>{t('fields.start')}<input type="time" required value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} /></label><label>{t('fields.end')}<input type="time" required value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} /></label></div>
                <label>{t('fields.location')}<input maxLength={160} value={scheduleLocation} onChange={(event) => setScheduleLocation(event.target.value)} /></label>
                <SubmitButton saving={saving} disabled={classes.length === 0} label={t('timetable.submit')} />
              </form>
              <div className="mt-5 space-y-2">{schedules.length ? schedules.map((schedule) => <RecordRow key={schedule._id} title={getPopulatedName(schedule.classId, t('fallback.class'))} detail={scheduleDetail(schedule)}
                onEdit={() => beginEdit('schedules', schedule._id, getPopulatedName(schedule.classId, t('fallback.class')), [
                  editField('classId', t('fields.class'), getRecordId(schedule.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                  editField('dayOfWeek', t('fields.weekday'), schedule.dayOfWeek, { type: 'select', required: true, options: weekdayOptions }),
                  editField('startTime', t('fields.startTime'), schedule.startTime, { type: 'time', required: true }),
                  editField('endTime', t('fields.endTime'), schedule.endTime, { type: 'time', required: true }),
                  editField('location', t('fields.location'), schedule.location, { maxLength: 160 }),
                ])}
                onDelete={() => void deleteRecord('schedules', schedule._id, getPopulatedName(schedule.classId, t('fallback.class')))} />) : <EmptyState label={t('timetable.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('assignments')}`}>
              <h2 className="academic-heading">{t('assignments.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/assignments', { classId: assignmentClassId, title: assignmentTitle, pointsPossible: Number(assignmentPoints) });
                setAssignmentTitle('');
              })}>
                <label>{t('fields.class')}<select required value={assignmentClassId} onChange={(event) => setAssignmentClassId(event.target.value)}><option value="">{t('select.class')}</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name} · {academicClass.academicYear}</option>)}</select></label>
                <label>{t('fields.title')}<input required maxLength={180} value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} /></label>
                <label>{t('fields.pointsPossible')}<input required type="number" min="0" max="100000" value={assignmentPoints} onChange={(event) => setAssignmentPoints(event.target.value)} /></label>
                <SubmitButton saving={saving} disabled={classes.length === 0} label={t('assignments.submit')} />
              </form>
              <div className="mt-5 space-y-2">{assignments.length ? assignments.map((assignment) => <RecordRow key={assignment._id} title={assignment.title} detail={`${getPopulatedName(assignment.classId, t('fallback.class'))} · ${formatPoints(assignment.pointsPossible)}`}
                onEdit={() => beginEdit('assignments', assignment._id, assignment.title, [
                  editField('classId', t('fields.class'), getRecordId(assignment.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                  editField('title', t('fields.assignmentTitle'), assignment.title, { required: true, maxLength: 180 }),
                  editField('dueAt', t('fields.dueDate'), assignment.dueAt, { type: 'date' }),
                  editField('pointsPossible', t('fields.pointsPossible'), assignment.pointsPossible, { type: 'number', required: true }),
                ])}
                onDelete={() => void deleteRecord('assignments', assignment._id, assignment.title)} />) : <EmptyState label={t('assignments.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('attendance')}`}>
              <h2 className="academic-heading">{t('attendance.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.put('/academic/attendance', { classId: attendanceClassId, studentId: attendanceStudentId, date: attendanceDate, status: attendanceStatus });
              })}>
                <label>{t('fields.class')}<select required value={attendanceClassId} onChange={(event) => { setAttendanceClassId(event.target.value); setAttendanceStudentId(''); }}><option value="">{t('select.class')}</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name}</option>)}</select></label>
                <label>{t('fields.student')}<select required value={attendanceStudentId} onChange={(event) => setAttendanceStudentId(event.target.value)}><option value="">{t('select.student')}</option>{people.filter((person) => person.type === 'student' && enrollments.some((enrollment) => getRecordId(enrollment.studentId) === person._id && getRecordId(enrollment.classId) === attendanceClassId)).map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.date')}<input required type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label>
                <label>{t('fields.status')}<select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as AcademicAttendance['status'])}>{ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{t(`options.attendanceStatus.${status}`)}</option>)}</select></label>
                <SubmitButton saving={saving} disabled={classes.length === 0} label={t('attendance.submit')} />
              </form>
              <div className="mt-5 space-y-2">{attendance.length ? attendance.map((entry) => <RecordRow key={entry._id} title={getPopulatedName(entry.studentId, t('fallback.student'))} detail={`${formatDate(entry.date, RECORD_DATE)} · ${valueLabel('attendanceStatus', entry.status)}`}
                onEdit={() => beginEdit('attendance', entry._id, getPopulatedName(entry.studentId, t('fallback.student')), [
                  editField('status', t('fields.attendanceStatus'), entry.status, { type: 'select', required: true, options: ATTENDANCE_STATUSES.map((status) => ({ value: status, label: valueLabel('attendanceStatus', status) })) }),
                  editField('note', t('fields.note'), (entry as AcademicAttendance & { note?: string }).note, { maxLength: 500 }),
                ])}
                onDelete={() => void deleteRecord('attendance', entry._id, getPopulatedName(entry.studentId, t('fallback.student')))} />) : <EmptyState label={t('attendance.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('exams')}`}>
              <h2 className="academic-heading">{t('exams.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/assessments', { classId: assessmentClassId, title: assessmentTitle, type: assessmentType, pointsPossible: Number(assessmentPoints) });
                setAssessmentTitle('');
              })}>
                <label>{t('fields.class')}<select required value={assessmentClassId} onChange={(event) => setAssessmentClassId(event.target.value)}><option value="">{t('select.class')}</option>{classes.map((academicClass) => <option key={academicClass._id} value={academicClass._id}>{academicClass.name}</option>)}</select></label>
                <label>{t('fields.title')}<input required maxLength={180} value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} /></label>
                <label>{t('fields.type')}<select value={assessmentType} onChange={(event) => setAssessmentType(event.target.value as AcademicAssessment['type'])}>{ASSESSMENT_TYPES.map((type) => <option key={type} value={type}>{t(`options.assessmentType.${type}`)}</option>)}</select></label>
                <label>{t('fields.maximumPoints')}<input required type="number" min="0" max="100000" value={assessmentPoints} onChange={(event) => setAssessmentPoints(event.target.value)} /></label>
                <SubmitButton saving={saving} disabled={classes.length === 0} label={t('exams.submit')} />
              </form>
              <div className="mt-5 space-y-2">{assessments.length ? assessments.map((assessment) => <RecordRow key={assessment._id} title={assessment.title} detail={`${valueLabel('assessmentType', assessment.type)} · ${formatPoints(assessment.pointsPossible)}`}
                onEdit={() => beginEdit('assessments', assessment._id, assessment.title, [
                  editField('classId', t('fields.class'), getRecordId(assessment.classId), { type: 'select', required: true, options: classes.map((academicClass) => ({ value: academicClass._id, label: academicClass.name })) }),
                  editField('title', t('fields.assessmentTitle'), assessment.title, { required: true, maxLength: 180 }),
                  editField('type', t('fields.type'), assessment.type, { type: 'select', required: true, options: ASSESSMENT_TYPES.map((type) => ({ value: type, label: valueLabel('assessmentType', type) })) }),
                  editField('scheduledAt', t('fields.scheduledDate'), (assessment as AcademicAssessment & { scheduledAt?: string }).scheduledAt, { type: 'date' }),
                  editField('pointsPossible', t('fields.maximumPoints'), assessment.pointsPossible, { type: 'number', required: true }),
                ])}
                onDelete={() => void deleteRecord('assessments', assessment._id, assessment.title)} />) : <EmptyState label={t('exams.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('results')}`}>
              <h2 className="academic-heading">{t('results.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.put('/academic/results', { assessmentId: resultAssessmentId, studentId: resultStudentId, pointsEarned: Number(resultPoints) });
                setResultPoints('');
              })}>
                <label>{t('fields.assessment')}<select required value={resultAssessmentId} onChange={(event) => { setResultAssessmentId(event.target.value); setResultStudentId(''); }}><option value="">{t('select.assessment')}</option>{assessments.map((assessment) => <option key={assessment._id} value={assessment._id}>{assessment.title}</option>)}</select></label>
                <label>{t('fields.student')}<select required value={resultStudentId} onChange={(event) => setResultStudentId(event.target.value)}><option value="">{t('select.student')}</option>{people.filter((person) => person.type === 'student' && enrollments.some((enrollment) => getRecordId(enrollment.studentId) === person._id && getRecordId(enrollment.classId) === getRecordId(assessments.find((assessment) => assessment._id === resultAssessmentId)?.classId))).map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.pointsEarned')}<input required type="number" min="0" max={assessments.find((assessment) => assessment._id === resultAssessmentId)?.pointsPossible ?? 100000} value={resultPoints} onChange={(event) => setResultPoints(event.target.value)} /></label>
                <SubmitButton saving={saving} disabled={!assessments.length || !resultAssessmentId} label={t('results.submit')} />
              </form>
              <div className="mt-5 space-y-2">{results.length ? results.map((result) => <RecordRow key={result._id} title={getPopulatedName(result.studentId, t('fallback.student'))} detail={`${getPopulatedName(result.assessmentId, t('fallback.assessment'))} · ${formatPoints(result.pointsEarned)}`}
                onEdit={() => beginEdit('results', result._id, getPopulatedName(result.studentId, t('fallback.student')), [
                  editField('pointsEarned', t('fields.pointsEarned'), result.pointsEarned, { type: 'number', required: true }),
                  editField('feedback', t('fields.feedback'), (result as AcademicResult & { feedback?: string }).feedback, { maxLength: 2000 }),
                ])}
                onDelete={() => void deleteRecord('results', result._id, getPopulatedName(result.studentId, t('fallback.student')))} />) : <EmptyState label={t('results.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('fees')}`}>
              <h2 className="academic-heading">{t('fees.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/fees', {
                  studentId: feeStudentId,
                  invoiceNumber: feeInvoiceNumber.trim().toUpperCase(),
                  description: feeDescription.trim(),
                  amountMinor: Number(feeAmountMinor),
                  currency: feeCurrency.trim().toUpperCase(),
                  ...(feeDueAt ? { dueAt: new Date(feeDueAt).toISOString() } : {}),
                });
                setFeeInvoiceNumber('');
                setFeeDescription('');
                setFeeAmountMinor('');
                setFeeDueAt('');
              })}>
                <label>{t('fields.student')}<select required value={feeStudentId} onChange={(event) => setFeeStudentId(event.target.value)}><option value="">{t('select.student')}</option>{people.filter((person) => person.type === 'student').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.invoiceNumber')}<input required maxLength={40} value={feeInvoiceNumber} onChange={(event) => setFeeInvoiceNumber(event.target.value)} /></label>
                <label>{t('fields.description')}<input required maxLength={180} value={feeDescription} onChange={(event) => setFeeDescription(event.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3"><label>{t('fields.amountMinor')}<input required type="number" min="1" step="1" value={feeAmountMinor} onChange={(event) => setFeeAmountMinor(event.target.value)} /></label><label>{t('fields.isoCurrency')}<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={feeCurrency} onChange={(event) => setFeeCurrency(event.target.value.toUpperCase())} /></label></div>
                <label>{t('fields.dueDate')}<input type="date" value={feeDueAt} onChange={(event) => setFeeDueAt(event.target.value)} /></label>
                <SubmitButton saving={saving} disabled={!people.some((person) => person.type === 'student')} label={t('fees.submit')} />
              </form>
            </section>

            <section className={`academic-card ${sectionClass('fees')}`}>
              <h2 className="academic-heading">{t('fees.paymentHeading')}</h2>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>{t('fees.paymentNote')}</p>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post(`/academic/fees/${paymentChargeId}/payments`, { amountMinor: Number(paymentAmountMinor), method: paymentMethod });
                setPaymentAmountMinor('');
              })}>
                <label>{t('fields.openCharge')}<select required value={paymentChargeId} onChange={(event) => {
                  const nextId = event.target.value;
                  setPaymentChargeId(nextId);
                  const selected = feeCharges.find((charge) => charge._id === nextId);
                  if (selected && selected.paidAmountMinor < selected.amountMinor) {
                    setPaymentAmountMinor(String(selected.amountMinor - selected.paidAmountMinor));
                  } else {
                    setPaymentAmountMinor('');
                  }
                }}><option value="">{t('select.charge')}</option>{feeCharges.filter((charge) => !charge.isVoided && charge.paidAmountMinor < charge.amountMinor).map((charge) => <option key={charge._id} value={charge._id}>{t('fees.chargeOption', { student: getPopulatedName(charge.studentId, t('fallback.student')), invoice: charge.invoiceNumber, amount: formatMinorCurrency(charge.amountMinor - charge.paidAmountMinor, charge.currency) })}</option>)}</select></label>
                <label>{t('fields.paymentAmountMinor')}<input required type="number" min="1" step="1" max={selectedPaymentCharge ? selectedPaymentCharge.amountMinor - selectedPaymentCharge.paidAmountMinor : undefined} value={paymentAmountMinor} onChange={(event) => setPaymentAmountMinor(event.target.value)} /></label>
                <label>{t('fields.method')}<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="bank_transfer">{t('options.paymentMethod.bankTransfer')}</option><option value="cash">{t('options.paymentMethod.cash')}</option><option value="other">{t('options.paymentMethod.other')}</option></select></label>
                <SubmitButton saving={saving} disabled={!paymentChargeId || !feeCharges.some((charge) => charge._id === paymentChargeId && charge.paidAmountMinor < charge.amountMinor)} label={t('fees.paymentSubmit')} />
              </form>
            </section>

            <section className={`academic-card xl:col-span-2 ${sectionClass('fees')}`}>
              <h2 className="academic-heading">{t('fees.registerHeading')}</h2>
              <div className="space-y-2">{feeCharges.length ? feeCharges.map((charge) => <RecordRow key={charge._id} title={`${getPopulatedName(charge.studentId, t('fallback.student'))} · ${charge.invoiceNumber} · ${charge.description}`} detail={feePaidDetail(charge)}
                onEdit={() => beginEdit('fees', charge._id, charge.invoiceNumber, [
                  editField('invoiceNumber', t('fields.invoiceNumber'), charge.invoiceNumber, { required: true, maxLength: 40 }),
                  editField('description', t('fields.description'), charge.description, { required: true, maxLength: 180 }),
                  editField('amountMinor', t('fields.amountMinor'), charge.amountMinor, { type: 'number', required: true }),
                  editField('currency', t('fields.isoCurrency'), charge.currency, { required: true, maxLength: 3 }),
                  editField('dueAt', t('fields.dueDate'), charge.dueAt, { type: 'date' }),
                ])}
                onDelete={charge.isVoided ? undefined : () => void deleteRecord('fees', charge._id, charge.invoiceNumber)} />) : <EmptyState label={t('fees.empty')} />}</div>
            </section>

            <section className={`academic-card ${sectionClass('parents')}`}>
              <h2 className="academic-heading">{t('guardians.heading')}</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/guardians', { studentId: guardianStudentId, guardianId: guardianParentId, relationship: guardianRelationship });
                setGuardianStudentId('');
                setGuardianParentId('');
              })}>
                <label>{t('fields.student')}<select required value={guardianStudentId} onChange={(event) => setGuardianStudentId(event.target.value)}><option value="">{t('select.student')}</option>{people.filter((person) => person.type === 'student').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.parentGuardian')}<select required value={guardianParentId} onChange={(event) => setGuardianParentId(event.target.value)}><option value="">{t('select.parent')}</option>{people.filter((person) => person.type === 'parent').map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>
                <label>{t('fields.relationship')}<select value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value as AcademicGuardianLink['relationship'])}>{GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{t(`options.relationship.${relationship}`)}</option>)}</select></label>
                <SubmitButton saving={saving} disabled={!people.some((person) => person.type === 'parent') || !people.some((person) => person.type === 'student')} label={t('guardians.submit')} />
              </form>
              <div className="mt-5 space-y-2">{guardianLinks.length ? guardianLinks.map((link) => {
                const student = people.find((person) => person._id === link.studentId);
                const guardian = people.find((person) => person._id === link.guardianId);
                return <RecordRow key={link._id} title={`${student ? `${student.firstName} ${student.lastName}` : t('fallback.student')} — ${guardian ? `${guardian.firstName} ${guardian.lastName}` : t('fallback.parent')}`} detail={valueLabel('relationship', link.relationship)}
                  onEdit={() => beginEdit('guardians', link._id, t('guardians.linkTitle'), [
                    editField('studentId', t('fields.student'), link.studentId, { type: 'select', required: true, options: people.filter((person) => person.type === 'student').map((person) => ({ value: person._id, label: `${person.firstName} ${person.lastName}` })) }),
                    editField('guardianId', t('fields.parentGuardian'), link.guardianId, { type: 'select', required: true, options: people.filter((person) => person.type === 'parent').map((person) => ({ value: person._id, label: `${person.firstName} ${person.lastName}` })) }),
                    editField('relationship', t('fields.relationship'), link.relationship, { type: 'select', required: true, options: GUARDIAN_RELATIONSHIPS.map((relationship) => ({ value: relationship, label: valueLabel('relationship', relationship) })) }),
                  ])}
                  onDelete={() => void deleteRecord('guardians', link._id, t('guardians.linkTitle'))} />;
              }) : <EmptyState label={t('guardians.empty')} />}</div>
            </section>
          </div>
        </>
      ) : portal ? (
        <>
          {activeSection === 'overview' && <>
            <section className="academic-card">
              <h2 className="academic-heading">{t('portal.welcome', { name: portal.profile.firstName })}</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{portal.profile.type === 'parent' ? t('portal.intro.parent') : portal.profile.type === 'teacher' ? t('portal.intro.teacher') : t('portal.intro.student')}</p>
            </section>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label={t('summary.studentsVisible')} value={portal.students.length} icon={Users} />
              <SummaryCard label={t('summary.currentClasses')} value={portal.enrollments.length} icon={GraduationCap} />
              <SummaryCard label={t('summary.upcomingWork')} value={portal.assignments.length + portal.assessments.length} icon={BookOpen} />
            </div>
          </>}
          {activeSection === 'students' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.students')}</h2>
            {portal.students.length ? portal.students.map((student) => <RecordRow key={student._id} title={`${student.firstName} ${student.lastName}`} detail={student.externalId ?? valueLabel('personType', student.type)} />) : <EmptyState label={t('portal.noStudents')} />}
          </section>}
          {activeSection === 'teachers' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.teachers')}</h2>
            {portal.profile.type === 'teacher'
              ? <RecordRow title={`${portal.profile.firstName} ${portal.profile.lastName}`} detail={t('portal.teacherProfile')} />
              : <EmptyState label={t('portal.teachersRestricted')} />}
          </section>}
          {activeSection === 'parents' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.parents')}</h2>
            {portal.profile.type === 'parent'
              ? <RecordRow title={`${portal.profile.firstName} ${portal.profile.lastName}`} detail={t('portal.parentProfile')} />
              : <EmptyState label={t('portal.parentsRestricted')} />}
          </section>}
          {(activeSection === 'departments' || activeSection === 'courses') && <section className="academic-card">
            <EmptyState label={t('portal.managementRestricted')} />
          </section>}
          {activeSection === 'classes' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.classes')}</h2>
            {portal.enrollments.length ? portal.enrollments.map((enrollment) => <RecordRow key={enrollment._id} title={getPopulatedName(enrollment.classId, t('fallback.class'))} detail={portal.profile.type === 'parent' ? getPopulatedName(enrollment.studentId, t('fallback.student')) : ''} />) : <EmptyState label={t('portal.noClasses')} />}
          </section>}
          {activeSection === 'timetable' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.timetable')}</h2>
            {portal.schedules.length ? portal.schedules.map((schedule) => <RecordRow key={schedule._id} title={getPopulatedName(schedule.classId, t('fallback.class'))} detail={scheduleDetail(schedule)} />) : <EmptyState label={t('portal.noTimetable')} />}
          </section>}
          {activeSection === 'assignments' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.assignments')}</h2>
            {portal.assignments.length ? portal.assignments.map((assignment) => <RecordRow key={assignment._id} title={assignment.title} detail={`${getPopulatedName(assignment.classId, t('fallback.class'))} · ${formatPoints(assignment.pointsPossible)}`} />) : <EmptyState label={t('portal.noAssignments')} />}
          </section>}
          {activeSection === 'attendance' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.attendance')}</h2>
            {portal.attendance.length ? portal.attendance.map((entry) => <RecordRow key={entry._id} title={getPopulatedName(entry.classId, t('fallback.class'))} detail={`${formatDate(entry.date, RECORD_DATE)} · ${valueLabel('attendanceStatus', entry.status)}`} />) : <EmptyState label={t('portal.noAttendance')} />}
          </section>}
          {activeSection === 'exams' && <section className="academic-card">
            <h2 className="academic-heading">{t('portal.examsHeading')}</h2>
            {portal.assessments.length ? portal.assessments.map((assessment) => <RecordRow key={assessment._id} title={assessment.title} detail={`${getPopulatedName(assessment.classId, t('fallback.class'))} · ${valueLabel('assessmentType', assessment.type)} · ${formatPoints(assessment.pointsPossible)}`} />) : <EmptyState label={t('portal.noExams')} />}
          </section>}
          {activeSection === 'results' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.results')}</h2>
            {portal.results.length ? portal.results.map((result) => <RecordRow key={result._id} title={getPopulatedName(result.assessmentId, t('fallback.assessment'))} detail={formatPoints(result.pointsEarned)} />) : <EmptyState label={t('portal.noResults')} />}
          </section>}
          {activeSection === 'fees' && <section className="academic-card">
            <h2 className="academic-heading">{t('sections.fees')}</h2>
            {portal.profile.type === 'teacher'
              ? <EmptyState label={t('portal.feesUnavailable')} />
              : portal.feeCharges.length ? portal.feeCharges.map((charge) => <RecordRow key={charge._id} title={`${charge.invoiceNumber} · ${charge.description}`} detail={feePaidDetail(charge)} />) : <EmptyState label={t('portal.noFees')} />}
          </section>}
        </>
      ) : (
        <div className="academic-card"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error || t('errors.noProfile')}</p></div>
      )}
      {editing && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditing(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="academic-edit-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
            <h2 id="academic-edit-title" className="academic-heading">{t('editModal.title', { title: editing.title })}</h2>
            <form className="academic-form" onSubmit={saveEdit}>
              {editing.fields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.type === 'select' ? (
                    <select required={field.required} value={editDraft[field.key] ?? ''} onChange={(event) => setEditDraft((draft) => ({ ...draft, [field.key]: event.target.value }))}>
                      <option value="">{t('editModal.selectField', { field: field.label.toLowerCase() })}</option>
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
                <button type="button" className="btn-secondary" disabled={saving} onClick={() => setEditing(null)}>{tc('actions.cancel')}</button>
                <SubmitButton saving={saving} label={tc('actions.saveChanges')} />
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

function SubmitButton({
  saving,
  disabled = false,
  label,
  icon: Icon = Plus,
}: {
  saving: boolean;
  disabled?: boolean;
  label: string;
  icon?: typeof Plus;
}) {
  return (
    <button type="submit" className="btn-primary" disabled={saving || disabled}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
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
  const t = useT('academic');
  const tc = useT('common');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-base)' }}>
      <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
      <span className="shrink-0 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{detail}</span>
      {(onEdit || onDelete) && (
        <span className="flex shrink-0 gap-1">
          {onEdit && <button type="button" aria-label={t('row.edit', { title })} title={tc('actions.edit')} disabled={false} onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Pencil className="h-4 w-4" /></button>}
          {onDelete && <button type="button" aria-label={t('row.delete', { title })} title={tc('actions.delete')} onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>}
        </span>
      )}
    </div>
  );
}
