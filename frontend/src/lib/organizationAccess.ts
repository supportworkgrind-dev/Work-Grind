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

export type WorkspaceExperience = 'solo' | 'company' | 'school' | 'college' | 'university';
type Experience = WorkspaceExperience;

const roleAliases: Record<string, string> = {
  founder: 'owner',
  director: 'principal',
  office_staff: 'admin',
  office_staff_member: 'admin',
  office: 'admin',
  staff: 'admin',
  faculty: 'teacher',
  guardian: 'parent',
  head_of_department: 'hod',
  head_of_dept: 'hod',
  department_head: 'hod',
  head: 'hod',
  vc: 'vice_chancellor',
};

/**
 * Institution titles that carry an existing role's permissions (mirrors the
 * backend ROLE_PERMISSION_BASE): access checks use the base role.
 */
const ROLE_PERMISSION_BASE: Record<string, string> = {
  vice_chancellor: 'principal',
  professor: 'teacher',
  lecturer: 'teacher',
};

export type WorkspaceRoleCatalog = {
  /** Roles the owner can give members, in display order (owner is never assignable). */
  assignable: readonly string[];
  /** Assignable roles only the owner may give. */
  elevated: readonly string[];
  /** Roles earlier releases stored; existing members keep access, never offered. */
  legacy: readonly string[];
  /** Roles a workspace may give people joining with its invite code. */
  joinRoles: readonly string[];
  defaultJoinRole: string;
};

const EDUCATION_LEGACY_ROLES = ['manager', 'employee', 'guest'] as const;

/**
 * Roles each workspace type supports. Mirrors the backend WORKSPACE_ROLE_CATALOG
 * (backend/src/config/organization.ts); a backend test keeps the two equal.
 */
export const WORKSPACE_ROLE_CATALOG: Record<Exclude<Experience, 'solo'>, WorkspaceRoleCatalog> = {
  company: {
    assignable: ['admin', 'manager', 'employee', 'guest'],
    elevated: ['admin', 'manager'],
    legacy: [],
    joinRoles: ['employee', 'guest'],
    defaultJoinRole: 'employee',
  },
  school: {
    assignable: ['principal', 'admin', 'teacher', 'student', 'parent'],
    elevated: ['principal', 'admin'],
    legacy: EDUCATION_LEGACY_ROLES,
    joinRoles: ['student', 'parent'],
    defaultJoinRole: 'student',
  },
  college: {
    assignable: ['principal', 'admin', 'hod', 'lecturer', 'teacher', 'student', 'parent'],
    elevated: ['principal', 'admin', 'hod'],
    legacy: EDUCATION_LEGACY_ROLES,
    joinRoles: ['student', 'parent'],
    defaultJoinRole: 'student',
  },
  university: {
    assignable: ['vice_chancellor', 'admin', 'dean', 'hod', 'professor', 'lecturer', 'teacher', 'student', 'parent'],
    elevated: ['vice_chancellor', 'admin', 'dean', 'hod'],
    legacy: ['principal', ...EDUCATION_LEGACY_ROLES],
    joinRoles: ['student', 'parent'],
    defaultJoinRole: 'student',
  },
};

const SOLO_ROLE_CATALOG: WorkspaceRoleCatalog = {
  assignable: [], elevated: [], legacy: [], joinRoles: [], defaultJoinRole: '',
};

function catalogFor(experience: Experience | null): WorkspaceRoleCatalog {
  return !experience || experience === 'solo' ? SOLO_ROLE_CATALOG : WORKSPACE_ROLE_CATALOG[experience];
}

/** Whether a member of this workspace kind may hold the (canonical) role, legacy roles included. */
function isRoleEligible(experience: Experience, role: string): boolean {
  if (role === 'owner') return true;
  const catalog = catalogFor(experience);
  return catalog.assignable.includes(role) || catalog.legacy.includes(role);
}

const INSTITUTION_ADMINS = new Set(['owner', 'principal', 'admin', 'dean', 'hod']);
const WORKSPACE_ADMINS_EDUCATION = new Set(['owner', 'principal', 'admin']);
const EDUCATION_TYPES = new Set<OrganizationType>(['school', 'college', 'university']);

