'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { useAuthStore } from '@/store/useAuthStore';
import { PageHeader } from '@/components/common/PageHeader';
import { BookOpen, GraduationCap, Loader2, Plus, Users } from 'lucide-react';

type AcademicPerson = {
  _id: string;
  type: 'student' | 'teacher' | 'parent';
  firstName: string;
  lastName: string;
  externalId?: string;
};

type AcademicDepartment = { _id: string; name: string; code: string };
type AcademicClass = { _id: string; name: string; academicYear: string };
type AcademicEnrollment = {
  _id: string;
  studentId: AcademicPerson | string;
  classId: AcademicClass | string | null;
  enrolledAt: string;
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
};
type AcademicAssessment = {
  _id: string;
  title: string;
  type: 'exam' | 'quiz' | 'test' | 'project';
  pointsPossible: number;
  classId: AcademicClass | string | null;
};
type AcademicResult = {
  _id: string;
  pointsEarned: number;
  assessmentId: (AcademicAssessment & { title: string }) | string | null;
  studentId: AcademicPerson | string | null;
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
  attendance: AcademicAttendance[];
  results: AcademicResult[];
  feeCharges: AcademicFeeCharge[];
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

function formatMinorCurrency(amountMinor: number, currency: string): string {
  const fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountMinor / (10 ** fractionDigits));
}

