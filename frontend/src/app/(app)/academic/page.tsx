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

type AcademicPortal = {
  profile: AcademicPerson;
  students: AcademicPerson[];
  enrollments: AcademicEnrollment[];
};

function getPopulatedName<T extends { _id: string }>(value: T | string | null, fallback: string): string {
  if (!value || typeof value === 'string') return fallback;
  return 'name' in value && typeof value.name === 'string' ? value.name : fallback;
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

  const loadAdminData = useCallback(async () => {
    const [peopleResponse, departmentsResponse, classesResponse, enrollmentResponse] = await Promise.all([
      api.get('/academic/people'),
      api.get('/academic/departments'),
      api.get('/academic/classes'),
      api.get('/academic/enrollments'),
    ]);
    setPeople(peopleResponse.data.people);
    setDepartments(departmentsResponse.data.departments);
    setClasses(classesResponse.data.classes);
    setEnrollments(enrollmentResponse.data.enrollments);
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