const isEducationExperience = (experience: Experience) =>
  experience === 'school' || experience === 'college' || experience === 'university';

// Each policy receives the role's permission base (a lecturer is checked as a
// teacher); eligibility for the workspace kind is checked before it is called.
const FEATURE_POLICIES: Record<OrganizationFeature, (experience: Experience, role: string) => boolean> = {
  soloWorkspace: (experience, role) => experience === 'solo' && role === 'owner',
  companyWorkspace: (experience) => experience === 'company',
  academic: (experience) => isEducationExperience(experience),
  academicAdmin: (experience, role) => isEducationExperience(experience) && INSTITUTION_ADMINS.has(role),
  educationCommunication: (experience, role) => isEducationExperience(experience) && role !== 'guest',
  educationMeetings: (experience, role) => isEducationExperience(experience) && role !== 'guest',
  educationFiles: (experience, role) => isEducationExperience(experience) && role !== 'guest',
  educationAi: (experience, role) => isEducationExperience(experience) && role !== 'guest',
  businessCrm: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  clientPortal: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  businessAnalytics: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  businessAutomation: (experience, role) => experience === 'company' && ['owner', 'admin', 'manager'].includes(role),
  // Business team and Solo workspaces only (mirrors the backend policy).
  socialPublishing: (experience, role) =>
    experience === 'solo' ? role === 'owner' :
      experience === 'company' && ['owner', 'admin', 'manager', 'employee'].includes(role),
  billingAdmin: (experience, role) =>
    experience === 'solo' ? role === 'owner' :
      experience === 'company' ? ['owner', 'admin'].includes(role) : role === 'owner',
  memberDirectory: (experience, role) =>
    experience === 'company' ? ['owner', 'admin', 'manager'].includes(role) :
      experience !== 'solo' && INSTITUTION_ADMINS.has(role),
  // Mirrors the backend's isWorkspaceAdministrator: deans and HoDs administer
  // their departments, not the workspace itself.
  workspaceSettings: (experience, role) =>
    experience === 'solo' ? role === 'owner' :
      experience === 'company' ? ['owner', 'admin'].includes(role) :
        WORKSPACE_ADMINS_EDUCATION.has(role),
};

