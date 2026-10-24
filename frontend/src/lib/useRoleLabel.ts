'use client';

import { useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  canonicalRole,
  getWorkspaceExperience,
  getWorkspaceRoleCatalog,
  roleLabelKey,
  type OrganizationInfo,
} from '@/lib/organizationAccess';

function humanize(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Labels roles in the terms of the given workspace type ("School Admin",
 * "Department Head"). Roles a workspace keeps only for existing members, such
 * as "employee" in a university, are marked as earlier roles so
 * administrators can see who still needs an education role.
 */
export function useRoleLabel(organization: OrganizationInfo | null | undefined) {
  const { tOptional, t } = useI18n();
  const experience = getWorkspaceExperience(organization);
  const catalog = getWorkspaceRoleCatalog(organization);

  return useCallback((role: string | undefined): string => {
    if (!role) return '';
    const canonical = canonicalRole(role);
    const label = tOptional(roleLabelKey(canonical, organization)) ??
      tOptional(`common.roles.${canonical}`) ??
      humanize(canonical);
    const isLegacy = experience !== 'solo' && canonical !== 'owner' &&
      catalog.legacy.includes(canonical) && !catalog.assignable.includes(canonical);
    return isLegacy ? t('common.legacyRole', { role: label }) : label;
  }, [catalog, experience, organization, t, tOptional]);
}
