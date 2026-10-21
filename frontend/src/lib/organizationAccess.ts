import type { OrganizationType, UserRole } from '@/types';

export type OrganizationInfo = {
  organizationType?: OrganizationType;
  accountType?: 'company' | 'individual';
};

export type OrganizationFeature =
  | 'soloWorkspace'
  | 'companyWorkspace'
  | 'academic'
  | 'academicAdmin'
  | 'educationCommunication'
  | 'educationMeetings'
  | 'educationFiles'
  | 'educationAi'
  | 'businessCrm'
  | 'clientPortal'
  | 'businessAnalytics'
  | 'businessAutomation'
  | 'socialPublishing'
  | 'billingAdmin'
  | 'memberDirectory'
  | 'workspaceSettings';

type Experience = 'solo' | 'company' | 'school' | 'college' | 'university';

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

const BUSINESS_ROLES = new Set(['owner', 'admin', 'manager', 'employee', 'guest']);
const EDUCATION_ROLES = new Set([
  'owner', 'principal', 'admin', 'teacher', 'student', 'parent', 'manager', 'employee', 'guest', 'dean', 'hod',
]);
const INSTITUTION_ADMINS = new Set(['owner', 'principal', 'admin', 'dean', 'hod']);
const DEPARTMENT_ROLES = new Set(['dean', 'hod']);
const EDUCATION_TYPES = new Set<OrganizationType>(['school', 'college', 'university']);

const FEATURE_POLICIES: Record<OrganizationFeature, (experience: Experience, role: string) => boolean> = {
  soloWorkspace: (experience, role) => experience === 'solo' && role === 'owner',
  companyWorkspace: (experience, role) => experience === 'company' && BUSINESS_ROLES.has(role),
  academic: (experience, role) => experience !== 'solo' && experience !== 'company' && EDUCATION_ROLES.has(role),
  academicAdmin: (experience, role) =>
    experience !== 'solo' && experience !== 'company' &&
    (INSTITUTION_ADMINS.has(role) || (experience === 'university' && DEPARTMENT_ROLES.has(role))),
  educationCommunication: (experience, role) =>
    experience !== 'solo' && experience !== 'company' && EDUCATION_ROLES.has(role) && role !== 'guest',
  educationMeetings: (experience, role) =>
    experience !== 'solo' && experience !== 'company' && EDUCATION_ROLES.has(role) && role !== 'guest',
  educationFiles: (experience, role) =>
    experience !== 'solo' && experience !== 'company' && EDUCATION_ROLES.has(role) && role !== 'guest',
  educationAi: (experience, role) =>
    experience !== 'solo' && experience !== 'company' && EDUCATION_ROLES.has(role) && role !== 'guest',
  businessCrm: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  clientPortal: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  businessAnalytics: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  businessAutomation: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  socialPublishing: (experience, role) =>
    experience === 'solo' ? role === 'owner' :
      experience === 'company'
        ? ['owner', 'admin', 'manager', 'employee'].includes(role)
        : ['owner', 'principal', 'admin', 'teacher', 'dean', 'hod'].includes(role),
  billingAdmin: (experience, role) =>
    experience === 'solo' ? role === 'owner' :
      experience === 'company' ? ['owner', 'admin'].includes(role) : role === 'owner',
  memberDirectory: (experience, role) =>
    experience === 'company' ? ['owner', 'admin', 'manager'].includes(role) :
      experience !== 'solo' && INSTITUTION_ADMINS.has(role),
  workspaceSettings: (experience, role) =>
    experience === 'solo' ? role === 'owner' :
      experience === 'company' ? ['owner', 'admin'].includes(role) :
        INSTITUTION_ADMINS.has(role),
};

