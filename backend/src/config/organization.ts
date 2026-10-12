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

export function normalizeOrganizationRole(role: unknown, organizationType: OrganizationType | string | null | undefined, fallback = 'employee'): string {
  if (typeof role !== 'string') return fallback;

  const normalized = keyForRole(role);
  const canonical = ROLE_ALIASES[normalized] ?? normalized;

  if (isAcademicOrganizationType(organizationType)) {
    const allowed = new Set<string>([...EDUCATION_ROLES]);
    if (allowed.has(canonical)) return canonical;
  }

  if (organizationType === 'business' || !organizationType) {
    if (new Set<string>(BUSINESS_ROLES).has(canonical)) return canonical;
  }

  return fallback;
}

export function isOrganizationRoleAllowed(role: unknown, organizationType: OrganizationType | string | null | undefined): boolean {
  const normalized = normalizeOrganizationRole(role, organizationType, 'employee');

  if (isAcademicOrganizationType(organizationType)) {
    return normalized === 'owner' || normalized === 'principal' || normalized === 'admin' ||
      normalized === 'teacher' || normalized === 'student' || normalized === 'parent' ||
      normalized === 'dean' || normalized === 'hod' || normalized === 'manager' ||
      normalized === 'employee' || normalized === 'guest';
  }

  return normalized === 'owner' || normalized === 'admin' || normalized === 'manager' ||
    normalized === 'employee' || normalized === 'guest';
}

export function getAllowedRolesByOrganizationType(organizationType: OrganizationType | string | null | undefined): string[] {
  if (isAcademicOrganizationType(organizationType)) {
    return [...EDUCATION_ROLES];
  }
  return [...BUSINESS_ROLES];
}

export function isAcademicRole(role: unknown): boolean {
  const normalized = typeof role === 'string' ? (ROLE_ALIASES[keyForRole(role)] ?? keyForRole(role)) : '';
  return [
    ...EDUCATION_OWNER_ROLES,
    ...EDUCATION_ADMIN_ROLES,
    ...EDUCATION_TEACHER_ROLES,
    ...EDUCATION_STUDENT_ROLES,
    ...EDUCATION_PARENT_ROLES,
    'manager',
    'employee',
    'guest',
  ].includes(normalized as any);
}
