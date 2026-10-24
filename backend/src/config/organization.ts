export const ORGANIZATION_TYPES = ['business', 'school', 'college', 'university'] as const;
export const ACADEMIC_ORGANIZATION_TYPES = ['school', 'college', 'university'] as const;
export const ACCOUNT_TYPES = ['company', 'individual'] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export type AcademicOrganizationType = (typeof ACADEMIC_ORGANIZATION_TYPES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const BUSINESS_ROLES = ['owner', 'founder', 'admin', 'manager', 'employee', 'guest'] as const;
export const EDUCATION_OWNER_ROLES = ['owner', 'founder'] as const;
export const EDUCATION_ADMIN_ROLES = ['owner', 'founder', 'principal', 'director', 'admin', 'office_staff', 'dean', 'hod'] as const;
export const EDUCATION_TEACHER_ROLES = ['teacher', 'faculty'] as const;
export const EDUCATION_STUDENT_ROLES = ['student'] as const;
export const EDUCATION_PARENT_ROLES = ['parent', 'guardian'] as const;
export const EDUCATION_ROLES = [
  ...EDUCATION_OWNER_ROLES,
  ...EDUCATION_ADMIN_ROLES,
  ...EDUCATION_TEACHER_ROLES,
  ...EDUCATION_STUDENT_ROLES,
  ...EDUCATION_PARENT_ROLES,
] as const;

export const ROLE_ALIASES: Record<string, string> = {
  founder: 'owner',
  director: 'principal',
  principal: 'principal',
  faculty: 'teacher',
  teacher: 'teacher',
  office_staff: 'admin',
  office_staff_member: 'admin',
  office: 'admin',
  staff: 'admin',
  guardian: 'parent',
  parent: 'parent',
  dean: 'dean',
  hod: 'hod',
  head_of_department: 'hod',
  head_of_dept: 'hod',
  department_head: 'hod',
  head: 'hod',
  vice_chancellor: 'vice_chancellor',
  vc: 'vice_chancellor',
  professor: 'professor',
  lecturer: 'lecturer',
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  employee: 'employee',
  guest: 'guest',
  student: 'student',
};

/**
 * Institution titles that carry the permissions of an existing role. A Vice
 * Chancellor heads a university the way a principal heads a school; professors
 * and lecturers teach with a teacher's access. Permission checks use the base
 * role, while the stored and displayed role keeps the title.
 */
export const ROLE_PERMISSION_BASE: Readonly<Record<string, string>> = {
  vice_chancellor: 'principal',
  professor: 'teacher',
  lecturer: 'teacher',
};

export type WorkspaceRoleCatalog = {
  /** Roles a workspace owner can give members, in display order. The owner role is never assignable. */
  assignable: readonly string[];
  /** Assignable roles that administer the workspace or a department; only the owner assigns them. */
  elevated: readonly string[];
  /**
   * Roles earlier releases stored for this workspace type. Existing members keep
   * their access, but these roles are never offered or newly assigned.
   */
  legacy: readonly string[];
  /** Roles a workspace may give people who join with its invite code (never elevated). */
  joinRoles: readonly string[];
  defaultJoinRole: string;
};

// Business titles that education workspaces could hold before roles were
// separated by workspace type.
const EDUCATION_LEGACY_ROLES = ['manager', 'employee', 'guest'] as const;

/** The single definition of which roles each workspace type supports. */
export const WORKSPACE_ROLE_CATALOG: Readonly<Record<OrganizationType, WorkspaceRoleCatalog>> = {
  business: {
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
    // Universities used the school title "principal" before Vice Chancellor existed.
    legacy: ['principal', ...EDUCATION_LEGACY_ROLES],
    joinRoles: ['student', 'parent'],
    defaultJoinRole: 'student',
  },
};

/** A Solo workspace has its owner and nobody else. */
const SOLO_ROLE_CATALOG: WorkspaceRoleCatalog = {
  assignable: [],
  elevated: [],
  legacy: [],
  joinRoles: [],
  defaultJoinRole: '',
};

function keyForRole(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function canonicalRole(role: unknown): string {
  if (typeof role !== 'string') return '';
  const key = keyForRole(role);
  return ROLE_ALIASES[key] ?? key;
}

/** The role whose permissions a stored (or aliased) role carries. */
export function permissionRole(role: unknown): string {
  const canonical = canonicalRole(role);
  return ROLE_PERMISSION_BASE[canonical] ?? canonical;
}

export function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === 'string' &&
    ORGANIZATION_TYPES.includes(value as OrganizationType);
}

/**
 * Normalizes a stored organization type (casing/whitespace from legacy records).
 * A missing value resolves to the schema default `business`; an unrecognized
 * value returns undefined so billing can refuse it instead of guessing.
 */
export function normalizeOrganizationType(value: unknown): OrganizationType | undefined {
  if (value === undefined || value === null || value === '') return 'business';
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'business';
  return isOrganizationType(normalized) ? normalized : undefined;
}

/** Account type with the schema default (`company`) for records saved before the field existed. */
export function normalizeAccountType(value: unknown): AccountType | undefined {
  if (value === undefined || value === null || value === '') return 'company';
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'company';
  return (ACCOUNT_TYPES as readonly string[]).includes(normalized) ? normalized as AccountType : undefined;
}

/**
 * The workspace classification every authorization check should use. Lean
 * reads skip Mongoose schema defaults, so legacy workspaces missing these
 * fields must resolve exactly as the hydrated document (and /auth/me) does;
 * unrecognized values stay undefined so feature checks fail closed.
 */
export function resolveWorkspaceClassification(
  organizationType: unknown,
  accountType: unknown,
): { organizationType?: OrganizationType; accountType?: AccountType } {
  return {
    organizationType: normalizeOrganizationType(organizationType),
    accountType: normalizeAccountType(accountType),
  };
}

export function isAcademicOrganizationType(value: unknown): value is AcademicOrganizationType {
  return typeof value === 'string' &&
    ACADEMIC_ORGANIZATION_TYPES.includes(value as AcademicOrganizationType);
}

/**
 * Role definitions for a workspace. Unknown classifications get no roles, so
 * every check that consults them fails closed.
 */
export function getWorkspaceRoleCatalog(
  organizationType: OrganizationType | string | null | undefined,
  accountType?: AccountType | string | null,
): WorkspaceRoleCatalog {
  const type = normalizeOrganizationType(organizationType);
  if (!type) return SOLO_ROLE_CATALOG;
  if (normalizeAccountType(accountType) === 'individual') return SOLO_ROLE_CATALOG;
  return WORKSPACE_ROLE_CATALOG[type];
}

/**
 * Whether a member holding this role belongs to the workspace type: the owner,
 * any assignable role, and roles earlier releases stored (so existing members
 * keep working until an administrator updates them).
 */
export function isOrganizationRoleEligible(role: unknown, organizationType: OrganizationType | string | null | undefined): boolean {
  if (typeof role !== 'string') return false;
  if (organizationType && !isOrganizationType(organizationType)) return false;
  const canonical = canonicalRole(role);
  if (canonical === 'owner') return true;
  const catalog = WORKSPACE_ROLE_CATALOG[(organizationType || 'business') as OrganizationType];
  return catalog.assignable.includes(canonical) || catalog.legacy.includes(canonical);
}

/** Whether the role may be newly given to a member of this workspace type. */
export function isOrganizationRoleAssignable(role: unknown, organizationType: OrganizationType | string | null | undefined): boolean {
  if (typeof role !== 'string') return false;
  if (organizationType && !isOrganizationType(organizationType)) return false;
  return WORKSPACE_ROLE_CATALOG[(organizationType || 'business') as OrganizationType].assignable.includes(canonicalRole(role));
}

export function normalizeOrganizationRole(role: unknown, organizationType: OrganizationType | string | null | undefined, fallback = 'employee'): string {
  if (typeof role !== 'string' || !isOrganizationRoleEligible(role, organizationType)) return fallback;
  return canonicalRole(role);
}

export function isOrganizationRoleAllowed(role: unknown, organizationType: OrganizationType | string | null | undefined): boolean {
  return isOrganizationRoleEligible(role, organizationType);
}

/** Every role a member of this workspace type may hold, including the owner and legacy roles. */
export function getAllowedRolesByOrganizationType(organizationType: OrganizationType | string | null | undefined): string[] {
  const type = normalizeOrganizationType(organizationType);
  if (!type) return [];
  const catalog = WORKSPACE_ROLE_CATALOG[type];
  return ['owner', ...catalog.assignable, ...catalog.legacy];
}

/**
 * The invite-code role: the workspace's saved default when it is one the
 * workspace type allows for open joining, otherwise the type's default. Legacy
 * education workspaces saved "employee" as their default; they get "student".
 */
export function resolveDefaultJoinRole(
  organizationType: OrganizationType | string | null | undefined,
  savedDefaultRole: unknown,
  accountType?: AccountType | string | null,
): string {
  const catalog = getWorkspaceRoleCatalog(organizationType, accountType);
  const saved = canonicalRole(savedDefaultRole);
  return catalog.joinRoles.includes(saved) ? saved : catalog.defaultJoinRole;
}

export function isAcademicRole(role: unknown): boolean {
  return (EDUCATION_ROLES as readonly string[]).includes(permissionRole(role));
}

export function roleMatches(role: unknown, requestedRoles: readonly string[], organizationType?: OrganizationType | string): boolean {
  if (typeof role !== 'string') return false;
  if (organizationType && !isOrganizationRoleEligible(role, organizationType)) return false;
  const normalized = canonicalRole(role);
  const base = permissionRole(normalized);
  const requested = new Set(requestedRoles.flatMap((requestedRole) => {
    const requestedKey = keyForRole(requestedRole);
    return [requestedKey, ROLE_ALIASES[requestedKey] ?? requestedKey];
  }));

  if (requested.has(normalized) || requested.has(base)) return true;

  if (requested.has('admin') || requested.has('manager')) {
    if (isAcademicOrganizationType(organizationType)) {
      return (EDUCATION_ADMIN_ROLES as readonly string[]).includes(base) ||
        (base === 'manager' && requested.has('manager'));
    }
    return base === 'admin' || base === 'manager';
  }
  return false;
}

/**
 * Roles that administer the workspace itself: its settings, invite credentials,
 * member role/status changes, removals and the audit trail. Unlike roleMatches,
 * "admin" is not widened to managers or (in universities) deans and HoDs, who
 * keep their member-directory and academic-department powers only.
 */
export function isWorkspaceAdministrator(role: unknown, organizationType: unknown): boolean {
  if (typeof role !== 'string') return false;
  const type = normalizeOrganizationType(organizationType);
  if (!type || !isOrganizationRoleEligible(role, type)) return false;
  const base = permissionRole(role);
  return isAcademicOrganizationType(type)
    ? ['owner', 'principal', 'admin'].includes(base)
    : ['owner', 'admin'].includes(base);
}

/** Whether the target role administers the workspace or a department (owner-only to assign). */
export function isElevatedOrganizationRole(role: unknown, organizationType: OrganizationType | string): boolean {
  const canonical = canonicalRole(role);
  if (canonical === 'owner') return true;
  const type = normalizeOrganizationType(organizationType);
  return Boolean(type && WORKSPACE_ROLE_CATALOG[type].elevated.includes(canonical));
}

export function canAssignOrganizationRole(
  actorRole: unknown,
  targetRole: unknown,
  organizationType: OrganizationType | string,
  actorOwnsOrganization: boolean,
): boolean {
  if (!isOrganizationRoleAssignable(targetRole, organizationType)) return false;
  const normalizedTarget = canonicalRole(targetRole);
  if (!normalizedTarget || normalizedTarget === 'owner') return false;
  if (actorOwnsOrganization) return true;
  if (isElevatedOrganizationRole(normalizedTarget, organizationType)) return false;

  if (roleMatches(actorRole, ['admin'], organizationType)) return true;
  return roleMatches(actorRole, ['manager'], organizationType) &&
    ['employee', 'guest'].includes(normalizedTarget);
}

/** The roles this actor may give members, in display order. */
export function getAssignableOrganizationRoles(
  actorRole: unknown,
  organizationType: OrganizationType | string | null | undefined,
  accountType: AccountType | string | null | undefined,
  actorOwnsOrganization: boolean,
): string[] {
  const type = normalizeOrganizationType(organizationType);
  if (!type) return [];
  return getWorkspaceRoleCatalog(type, accountType).assignable
    .filter((role) => canAssignOrganizationRole(actorRole, role, type, actorOwnsOrganization));
}