function canonicalRole(role: UserRole | string | undefined): string {
  const key = (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return roleAliases[key] ?? key;
}

const ORGANIZATION_TYPES = new Set<OrganizationType>(['business', 'school', 'college', 'university']);

/**
 * Normalizes a stored organization type (casing/whitespace from legacy records).
 * Missing resolves to `business` (the backend default); unrecognized returns null.
 */
export function normalizeOrganizationType(value: unknown): OrganizationType | null {
  if (value === undefined || value === null || value === '') return 'business';
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'business';
  return ORGANIZATION_TYPES.has(normalized as OrganizationType) ? normalized as OrganizationType : null;
}

export function getEducationPlanType(value: unknown): 'school' | 'college' | 'university' | null {
  const normalized = normalizeOrganizationType(value);
  return normalized && normalized !== 'business' ? normalized : null;
}

export function getWorkspaceExperience(
  organization: OrganizationInfo | null | undefined,
): Experience | null {
  if (!organization) return null;
  if (organization.accountType === 'individual' && organization.organizationType === 'business') return 'solo';
  if (organization.accountType !== 'company') return null;
  if (organization.organizationType === 'business') return 'company';
  if (organization.organizationType && EDUCATION_TYPES.has(organization.organizationType)) {
    return organization.organizationType;
  }
  return null;
}

export function isEducationOrganization(organization: OrganizationInfo | null | undefined): boolean {
  const experience = getWorkspaceExperience(organization);
  return experience === 'school' || experience === 'college' || experience === 'university';
}

export function canAccessOrganizationFeature(
  organization: OrganizationInfo | null | undefined,
  role: UserRole | string | undefined,
  feature: OrganizationFeature,
): boolean {
  const experience = getWorkspaceExperience(organization);
  if (!experience) return false;
  return FEATURE_POLICIES[feature](experience, canonicalRole(role));
}

export function getRouteOrganizationFeature(pathname: string): OrganizationFeature | null {
  const routeRules: Array<[string, OrganizationFeature]> = [
    ['/academic', 'academic'],
    ['/crm', 'businessCrm'],
    ['/client-portal-mgmt', 'clientPortal'],
    ['/client-portal', 'clientPortal'],
    ['/billing', 'billingAdmin'],
    ['/team', 'memberDirectory'],
    ['/analytics', 'businessAnalytics'],
    ['/workflows', 'businessAutomation'],
    ['/social-publishing', 'socialPublishing'],
    ['/calendar', 'educationMeetings'],
    ['/chat', 'educationCommunication'],
    ['/calling', 'companyWorkspace'],
    ['/meetings', 'educationMeetings'],
    ['/moderation', 'companyWorkspace'],
    ['/notifications', 'workspaceSettings'],
    ['/settings', 'workspaceSettings'],
    ['/daily-focus', 'soloWorkspace'],
    ['/tasks', 'companyWorkspace'],
    ['/projects', 'companyWorkspace'],
    ['/whiteboard', 'companyWorkspace'],
    ['/files', 'educationFiles'],
    ['/docs', 'soloWorkspace'],
    ['/sheets', 'companyWorkspace'],
    ['/ai', 'educationAi'],
    ['/developer', 'companyWorkspace'],
  ];
  const match = routeRules.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!match) return null;

  const [, feature] = match;
  if (feature === 'educationMeetings') return feature;
  return feature;
}

export function canAccessRoute(
  organization: OrganizationInfo | null | undefined,
  role: UserRole | string | undefined,
  pathname: string,
  section?: string | null,
): boolean {
  const experience = getWorkspaceExperience(organization);
  if (!experience) return false;
  if (pathname === '/dashboard') return experience === 'solo' || experience === 'company';
  if (pathname === '/settings' || pathname === '/notifications') return true;
  if (pathname === '/academic') {
    return canAccessOrganizationFeature(organization, role, 'academic') &&
      canAccessAcademicSection(role, section || 'overview', organization?.organizationType);
  }
  const feature = getRouteOrganizationFeature(pathname);
  if (!feature) return false;

  if (pathname === '/calendar') {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'educationMeetings');
  }
  if (pathname === '/ai') {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'educationAi');
  }
  if (pathname === '/files') {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'educationFiles');
  }
  if (pathname === '/docs') {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace');
  }
  if (pathname === '/tasks' || pathname.startsWith('/tasks/')) {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace');
  }
  if (pathname === '/projects' || pathname.startsWith('/projects/')) {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace');
  }
  if (pathname === '/chat') {
    return canAccessOrganizationFeature(organization, role, 'companyWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'educationCommunication');
  }
  if (pathname === '/meetings') {
    return canAccessOrganizationFeature(organization, role, 'companyWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'educationMeetings');
  }
  if (feature === 'soloWorkspace') return canAccessOrganizationFeature(organization, role, feature);
  if (feature === 'companyWorkspace') return canAccessOrganizationFeature(organization, role, feature);
  if (experience === 'school' || experience === 'college' || experience === 'university') {
    if (feature === 'educationFiles' || feature === 'educationAi') {
      return canAccessOrganizationFeature(organization, role, feature);
    }
  }
  return canAccessOrganizationFeature(organization, role, feature);
}

export function getWorkspaceHome(organization: OrganizationInfo | null | undefined): string {
  const experience = getWorkspaceExperience(organization);
  if (!experience) return '/create-company';
  return experience === 'school' || experience === 'college' || experience === 'university'
    ? '/academic'
    : '/dashboard';
}

export function canAccessAcademicSection(
  role: UserRole | string | undefined,
  section: string,
  organizationType?: OrganizationType,
): boolean {
  const roleKey = canonicalRole(role);
  if (!organizationType || !EDUCATION_TYPES.has(organizationType)) return false;
  if (INSTITUTION_ADMINS.has(roleKey) ||
      (organizationType === 'university' && DEPARTMENT_ROLES.has(roleKey))) return true;
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
