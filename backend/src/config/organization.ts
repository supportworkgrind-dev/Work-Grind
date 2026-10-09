export const ORGANIZATION_TYPES = ['business', 'school', 'college', 'university'] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === 'string' &&
    ORGANIZATION_TYPES.includes(value as OrganizationType);
}
