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
  'manager',
  'employee',
  'guest',
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
  head: 'hod',
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  employee: 'employee',
  guest: 'guest',
  student: 'student',
};

const EDUCATION_COMMON_ROLES = ['owner', 'principal', 'admin', 'teacher', 'student', 'parent', 'manager', 'employee', 'guest'] as const;
const UNIVERSITY_ROLES = [...EDUCATION_COMMON_ROLES, 'dean', 'hod'] as const;

function keyForRole(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === 'string' &&
    ORGANIZATION_TYPES.includes(value as OrganizationType);
}

export function isAcademicOrganizationType(value: unknown): value is AcademicOrganizationType {
  return typeof value === 'string' &&
    ACADEMIC_ORGANIZATION_TYPES.includes(value as AcademicOrganizationType);
}

export function isOrganizationRoleEligible(role: unknown, organizationType: OrganizationType | string | null | undefined): boolean {
  if (typeof role !== 'string') return false;

  const normalized = keyForRole(role);
  const canonical = ROLE_ALIASES[normalized] ?? normalized;
  if (isAcademicOrganizationType(organizationType)) {
    const allowed = organizationType === 'university' ? UNIVERSITY_ROLES : EDUCATION_COMMON_ROLES;
    return (allowed as readonly string[]).includes(canonical);
  }
  if (organizationType === 'business' || !organizationType) {
    return (BUSINESS_ROLES as readonly string[]).includes(canonical);
  }
  return false;
}

export function normalizeOrganizationRole(role: unknown, organizationType: OrganizationType | string | null | undefined, fallback = 'employee'): string {
  if (!isOrganizationRoleEligible(role, organizationType)) return fallback;

  const normalized = keyForRole(role);
  return ROLE_ALIASES[normalized] ?? normalized;
}

export function isOrganizationRoleAllowed(role: unknown, organizationType: OrganizationType | string | null | undefined): boolean {
  return isOrganizationRoleEligible(role, organizationType);
}

export function getAllowedRolesByOrganizationType(organizationType: OrganizationType | string | null | undefined): string[] {
  if (organizationType === 'university') return [...UNIVERSITY_ROLES, 'founder', 'director', 'office_staff', 'faculty', 'guardian'];
  if (isAcademicOrganizationType(organizationType)) return [...EDUCATION_COMMON_ROLES, 'founder', 'director', 'office_staff', 'faculty', 'guardian'];
  return [...BUSINESS_ROLES, 'founder'];
}

export function isAcademicRole(role: unknown): boolean {
  const normalized = typeof role === 'string' ? (ROLE_ALIASES[keyForRole(role)] ?? keyForRole(role)) : '';
  return (EDUCATION_ROLES as readonly string[]).includes(normalized);
}

export function roleMatches(role: unknown, requestedRoles: readonly string[], organizationType?: OrganizationType | string): boolean {
  if (typeof role !== 'string') return false;
  if (organizationType && !isOrganizationRoleEligible(role, organizationType)) return false;
  const key = keyForRole(role);
  const normalized = ROLE_ALIASES[key] ?? key;
  const requested = new Set(requestedRoles.flatMap((requestedRole) => {
    const requestedKey = keyForRole(requestedRole);
    return [requestedKey, ROLE_ALIASES[requestedKey] ?? requestedKey];
  }));

  if (requested.has(normalized)) return true;
  if (requested.has('owner') && normalized === 'owner') return true;

  if (requested.has('admin') || requested.has('manager')) {
    if (isAcademicOrganizationType(organizationType)) {
      return (EDUCATION_ADMIN_ROLES as readonly string[]).includes(normalized) ||
        (normalized === 'manager' && requested.has('manager'));
    }
    return normalized === 'admin' || normalized === 'manager';
  }
  return false;
}
