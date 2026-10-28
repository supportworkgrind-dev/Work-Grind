import Company from '../models/Company';
import { isOrganizationType, OrganizationType, resolveDefaultJoinRole } from '../config/organization';
import { describeAcademicInvitation } from './academicInvitation.service';

export type RegistrationField = 'fullName' | 'email' | 'password' | 'accountType' | 'organizationType' | 'invitation';
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

// Kept identical to frontend/src/lib/passwordPolicy.ts (checked by a test).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const PASSWORD_REQUIREMENTS: Array<[string, (password: string) => boolean]> = [
  [`at least ${PASSWORD_MIN_LENGTH} characters`, (password) => password.length >= PASSWORD_MIN_LENGTH],
  ['an uppercase letter', (password) => /[A-Z]/.test(password)],
  ['a lowercase letter', (password) => /[a-z]/.test(password)],
  ['a number', (password) => /[0-9]/.test(password)],
  ['a symbol such as ! @ # or ?', (password) => PASSWORD_SYMBOL.test(password)],
];

/** The password requirements this password does not meet (empty when it is acceptable). */
export function missingPasswordRequirements(password: string): string[] {
  return PASSWORD_REQUIREMENTS.filter(([, met]) => !met(password)).map(([label]) => label);
}

function listRequirements(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Field-specific problems with the account details every registration needs. */
export function validateAccountFields(input: { fullName: string; email: string; password: string }): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (!input.fullName) errors.fullName = 'Enter your full name.';
  else if (input.fullName.length > 100) errors.fullName = 'Your name must be 100 characters or fewer.';
  if (!input.email) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = 'Enter a valid email address, like name@example.com.';
  const missing = missingPasswordRequirements(input.password);
  if (missing.length) errors.password = `Your password needs ${listRequirements(missing)}.`;
  return errors;
}

/** Field-specific problems with a self-service signup's workspace choice. */
export function validateWorkspaceChoice(accountType: unknown, organizationType: unknown): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (accountType !== 'company' && accountType !== 'individual') {
    errors.accountType = 'Choose whether this is a team workspace or a personal (Solo) workspace.';
  }
  if (!isOrganizationType(organizationType)) {
    errors.organizationType = 'Choose a business, school, college, or university workspace.';
  } else if (accountType === 'individual' && organizationType !== 'business') {
    errors.organizationType = 'Personal (Solo) workspaces are for business use. Choose a team workspace for a school, college, or university.';
  }
  return errors;
}

export type RegistrationInvitation = {
  organizationType: OrganizationType;
  /** Set when the invitation was sent to one address; the account must use it. */
  email?: string;
};

/**
 * Resolves the invitation a registration comes from, so the workspace type is
 * taken from the inviting workspace on the server rather than from the client.
 * Accepts a workspace invitation token, a workspace invite code, or an academic
 * onboarding invitation token. Returns null when it is unknown or expired.
 */
export async function resolveRegistrationInvitation(input: { inviteToken?: string; academicInviteToken?: string }): Promise<RegistrationInvitation | null> {
  if (input.academicInviteToken) {
    const invitation = await describeAcademicInvitation(input.academicInviteToken);
    return invitation ? { organizationType: invitation.organizationType as OrganizationType, email: invitation.email } : null;
  }
  const token = input.inviteToken?.trim();
  if (!token || token.length > 200) return null;
  const now = new Date();
  const invited = await Company.findOne({ 'pendingInvites.token': token, 'pendingInvites.expiresAt': { $gt: now }, isActive: true })
    .select('organizationType accountType pendingInvites');
  if (invited) {
    if (invited.accountType === 'individual' || !isOrganizationType(invited.organizationType)) return null;
    const invite = invited.pendingInvites.find((item) => item.token === token);
    return { organizationType: invited.organizationType, ...(invite?.email ? { email: invite.email.toLowerCase() } : {}) };
  }
  const byCode = await Company.findOne({ inviteCode: token.toUpperCase(), isActive: true }).select('organizationType accountType settings');
  // A Solo workspace has no member roles, so its code cannot be joined.
  if (!byCode || byCode.accountType === 'individual' || !isOrganizationType(byCode.organizationType)) return null;
  if (!resolveDefaultJoinRole(byCode.organizationType, byCode.settings?.defaultRole, byCode.accountType)) return null;
  return { organizationType: byCode.organizationType };
}
