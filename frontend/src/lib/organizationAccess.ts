import type { OrganizationType, UserRole } from '@/types';

export type OrganizationInfo = {
  organizationType?: OrganizationType;
  accountType?: 'company' | 'individual';
};

export type OrganizationFeature =
  | 'academic'
  | 'academicAdmin'
  | 'businessCrm'
  | 'clientPortal'
  | 'businessAnalytics'
  | 'businessAutomation'
  | 'billingAdmin'
  | 'memberDirectory'
  | 'workspaceContent';

const roleAliases: Record<string, string> = {
  founder: 'owner',
  director: 'principal',
  office_staff: 'admin',
  'office staff': 'admin',
  faculty: 'teacher',
  guardian: 'parent',
  head_of_department: 'hod',
  'head of department': 'hod',
};

function canonicalRole(role: UserRole | string | undefined): string {
  const key = (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return roleAliases[key] ?? key;
}

export function isEducationOrganization(organization: OrganizationInfo | null | undefined): boolean {
  return !!organization?.organizationType &&
    ['school', 'college', 'university'].includes(organization.organizationType);
}

export function canAccessOrganizationFeature(
  organization: OrganizationInfo | null | undefined,
  role: UserRole | string | undefined,
  feature: OrganizationFeature,
): boolean {
  const roleKey = canonicalRole(role);
  const organizationType = organization?.organizationType ?? 'business';
  const academic = isEducationOrganization(organization);
  const universityRole = organizationType === 'university' && ['dean', 'hod'].includes(roleKey);
  const eligible = academic
    ? ['owner', 'principal', 'admin', 'teacher', 'student', 'parent', 'manager', 'employee', 'guest'].includes(roleKey) || universityRole
    : ['owner', 'admin', 'manager', 'employee', 'guest'].includes(roleKey);
  if (!eligible) return false;

  switch (feature) {
    case 'academic':
      return academic;
    case 'academicAdmin':
      return academic && ['owner', 'principal', 'admin'].includes(roleKey) || universityRole;
    case 'businessCrm':
    case 'clientPortal':
      return !academic &&
        organization?.accountType !== 'individual' &&
        ['owner', 'admin', 'manager'].includes(roleKey);
    case 'businessAnalytics':
    case 'businessAutomation':
      return !academic && ['owner', 'admin', 'manager'].includes(roleKey);
    case 'billingAdmin':
      return academic ? roleKey === 'owner' : ['owner', 'admin'].includes(roleKey);
    case 'memberDirectory':
      return academic
        ? ['owner', 'principal', 'admin'].includes(roleKey) || universityRole
        : ['owner', 'admin', 'manager'].includes(roleKey);
    case 'workspaceContent':
      return !academic || !['student', 'parent'].includes(roleKey);
  }
}

export function getRouteOrganizationFeature(pathname: string): OrganizationFeature | null {
  const routeRules: Array<[string, OrganizationFeature]> = [
    ['/academic', 'academic'],
    ['/crm', 'businessCrm'],
    ['/client-portal-mgmt', 'clientPortal'],
    ['/billing', 'billingAdmin'],
    ['/team', 'memberDirectory'],
    ['/analytics', 'businessAnalytics'],
    ['/workflows', 'businessAutomation'],
    ['/ai', 'workspaceContent'],
    ['/daily-focus', 'workspaceContent'],
    ['/tasks', 'workspaceContent'],
    ['/projects', 'workspaceContent'],
    ['/whiteboard', 'workspaceContent'],
    ['/files', 'workspaceContent'],
    ['/docs', 'workspaceContent'],
    ['/sheets', 'workspaceContent'],
  ];
  return routeRules.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? null;
}

export function canAccessAcademicSection(
  role: UserRole | string | undefined,
  section: string,
  organizationType?: OrganizationType,
): boolean {
  const roleKey = canonicalRole(role);
  if (!['school', 'college', 'university'].includes(organizationType ?? '')) return false;
  if (['owner', 'principal', 'admin'].includes(roleKey) ||
      (organizationType === 'university' && ['dean', 'hod'].includes(roleKey))) return true;
  if (roleKey === 'teacher') {
    return ['overview', 'students', 'timetable', 'assignments', 'attendance', 'exams', 'results'].includes(section);
  }
  if (roleKey === 'student') {
    return ['overview', 'timetable', 'assignments', 'attendance', 'exams', 'results'].includes(section);
  }
  if (roleKey === 'parent') {
    return ['overview', 'timetable', 'attendance', 'results', 'fees'].includes(section);
  }
  return false;
}
