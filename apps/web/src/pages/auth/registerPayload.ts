import type { GoogleOnboardingInput, RegisterInput } from '@aip/validation';

type PublicRole = RegisterInput['role'];

export type RegisterFormValues = Partial<Record<keyof RegisterInput, unknown>>;
export type GoogleOnboardingFormValues = Partial<Record<keyof GoogleOnboardingInput, unknown>>;

type ProfileField = Exclude<keyof RegisterInput, 'email' | 'password' | 'role'>;

/**
 * The role-profile fields each role's form actually shows — shared by the
 * password signup form and the Google onboarding form, which render the same
 * role branches. Everything else is either a leftover from a role the user
 * selected earlier or an unused default.
 */
const PROFILE_FIELDS_BY_ROLE: Record<PublicRole, ReadonlyArray<ProfileField>> = {
  STUDENT: ['fullName', 'institutionId', 'institutionCode'],
  COMPANY: ['companyName'],
  FACULTY: ['fullName', 'institutionId', 'designation', 'department'],
  INSTITUTION: [
    'institutionName',
    'institutionCode',
    'institutionDomain',
    'institutionAddress',
    'institutionCity',
    'institutionState',
  ],
};

function isPublicRole(role: unknown): role is PublicRole {
  return typeof role === 'string' && role in PROFILE_FIELDS_BY_ROLE;
}

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
  // An unknown role is the schema's problem to report, not something to repair.
  if (!isPublicRole(values.role)) return { ...values };
  return pickFields(values, ['role', 'email', 'password', ...PROFILE_FIELDS_BY_ROLE[values.role]]);
}

/**
 * The Google onboarding equivalent of `buildRegisterPayload`: the same role
 * filtering and blank-dropping (the modal has exactly the same STUDENT-first
 * default and so the same hidden-field dead end), minus email and password,
 * which come from Google.
 *
 * The Full name input shows the Google display name as its placeholder, so a
 * blank Full name means "use that name" — it is filled in here, before
 * validation, rather than failing the required-name rule.
 */
export function buildGoogleOnboardingPayload(
  values: GoogleOnboardingFormValues,
  googleName?: string,
): GoogleOnboardingFormValues {
  if (!isPublicRole(values.role)) return { ...values };
  const payload = pickFields(values, ['role', ...PROFILE_FIELDS_BY_ROLE[values.role]]);
  const fallbackName = googleName?.trim();
  if (
    (values.role === 'STUDENT' || values.role === 'FACULTY') &&
    payload.fullName === undefined &&
    fallbackName
  ) {
    payload.fullName = fallbackName;
  }
  return payload;
}

function pickFields<K extends string>(
  values: Partial<Record<K, unknown>>,
  allowed: ReadonlyArray<K>,
): Partial<Record<K, unknown>> {
  const payload: Partial<Record<K, unknown>> = {};
  for (const key of allowed) {
    const value = values[key];
    if (VERBATIM.has(key as keyof RegisterInput)) {
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
