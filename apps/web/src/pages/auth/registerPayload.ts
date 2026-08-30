import type { RegisterInput } from '@aip/validation';

type PublicRole = RegisterInput['role'];

export type RegisterFormValues = Partial<Record<keyof RegisterInput, unknown>>;

/**
 * The fields each role's form actually shows. Everything else is either a
 * leftover from a role the user selected earlier or an unused default.
 *
 * `role`, `email` and `password` are on every branch because every branch
 * renders them.
 */
const FIELDS_BY_ROLE: Record<PublicRole, ReadonlyArray<keyof RegisterInput>> = {
  STUDENT: ['role', 'email', 'password', 'fullName', 'institutionId'],
  COMPANY: ['role', 'email', 'password', 'companyName'],
  FACULTY: ['role', 'email', 'password', 'fullName', 'institutionId', 'designation', 'department'],
  INSTITUTION: [
    'role',
    'email',
    'password',
    'institutionName',
    'institutionCode',
    'institutionDomain',
    'institutionAddress',
    'institutionCity',
    'institutionState',
  ],
};

/**
 * `password` is deliberately never trimmed and never dropped — trimming would
 * silently change the credential the user typed, and dropping a blank one would
 * turn a clear "too short" message into "Required".
 */
const VERBATIM: ReadonlySet<keyof RegisterInput> = new Set(['password']);

/**
 * Narrows the raw react-hook-form values down to the payload the chosen role is
 * actually allowed to send.
 *
 * This exists because of a silent dead end in the signup form. `role` defaults to
 * STUDENT, so the Full name input and the Institution select mount and register
 * their empty DOM values as `''`. Selecting "Company" unmounts both, but
 * react-hook-form keeps the values of unmounted fields (`shouldUnregister`
 * defaults to false), so the submitted object still carried
 * `fullName: ''` and `institutionId: ''`.
 *
 * `registerSchema` marks those two optional, and `.optional()` admits `undefined`
 * — not `''`. So `fullName` failed `.min(1)` and `institutionId` failed the
 * ObjectId regex, on two fields the company form does not render. The resolver
 * rejected the submit, `errors.fullName` / `errors.institutionId` had nowhere to
 * display, no request was made so no server error banner appeared, and
 * "Create account" simply did nothing. Company signup was impossible through the
 * UI, which meant there was no company account to sign in with.
 *
 * Dropping blank optional strings rather than passing them through also keeps
 * whitespace-only input from reaching Mongoose, whose `trim: true` would turn
 * `'   '` into `''` and reject it against `minlength: 1` as a 422 the client had
 * already approved.
 *
 * The schema itself is unchanged: this only removes values the user cannot see or
 * correct, so every remaining error lands on a field the form is showing.
 */
export function buildRegisterPayload(values: RegisterFormValues): RegisterFormValues {
  const allowed = FIELDS_BY_ROLE[values.role as PublicRole];
  // An unknown role is the schema's problem to report, not something to repair.
  if (!allowed) return { ...values };

  const payload: RegisterFormValues = {};
  for (const key of allowed) {
    const value = values[key];
    if (VERBATIM.has(key)) {
      if (value !== undefined) payload[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) payload[key] = trimmed;
      continue;
    }
    if (value !== undefined && value !== null) payload[key] = value;
  }
  return payload;
}