export default function AcademicPage() {
  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const isEducationWorkspace = !!company?.organizationType && company.organizationType !== 'business';
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [people, setPeople] = useState<AcademicPerson[]>([]);
  const [departments, setDepartments] = useState<AcademicDepartment[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [enrollments, setEnrollments] = useState<AcademicEnrollment[]>([]);
  const [schedules, setSchedules] = useState<AcademicSchedule[]>([]);
  const [assignments, setAssignments] = useState<AcademicAssignment[]>([]);
  const [attendance, setAttendance] = useState<AcademicAttendance[]>([]);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [results, setResults] = useState<AcademicResult[]>([]);
  const [feeCharges, setFeeCharges] = useState<AcademicFeeCharge[]>([]);
  const [portal, setPortal] = useState<AcademicPortal | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [personFirstName, setPersonFirstName] = useState('');
  const [personLastName, setPersonLastName] = useState('');
  const [personType, setPersonType] = useState<AcademicPerson['type']>('student');
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [classDepartmentId, setClassDepartmentId] = useState('');
  const [enrollmentStudentId, setEnrollmentStudentId] = useState('');
  const [enrollmentClassId, setEnrollmentClassId] = useState('');
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

  const loadAdminData = useCallback(async () => {
    const [peopleResponse, departmentsResponse, classesResponse, enrollmentResponse, schedulesResponse, assignmentsResponse, attendanceResponse, assessmentsResponse, resultsResponse, feesResponse] = await Promise.all([
      api.get('/academic/people'),
      api.get('/academic/departments'),
      api.get('/academic/classes'),
      api.get('/academic/enrollments'),
      api.get('/academic/schedules'),
      api.get('/academic/assignments'),
      api.get('/academic/attendance'),
      api.get('/academic/assessments'),
      api.get('/academic/results'),
      api.get('/academic/fees'),
    ]);
    setPeople(peopleResponse.data.people);
    setDepartments(departmentsResponse.data.departments);
    setClasses(classesResponse.data.classes);
    setEnrollments(enrollmentResponse.data.enrollments);
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
    setSaving(true);
    setError('');
    try {
      await operation();
      await loadAdminData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save this academic record.'));
    } finally {
      setSaving(false);
    }
  };
  const selectedPaymentCharge = feeCharges.find((charge) => charge._id === paymentChargeId);

  if (!isEducationWorkspace) {
    return <div className="p-6"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Academic tools are available in school, college, and university workspaces.</p></div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Academic"
        subtitle={company?.name ? `${company.name} · ${company.organizationType}` : 'Education workspace'}
        icon={GraduationCap}
      />
      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="h-4 w-4 animate-spin" /> Loading academic records…</div>
      ) : isAdmin ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="People" value={people.length} icon={Users} />
            <SummaryCard label="Departments" value={departments.length} icon={BookOpen} />
            <SummaryCard label="Active enrollments" value={enrollments.length} icon={GraduationCap} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{departments.map((department) => <RecordRow key={department._id} title={department.name} detail={department.code} />)}</div>
            </section>

            <section className="academic-card">
              <h2 className="academic-heading">Register a person</h2>
              <form className="academic-form" onSubmit={(event) => submit(event, async () => {
                await api.post('/academic/people', { type: personType, firstName: personFirstName, lastName: personLastName });
                setPersonFirstName('');
                setPersonLastName('');
              })}>
                <label>Role<select value={personType} onChange={(event) => setPersonType(event.target.value as AcademicPerson['type'])}><option value="student">Student</option><option value="teacher">Teacher</option><option value="parent">Parent / guardian</option></select></label>
                <label>First name<input required maxLength={100} value={personFirstName} onChange={(event) => setPersonFirstName(event.target.value)} /></label>
                <label>Last name<input required maxLength={100} value={personLastName} onChange={(event) => setPersonLastName(event.target.value)} /></label>
                <SubmitButton saving={saving} label="Register person" />
              </form>
              <div className="mt-5 space-y-2">{people.slice(0, 8).map((person) => <RecordRow key={person._id} title={`${person.firstName} ${person.lastName}`} detail={person.type} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{classes.map((academicClass) => <RecordRow key={academicClass._id} title={academicClass.name} detail={academicClass.academicYear} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{enrollments.map((enrollment) => <RecordRow key={enrollment._id} title={getPopulatedName(enrollment.studentId, 'Student')} detail={getPopulatedName(enrollment.classId, 'Class')} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{schedules.map((schedule) => <RecordRow key={schedule._id} title={getPopulatedName(schedule.classId, 'Class')} detail={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][schedule.dayOfWeek - 1]} · ${schedule.startTime}–${schedule.endTime}`} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{assignments.map((assignment) => <RecordRow key={assignment._id} title={assignment.title} detail={`${getPopulatedName(assignment.classId, 'Class')} · ${assignment.pointsPossible} pts`} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{attendance.slice(0, 8).map((entry) => <RecordRow key={entry._id} title={getPopulatedName(entry.studentId, 'Student')} detail={`${new Date(entry.date).toLocaleDateString()} · ${entry.status}`} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{assessments.map((assessment) => <RecordRow key={assessment._id} title={assessment.title} detail={`${assessment.type} · ${assessment.pointsPossible} pts`} />)}</div>
            </section>

            <section className="academic-card">
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
              <div className="mt-5 space-y-2">{results.slice(0, 8).map((result) => <RecordRow key={result._id} title={getPopulatedName(result.studentId, 'Student')} detail={`${getPopulatedName(result.assessmentId, 'Assessment')} · ${result.pointsEarned} pts`} />)}</div>
            </section>

            <section className="academic-card">
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

            <section className="academic-card">
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

            <section className="academic-card xl:col-span-2">
              <h2 className="academic-heading">Fee register</h2>
              <div className="space-y-2">{feeCharges.map((charge) => <RecordRow key={charge._id} title={`${getPopulatedName(charge.studentId, 'Student')} · ${charge.invoiceNumber} · ${charge.description}`} detail={`${formatMinorCurrency(charge.paidAmountMinor, charge.currency)} / ${formatMinorCurrency(charge.amountMinor, charge.currency)} paid`} />)}</div>
            </section>
          </div>
        </>
      ) : portal ? (
        <>
          <div className="academic-card">
            <h2 className="academic-heading">Welcome, {portal.profile.firstName}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{portal.profile.type === 'parent' ? 'Linked student records' : 'Your enrolled classes'}</p>
            {portal.students.map((student) => <RecordRow key={student._id} title={`${student.firstName} ${student.lastName}`} detail={student.externalId ?? student.type} />)}
          </div>
          <section className="academic-card">
            <h2 className="academic-heading">Current enrollments</h2>
            {portal.enrollments.length ? portal.enrollments.map((enrollment) => <RecordRow key={enrollment._id} title={getPopulatedName(enrollment.classId, 'Class')} detail={portal.profile.type === 'parent' ? getPopulatedName(enrollment.studentId, 'Student') : ''} />) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active class enrollments are available.</p>}
          </section>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="academic-card"><h2 className="academic-heading">Timetable</h2>{portal.schedules.length ? portal.schedules.map((schedule) => <RecordRow key={schedule._id} title={getPopulatedName(schedule.classId, 'Class')} detail={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][schedule.dayOfWeek - 1]} · ${schedule.startTime}–${schedule.endTime}`} />) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No timetable sessions are published.</p>}</section>
            <section className="academic-card"><h2 className="academic-heading">Assignments</h2>{portal.assignments.length ? portal.assignments.map((assignment) => <RecordRow key={assignment._id} title={assignment.title} detail={`${getPopulatedName(assignment.classId, 'Class')} · ${assignment.pointsPossible} pts`} />) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No assignments are available.</p>}</section>
            <section className="academic-card"><h2 className="academic-heading">Attendance</h2>{portal.attendance.length ? portal.attendance.map((entry) => <RecordRow key={entry._id} title={getPopulatedName(entry.classId, 'Class')} detail={`${new Date(entry.date).toLocaleDateString()} · ${entry.status}`} />) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No attendance records are available.</p>}</section>
            <section className="academic-card"><h2 className="academic-heading">Results</h2>{portal.results.length ? portal.results.map((result) => <RecordRow key={result._id} title={getPopulatedName(result.assessmentId, 'Assessment')} detail={`${result.pointsEarned} pts`} />) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results are available.</p>}</section>
            <section className="academic-card"><h2 className="academic-heading">Fees</h2>{portal.feeCharges.length ? portal.feeCharges.map((charge) => <RecordRow key={charge._id} title={`${charge.invoiceNumber} · ${charge.description}`} detail={`${formatMinorCurrency(charge.paidAmountMinor, charge.currency)} / ${formatMinorCurrency(charge.amountMinor, charge.currency)} paid`} />) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No fee charges are available.</p>}</section>
          </div>
        </>
      ) : (
        <div className="academic-card"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error || 'This account does not have an academic profile linked yet.'}</p></div>
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

function RecordRow({ title, detail }: { title: string; detail: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--bg-base)' }}><span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span><span className="shrink-0 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{detail}</span></div>;
}
