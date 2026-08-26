import { describe, expect, it } from 'vitest';
import { registerSchema } from '@aip/validation';
import { buildRegisterPayload, type RegisterFormValues } from '../registerPayload';

const OBJECT_ID = '507f1f77bcf86cd799439011';

const ROLES = ['STUDENT', 'COMPANY', 'FACULTY'] as const;
type PublicRole = (typeof ROLES)[number];

/**
 * The fields each role's form renders — an error on anything else has nowhere to
 * be shown, which is the failure this module exists to prevent.
 */
const VISIBLE_FIELDS: Record<PublicRole, string[]> = {
  STUDENT: ['role', 'email', 'password', 'fullName', 'institutionId'],
  COMPANY: ['role', 'email', 'password', 'companyName'],
  FACULTY: ['role', 'email', 'password', 'fullName', 'institutionId', 'designation', 'department'],
};

/**
 * What react-hook-form submits after the page loads as STUDENT (mounting and
 * registering the Full name input and the Institution select as '') and the user
 * then picks "Company — post opportunities & hire": both inputs unmount, but
 * their empty values stay in the form state.
 */
function staleCompanyFormState(): RegisterFormValues {
  return {
    role: 'COMPANY',
    designation: 'Assistant Professor',
    department: 'General',
    fullName: '',
    institutionId: '',
    companyName: 'Acme Corp',
    email: 'company@example.com',
    password: 'Password1!',
  };
}

describe('buildRegisterPayload', () => {
  it('lets a COMPANY signup through, where the raw form state could not', () => {
    const raw = staleCompanyFormState();

    // The regression: the untouched form state is rejected on two fields the
    // company form does not render.
    const before = registerSchema.safeParse(raw);
    expect(before.success).toBe(false);
    if (!before.success) {
      expect(before.error.issues.map((i) => i.path.join('.')).sort()).toEqual([
        'fullName',
        'institutionId',
      ]);
    }

    const after = registerSchema.safeParse(buildRegisterPayload(raw));
    expect(after.success).toBe(true);
    if (after.success) {
      expect(after.data).toEqual({
        role: 'COMPANY',
        companyName: 'Acme Corp',
        email: 'company@example.com',
        password: 'Password1!',
      });
    }
  });

  it('drops the stale values a company user cannot see or correct', () => {
    const payload = buildRegisterPayload(staleCompanyFormState());
    expect(payload).not.toHaveProperty('fullName');
    expect(payload).not.toHaveProperty('institutionId');
    expect(payload).not.toHaveProperty('designation');
    expect(payload).not.toHaveProperty('department');
  });

  it('only ever emits fields the selected role renders', () => {
    // A single form state carrying every field at once, as it would after a user
    // cycles through all three roles before submitting.
    const everything: RegisterFormValues = {
      email: 'someone@example.com',
      password: 'Password1!',
      fullName: 'Jane Smith',
      companyName: 'Acme Corp',
      institutionId: OBJECT_ID,
      designation: 'Reader',
      department: 'Computer Science',
    };

    for (const role of ROLES) {
      const payload = buildRegisterPayload({ ...everything, role });
      expect(Object.keys(payload).sort()).toEqual([...VISIBLE_FIELDS[role]].sort());
      expect(registerSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('reports a missing company name on the field the company form shows', () => {
    const result = registerSchema.safeParse(
      buildRegisterPayload({ ...staleCompanyFormState(), companyName: '   ' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      // Whitespace-only is treated as absent, so the refine speaks up instead of
      // Mongoose rejecting the trimmed '' as a 422 after the client approved it.
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toEqual(['companyName']);
    }
  });

  it('keeps every remaining error on a rendered field, for each role', () => {
    // Nothing filled in but the role — the empty-form submit.
    for (const role of ROLES) {
      const result = registerSchema.safeParse(
        buildRegisterPayload({ role, fullName: '', institutionId: '', companyName: '' }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        for (const issue of result.error.issues) {
          expect(VISIBLE_FIELDS[role]).toContain(String(issue.path[0]));
        }
      }
    }
  });

  it('never alters the password', () => {
    const payload = buildRegisterPayload({
      role: 'COMPANY',
      companyName: 'Acme',
      email: 'a@b.com',
      password: '  spaces are legal  ',
    });
    expect(payload.password).toBe('  spaces are legal  ');
  });

  it('trims surrounding whitespace off the values it keeps', () => {
    const payload = buildRegisterPayload({
      role: 'COMPANY',
      companyName: '  Acme Corp  ',
      email: '  company@example.com  ',
      password: 'Password1!',
    });
    expect(payload.companyName).toBe('Acme Corp');
    expect(payload.email).toBe('company@example.com');
  });

  it('is idempotent, so building twice is safe', () => {
    const once = buildRegisterPayload(staleCompanyFormState());
    expect(buildRegisterPayload(once)).toEqual(once);
  });

  it('leaves an unrecognized role alone for the schema to reject', () => {
    const raw = { role: 'ADMIN', email: 'a@b.com', password: 'Password1!' };
    expect(buildRegisterPayload(raw)).toEqual(raw);
    expect(registerSchema.safeParse(buildRegisterPayload(raw)).success).toBe(false);
  });

  it('still sends what STUDENT and FACULTY signups need', () => {
    const student = buildRegisterPayload({
      role: 'STUDENT',
      fullName: 'Jane Smith',
      institutionId: OBJECT_ID,
      email: 'jane@example.com',
      password: 'Password1!',
      // Defaults that exist for the faculty branch only.
      designation: 'Assistant Professor',
      department: 'General',
    });
    expect(student).toEqual({
      role: 'STUDENT',
      fullName: 'Jane Smith',
      institutionId: OBJECT_ID,
      email: 'jane@example.com',
      password: 'Password1!',
    });
    expect(registerSchema.safeParse(student).success).toBe(true);

    const faculty = buildRegisterPayload({
      role: 'FACULTY',
      fullName: 'Dr Ada',
      institutionId: OBJECT_ID,
      email: 'ada@example.com',
      password: 'Password1!',
      designation: 'Assistant Professor',
      department: 'General',
      companyName: 'left over from the company tab',
    });
    expect(faculty.designation).toBe('Assistant Professor');
    expect(faculty.department).toBe('General');
    expect(faculty).not.toHaveProperty('companyName');
    expect(registerSchema.safeParse(faculty).success).toBe(true);
  });
});
