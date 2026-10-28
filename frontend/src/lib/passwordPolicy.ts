/**
 * Account password rules, identical to the backend's
 * (backend/src/services/registrationValidation.ts; a backend test compares
 * them). No runtime imports, so that test can load this file directly.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export const PASSWORD_REQUIREMENTS: ReadonlyArray<{ id: string; label: string; met: (password: string) => boolean }> = [
  { id: 'length', label: `at least ${PASSWORD_MIN_LENGTH} characters`, met: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { id: 'uppercase', label: 'an uppercase letter', met: (password) => /[A-Z]/.test(password) },
  { id: 'lowercase', label: 'a lowercase letter', met: (password) => /[a-z]/.test(password) },
  { id: 'number', label: 'a number', met: (password) => /[0-9]/.test(password) },
  { id: 'symbol', label: 'a symbol such as ! @ # or ?', met: (password) => PASSWORD_SYMBOL.test(password) },
];

/** The requirements this password does not meet (empty when it is acceptable). */
export function missingPasswordRequirements(password: string): string[] {
  return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.met(password)).map((requirement) => requirement.label);
}

/** The same sentence the server returns, or undefined when the password is acceptable. */
export function passwordError(password: string): string | undefined {
  const missing = missingPasswordRequirements(password);
  if (!missing.length) return undefined;
  const list = missing.length < 2 ? missing.join('') : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return `Your password needs ${list}.`;
}

export type RegistrationField = 'fullName' | 'email' | 'password' | 'accountType' | 'organizationType' | 'invitation';
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

/** Field errors from a failed registration response (`errors` in the body), if any. */
export function registrationErrorsFrom(error: unknown): RegistrationErrors {
  const data = (error as { response?: { data?: { errors?: unknown } } })?.response?.data;
  const errors = data?.errors;
  if (!errors || typeof errors !== 'object') return {};
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => typeof message === 'string')) as RegistrationErrors;
}
