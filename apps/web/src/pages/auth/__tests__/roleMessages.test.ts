/**
 * Role-required fields report a plain-language message, while the issue code
 * and path (what API consumers key off) stay the same. Both signup paths share
 * the rule: password registration and Google onboarding.
 */
import { describe, expect, it } from 'vitest';
import { googleOnboardingSchema, registerSchema, ROLE_FIELD_MESSAGES } from '@aip/validation';

const INSTITUTION_ID = '507f1f77bcf86cd799439011';
const account = { email: 'a@b.test', password: 'Password1!' };

function issues(result: {
  success: boolean;
  error?: { issues: { path: unknown[]; message: string; code: string }[] };
}) {
  return (result.error?.issues ?? []).map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
}

describe('role-required field messages', () => {
  it.each([
    [
      'FACULTY without an institution',
      { role: 'FACULTY', fullName: 'Dr X' },
      'institutionId',
      'Please select your institution.',
    ],
    [
      'STUDENT without an institution code',
      { role: 'STUDENT', fullName: 'S', institutionId: INSTITUTION_ID },
      'institutionCode',
      'Please enter your institution code.',
    ],
    [
      'COMPANY without a company name',
      { role: 'COMPANY' },
      'companyName',
      'Please enter your company name.',
    ],
    [
      'STUDENT without a name',
      { role: 'STUDENT', institutionId: INSTITUTION_ID, institutionCode: 'AB12' },
      'fullName',
      'Please enter your full name.',
    ],
  ])('%s', (_label, profile, path, message) => {
    for (const schema of [registerSchema, googleOnboardingSchema]) {
      const input = schema === registerSchema ? { ...account, ...profile } : profile;
      expect(issues(schema.safeParse(input))).toContainEqual({ path, message, code: 'custom' });
    }
  });

  it('INSTITUTION lists every missing field in plain language at its own path', () => {
    const got = issues(registerSchema.safeParse({ ...account, role: 'INSTITUTION' }));
    for (const field of [
      'institutionName',
      'institutionDomain',
      'institutionAddress',
      'institutionCity',
      'institutionState',
    ] as const) {
      expect(got).toContainEqual({
        path: field,
        message: ROLE_FIELD_MESSAGES[field],
        code: 'custom',
      });
    }
  });

  it('no message names a field or a role constant', () => {
    for (const message of Object.values(ROLE_FIELD_MESSAGES)) {
      expect(message).toMatch(/^Please /);
      expect(message).not.toMatch(/[a-z][A-Z]|STUDENT|FACULTY|COMPANY|INSTITUTION/);
    }
  });

  it('valid registrations are unaffected', () => {
    expect(
      registerSchema.safeParse({ ...account, role: 'COMPANY', companyName: 'Acme' }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        ...account,
        role: 'FACULTY',
        fullName: 'Dr X',
        institutionId: INSTITUTION_ID,
      }).success,
    ).toBe(true);
  });
});
