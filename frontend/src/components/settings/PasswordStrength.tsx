'use client';

// The same rules the backend enforces in changePassword / resetPassword.
const RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'A lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'A number', test: (value) => /[0-9]/.test(value) },
  { label: 'A special character', test: (value) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value) },
];

const LEVELS = [
  { label: 'Too weak', bar: 'bg-rose-500', width: 'w-1/5' },
  { label: 'Too weak', bar: 'bg-rose-500', width: 'w-1/5' },
  { label: 'Weak', bar: 'bg-orange-500', width: 'w-2/5' },
  { label: 'Fair', bar: 'bg-amber-500', width: 'w-3/5' },
  { label: 'Almost there', bar: 'bg-lime-500', width: 'w-4/5' },
  { label: 'Meets requirements', bar: 'bg-emerald-500', width: 'w-full' },
];

export function PasswordStrength({ password }: { password: string }) {
  const passed = RULES.filter((rule) => rule.test(password)).length;
  // Long passwords that meet every rule are labelled strong.
  const level = passed === RULES.length && password.length >= 12
    ? { ...LEVELS[5], label: 'Strong' }
    : LEVELS[passed];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full rounded-full transition-all ${level.bar} ${level.width}`} />
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-600">Password strength: {level.label}</p>
      <ul className="mt-1 grid gap-0.5 text-[11px] sm:grid-cols-2">
        {RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className={ok ? 'text-emerald-700' : 'text-slate-400'}>
              {ok ? '✓' : '○'} {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
