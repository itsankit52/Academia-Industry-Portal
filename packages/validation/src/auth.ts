import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@aip/config';
import { objectIdSchema } from './common';

// ==================== SHARED ROLE PROFILE RULES ====================
//
// Password signup (/auth/register), Google signup (/auth/google) and the
// Google onboarding form all collect the same role profile. They share these
// field definitions and the role → required-fields table below, so the three
// can never disagree about what a valid COMPANY, FACULTY, STUDENT or
// INSTITUTION signup is.

export const PUBLIC_ROLES = ['STUDENT', 'COMPANY', 'FACULTY', 'INSTITUTION'] as const;
export type PublicRole = (typeof PUBLIC_ROLES)[number];
export const publicRoleSchema = z.enum(PUBLIC_ROLES);

/** A bare hostname such as `acme.edu` — no scheme, port, path or spaces. */
const DOMAIN_PATTERN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const roleProfileShape = {
  fullName: z.string().min(1).max(120).optional(),
  companyName: z.string().min(1).max(200).optional(),

  // STUDENT / FACULTY: the institution they belong to.
  institutionId: objectIdSchema.optional(),

  // STUDENT: must match the selected institution. INSTITUTION: optional custom
  // code for the new institution (generated when omitted).
  institutionCode: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and digits only')
    .optional(),

  // INSTITUTION: details of the institution this account creates.
  institutionName: z.string().min(2).max(200).optional(),
  institutionDomain: z
    .string()
    .trim()
    .min(4)
    .max(120)
    .regex(DOMAIN_PATTERN, 'Enter a domain like acme.edu (no http:// or path)')
    .optional(),
  institutionAddress: z.string().min(1).max(500).optional(),
  institutionCity: z.string().min(1).max(120).optional(),
  institutionState: z.string().min(1).max(120).optional(),

  // FACULTY
  designation: z.string().min(1).max(120).optional(),
  department: z.string().min(1).max(120).optional(),
};

type RoleProfileField = keyof typeof roleProfileShape;

/** Fields each role must supply. Everything else in the profile is optional. */
export const ROLE_REQUIRED_FIELDS: Record<PublicRole, ReadonlyArray<RoleProfileField>> = {
  STUDENT: ['fullName', 'institutionId', 'institutionCode'],
  COMPANY: ['companyName'],
  FACULTY: ['fullName', 'institutionId'],
  INSTITUTION: [
    'institutionName',
    'institutionDomain',
    'institutionAddress',
    'institutionCity',
    'institutionState',
  ],
};

/**
 * What the user is told when a role-required field is missing. Shared by the
 * schema rule below and the API's own defensive re-checks, so the signup form,
 * the Google onboarding form and API responses all say the same thing. The
 * issue `path` stays the field name, so API consumers can still key off it.
 */
export const ROLE_FIELD_MESSAGES: Record<RoleProfileField, string> = {
  fullName: 'Please enter your full name.',
  institutionId: 'Please select your institution.',
  institutionCode: 'Please enter your institution code.',
  companyName: 'Please enter your company name.',
  designation: 'Please enter your designation.',
  department: 'Please enter your department.',
  institutionName: 'Please enter the institution name.',
  institutionDomain: "Please enter the institution's website domain.",
  institutionAddress: 'Please enter the institution address.',
  institutionCity: 'Please enter the city.',
  institutionState: 'Please enter the state.',
};

/** Adds a friendly "Please …" issue, at the field's path, for each missing required field. */
function requireRoleFields(
  value: { role?: PublicRole } & Partial<Record<RoleProfileField, unknown>>,
  ctx: z.RefinementCtx,
): void {
  if (!value.role) return;
  for (const field of ROLE_REQUIRED_FIELDS[value.role]) {
    if (!value[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: ROLE_FIELD_MESSAGES[field],
        path: [field],
      });
    }
  }
}

// ==================== REGISTER SCHEMA ====================

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
    role: publicRoleSchema,
    ...roleProfileShape,
  })
  .strict()
  .superRefine(requireRoleFields);

// ==================== LOGIN SCHEMA ====================

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

// ==================== GOOGLE AUTH SCHEMA ====================

// `role` is absent on the first call (sign-in, or discovering that the user is
// new). When it is present this is a signup, and the same role rules as
// password registration apply. ADMIN is not a public role and is rejected.
export const googleAuthSchema = z
  .object({
    idToken: z.string().min(1, 'idToken is required'),
    role: publicRoleSchema.optional(),
    ...roleProfileShape,
  })
  .strict()
  .superRefine(requireRoleFields);

// The Google onboarding form's own schema: the signup part of googleAuthSchema
// (role required, no token — the token is attached after validation).
export const googleOnboardingSchema = z
  .object({
    role: publicRoleSchema,
    ...roleProfileShape,
  })
  .strict()
  .superRefine(requireRoleFields);

// ==================== GOOGLE LINK SCHEMA ====================

// Linking a Google identity to an existing account needs two fresh proofs:
// a Google ID token (ownership of the Google identity) and, for accounts that
// have a password, that password (ownership of the AcadIn account). The
// password is optional here only because a Google-only account has none; the
// service enforces it whenever the account has one.
export const googleLinkSchema = z
  .object({
    idToken: z.string().min(1, 'idToken is required').max(4096),
    currentPassword: z.string().min(1).max(256).optional(),
  })
  .strict();

// ==================== CHANGE PASSWORD SCHEMA ====================

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH),
  })
  .strict();

// ==================== TYPE EXPORTS ====================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type GoogleOnboardingInput = z.infer<typeof googleOnboardingSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GoogleLinkInput = z.infer<typeof googleLinkSchema>;