/** The stored role in canonical form (aliases resolved), e.g. "founder" → "owner". */
export function canonicalRole(role: UserRole | string | undefined): string {
  const key = (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return roleAliases[key] ?? key;
}

/** The role whose permissions this role carries, e.g. "lecturer" → "teacher". */
export function permissionRole(role: UserRole | string | undefined): string {
  const canonical = canonicalRole(role);
  return ROLE_PERMISSION_BASE[canonical] ?? canonical;
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
  // Same defaults as the backend (resolveWorkspaceClassification) for workspaces
  // saved before these fields existed: a missing organization type is business
  // and a missing account type is a team (company) workspace. Unknown values
  // still resolve to no workspace experience.
  const organizationType = normalizeOrganizationType(organization.organizationType);
  const accountType = organization.accountType ?? 'company';
  if (accountType === 'individual' && organizationType === 'business') return 'solo';
  if (accountType !== 'company') return null;
  if (organizationType === 'business') return 'company';
  if (organizationType && EDUCATION_TYPES.has(organizationType)) {
    return organizationType;
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
  const canonical = canonicalRole(role);
  if (experience !== 'solo' && !isRoleEligible(experience, canonical)) return false;
  return FEATURE_POLICIES[feature](experience, permissionRole(canonical));
}

/** The role definitions for the signed-in member's workspace. */
export function getWorkspaceRoleCatalog(organization: OrganizationInfo | null | undefined): WorkspaceRoleCatalog {
  return catalogFor(getWorkspaceExperience(organization));
}

/**
 * Roles the actor may assign when inviting or changing a member, matching the
 * backend's canAssignOrganizationRole: the workspace owner may assign any
 * role the workspace type offers; administrators only non-elevated ones; a
 * business manager only employees and guests.
 */
export function getAssignableRoles(
  organization: OrganizationInfo | null | undefined,
  role: UserRole | string | undefined,
  ownsWorkspace: boolean,
): string[] {
  const experience = getWorkspaceExperience(organization);
  if (!experience || experience === 'solo') return [];
  if (!canAccessOrganizationFeature(organization, role, 'memberDirectory')) return [];
  const catalog = catalogFor(experience);
  if (ownsWorkspace) return [...catalog.assignable];
  const base = permissionRole(role);
  const actsAsAdmin = isEducationExperience(experience) ? INSTITUTION_ADMINS.has(base) : base === 'admin' || base === 'manager';
  return catalog.assignable.filter((target) => {
    if (catalog.elevated.includes(target)) return false;
    if (actsAsAdmin) return true;
    return base === 'manager' && ['employee', 'guest'].includes(target);
  });
}

/** Whether the role is one this workspace type offers (legacy titles are not). */
export function isAssignableWorkspaceRole(organization: OrganizationInfo | null | undefined, role: string | undefined): boolean {
  return getWorkspaceRoleCatalog(organization).assignable.includes(canonicalRole(role));
}

/** The invite-code role: the saved default when the workspace type allows it, else the type's default. */
export function resolveDefaultJoinRole(organization: OrganizationInfo | null | undefined, savedDefaultRole: string | undefined): string {
  const catalog = getWorkspaceRoleCatalog(organization);
  const saved = canonicalRole(savedDefaultRole);
  return catalog.joinRoles.includes(saved) ? saved : catalog.defaultJoinRole;
}

/**
 * Message key for a role's title in this workspace type: "admin" reads
 * "School Admin" in a school, and "hod" reads "Department Head" in a college.
 * Keys live under common.roles / common.roleTitles.<type>.
 */
export function roleLabelKey(role: UserRole | string | undefined, organization: OrganizationInfo | null | undefined): string {
  const canonical = canonicalRole(role);
  const experience = getWorkspaceExperience(organization);
  const specific: Partial<Record<Experience, readonly string[]>> = {
    school: ['admin'],
    college: ['admin', 'hod', 'teacher'],
    university: ['admin'],
  };
  if (experience && specific[experience]?.includes(canonical)) return `common.roleTitles.${experience}.${canonical}`;
  return `common.roles.${canonical}`;
}

export function isWorkspaceOwnerRole(role: UserRole | string | undefined): boolean {
  return canonicalRole(role) === 'owner';
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

  // The Daily Focus API serves team and Solo workspaces (dashboard card and page).
  if (pathname === '/daily-focus') {
    return canAccessOrganizationFeature(organization, role, 'soloWorkspace') ||
      canAccessOrganizationFeature(organization, role, 'companyWorkspace');
  }
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
  const roleKey = permissionRole(role);
  if (!organizationType || !EDUCATION_TYPES.has(organizationType)) return false;
  if (!isRoleEligible(organizationType as 'school' | 'college' | 'university', canonicalRole(role))) return false;
  if (INSTITUTION_ADMINS.has(roleKey)) return true;
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

/**
 * Whether the member administers the workspace or a department, so only the
 * owner may change or suspend them (mirrors the backend's member checks).
 */
export function isElevatedWorkspaceRole(role: UserRole | string | undefined): boolean {
  return ['owner', 'admin', 'manager', 'principal', 'dean', 'hod'].includes(permissionRole(role));
}

/**
 * Members who manage shared workspace spaces such as chat channels: business
 * owners, admins and managers; institution administrators, deans and heads of
 * department (mirrors the backend's requireRole('owner', 'admin', 'manager')).
 */
export function isWorkspaceManagerRole(
  organization: OrganizationInfo | null | undefined,
  role: UserRole | string | undefined,
): boolean {
  const experience = getWorkspaceExperience(organization);
  if (!experience) return false;
  const canonical = canonicalRole(role);
  if (experience !== 'solo' && !isRoleEligible(experience, canonical)) return false;
  const base = permissionRole(canonical);
  if (isEducationExperience(experience)) return INSTITUTION_ADMINS.has(base) || base === 'manager';
  return ['owner', 'admin', 'manager'].includes(base);
}
