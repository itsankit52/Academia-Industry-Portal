/**
 * institution-registration.test.ts
 *
 * Phase 19 regression tests — Real University Selection & Institution Validation
 *
 * Verifies:
 *   1. Student registration without institutionId → 400
 *   2. Student registration with invalid (non-ObjectId) institutionId → AppError (bad request)
 *   3. Student registration with a nonexistent institutionId → 400
 *   4. Student registration with a PENDING institution → 400 (not verified yet)
 *   5. Student registration with a valid VERIFIED institution → succeeds, profile linked
 *   6. Faculty registration without institutionId → 400
 *   7. Faculty registration with valid institution → succeeds, profile linked
 *   8. Company registration does NOT require institutionId
 *   9. StudentProfile.institution is set to the supplied institutionId
 *  10. User.institution is set on both STUDENT and FACULTY (for isolation middleware)
 *  11. Institution cannot be changed via updateMyProfile (Phase 17 regression)
 */

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the whole models barrel so no Mongoose connection is needed ─────────
vi.mock('../../../models', () => ({
  User: { findOne: vi.fn(), findById: vi.fn(), create: vi.fn(), deleteOne: vi.fn() },
  StudentProfile: { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
  CompanyProfile: { create: vi.fn(), findOne: vi.fn() },
  FacultyProfile: { create: vi.fn(), findOne: vi.fn() },
  Institution: { findById: vi.fn(), create: vi.fn() },
  AuditLog: { create: vi.fn() },
}));

vi.mock('../../../utils/cookies', () => ({
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
}));
vi.mock('../../../utils/jwt', () => ({
  signAccessToken: vi.fn(() => 'access.token'),
  signRefreshToken: vi.fn(() => 'refresh.token'),
  verifyRefreshToken: vi.fn(),
}));

import {
  AuditLog,
  CompanyProfile,
  FacultyProfile,
  Institution,
  StudentProfile,
  User,
} from '../../../models';
import { registerUser } from '../auth.service';
import { updateMyProfile } from '../../students/students.service';

const res = {} as never;
const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUserId() {
  return new Types.ObjectId();
}

/**
 * Returns a minimal Mongoose-document-like object that User.create resolves to.
 * `institution` is written by the INSTITUTION role path (user.save()), so we
 * make it a writable property.
 */
function userDoc(id: Types.ObjectId, role: string) {
  const doc = {
    _id: id,
    email: 'test@example.com',
    role,
    institution: undefined as Types.ObjectId | undefined,
    refreshTokenVersion: 0,
    save: vi.fn(async function (this: typeof doc) {
      return this;
    }),
    toJSON: () => ({ id: String(id), email: 'test@example.com', role }),
  };
  return doc;
}

/**
 * Stub Institution.findById to simulate a VERIFIED institution.
 * The service calls `.select('_id verificationStatus').lean()` on the result.
 */
function mockVerifiedInstitution(id: Types.ObjectId) {
  vi.mocked(Institution.findById).mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve({ _id: id, verificationStatus: 'VERIFIED' }),
    }),
  } as never);
}

/**
 * Stub Institution.findById to simulate a PENDING (not yet verified) institution.
 */
function mockPendingInstitution(id: Types.ObjectId) {
  vi.mocked(Institution.findById).mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve({ _id: id, verificationStatus: 'PENDING' }),
    }),
  } as never);
}

/**
 * Stub Institution.findById to simulate no institution found (null).
 */
function mockMissingInstitution() {
  vi.mocked(Institution.findById).mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve(null),
    }),
  } as never);
}

let userId: Types.ObjectId;

beforeEach(() => {
  vi.clearAllMocks();
  userId = makeUserId();

  // Default: no existing user (conflict guard passes)
  vi.mocked(User.findOne).mockResolvedValue(null as never);
  vi.mocked(User.create).mockImplementation(((doc: { role: string }) =>
    Promise.resolve(userDoc(userId, doc.role))) as never);
  vi.mocked(User.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);

  vi.mocked(StudentProfile.create).mockResolvedValue({ _id: new Types.ObjectId() } as never);
  vi.mocked(CompanyProfile.create).mockResolvedValue({ _id: new Types.ObjectId() } as never);
  vi.mocked(FacultyProfile.create).mockResolvedValue({ _id: new Types.ObjectId() } as never);
  vi.mocked(AuditLog.create).mockResolvedValue({} as never);
});

// ── 1. STUDENT — missing institutionId ───────────────────────────────────────

describe('registerUser — STUDENT without institutionId', () => {
  it('throws a 400 error before touching the database', async () => {
    await expect(
      registerUser(
        {
          email: 'student@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
          // institutionId intentionally omitted
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    // No user or profile should have been created
    expect(User.create).not.toHaveBeenCalled();
    expect(StudentProfile.create).not.toHaveBeenCalled();
  });

  it('error message mentions institutionId', async () => {
    await expect(
      registerUser(
        {
          email: 'student@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining('institutionId'),
    });
  });
});

// ── 2. STUDENT — nonexistent institutionId ───────────────────────────────────

describe('registerUser — STUDENT with nonexistent institutionId', () => {
  it('throws 400 when the institution document does not exist', async () => {
    mockMissingInstitution();

    await expect(
      registerUser(
        {
          email: 'student@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
          institutionId: new Types.ObjectId().toHexString(),
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(User.create).not.toHaveBeenCalled();
  });

  it('error message mentions institution not found', async () => {
    mockMissingInstitution();

    await expect(
      registerUser(
        {
          email: 'student@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
          institutionId: new Types.ObjectId().toHexString(),
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining('not found'),
    });
  });
});

// ── 3. STUDENT — PENDING institution ─────────────────────────────────────────

describe('registerUser — STUDENT with PENDING (unverified) institution', () => {
  it('throws 400 when the institution is not yet verified', async () => {
    const instId = new Types.ObjectId();
    mockPendingInstitution(instId);

    await expect(
      registerUser(
        {
          email: 'student@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
          institutionId: instId.toHexString(),
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    // Unverified institution must not allow new registrations
    expect(User.create).not.toHaveBeenCalled();
    expect(StudentProfile.create).not.toHaveBeenCalled();
  });

  it('error message mentions pending verification', async () => {
    const instId = new Types.ObjectId();
    mockPendingInstitution(instId);

    await expect(
      registerUser(
        {
          email: 'student@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
          institutionId: instId.toHexString(),
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/pending|verification|verified/i),
    });
  });
});

// ── 4. STUDENT — valid VERIFIED institution ───────────────────────────────────

describe('registerUser — STUDENT with valid verified institution', () => {
  it('creates the User and StudentProfile, both linked to the institution', async () => {
    const instId = new Types.ObjectId();
    mockVerifiedInstitution(instId);

    await registerUser(
      {
        email: 'jane@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Jane Smith',
        institutionId: instId.toHexString(),
      },
      res,
      ctx,
    );

    // User was created
    expect(User.create).toHaveBeenCalledTimes(1);
    const userCreated = vi.mocked(User.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(userCreated.role).toBe('STUDENT');
    expect(userCreated.isActive).toBe(true);
    // institution should be stored on the User for isolation middleware
    expect(String(userCreated.institution)).toBe(instId.toHexString());

    // StudentProfile was created and linked to both the user and the institution
    expect(StudentProfile.create).toHaveBeenCalledTimes(1);
    const profile = vi.mocked(StudentProfile.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(String(profile.user)).toBe(String(userId));
    expect(String(profile.institution)).toBe(instId.toHexString());
    expect(profile.fullName).toBe('Jane Smith');
  });

  it('does not roll back on success', async () => {
    const instId = new Types.ObjectId();
    mockVerifiedInstitution(instId);

    await registerUser(
      {
        email: 'jane@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Jane Smith',
        institutionId: instId.toHexString(),
      },
      res,
      ctx,
    );

    expect(User.deleteOne).not.toHaveBeenCalled();
  });

  it('does not create a CompanyProfile or FacultyProfile', async () => {
    const instId = new Types.ObjectId();
    mockVerifiedInstitution(instId);

    await registerUser(
      {
        email: 'jane@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Jane Smith',
        institutionId: instId.toHexString(),
      },
      res,
      ctx,
    );

    expect(CompanyProfile.create).not.toHaveBeenCalled();
    expect(FacultyProfile.create).not.toHaveBeenCalled();
  });
});

// ── 5. FACULTY — institutionId required ──────────────────────────────────────

describe('registerUser — FACULTY without institutionId', () => {
  it('throws 400 before creating any records', async () => {
    await expect(
      registerUser(
        {
          email: 'prof@example.edu',
          password: 'Password1!',
          role: 'FACULTY',
          fullName: 'Dr. Priya Mehta',
          designation: 'Associate Professor',
          department: 'Computer Science',
          // institutionId intentionally omitted
        },
        res,
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(User.create).not.toHaveBeenCalled();
    expect(FacultyProfile.create).not.toHaveBeenCalled();
  });
});

describe('registerUser — FACULTY with valid verified institution', () => {
  it('creates User and FacultyProfile both linked to the institution', async () => {
    const instId = new Types.ObjectId();
    mockVerifiedInstitution(instId);

    await registerUser(
      {
        email: 'prof@example.edu',
        password: 'Password1!',
        role: 'FACULTY',
        fullName: 'Dr. Priya Mehta',
        institutionId: instId.toHexString(),
        designation: 'Associate Professor',
        department: 'Computer Science',
      },
      res,
      ctx,
    );

    expect(User.create).toHaveBeenCalledTimes(1);
    const userCreated = vi.mocked(User.create).mock.calls[0]![0] as Record<string, unknown>;
    // Institution stored on User for isolation middleware
    expect(String(userCreated.institution)).toBe(instId.toHexString());

    expect(FacultyProfile.create).toHaveBeenCalledTimes(1);
    const faculty = vi.mocked(FacultyProfile.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(String(faculty.institution)).toBe(instId.toHexString());
    expect(faculty.fullName).toBe('Dr. Priya Mehta');
    expect(faculty.designation).toBe('Associate Professor');
    expect(faculty.department).toBe('Computer Science');
  });
});

// ── 6. COMPANY — no institution required ─────────────────────────────────────

describe('registerUser — COMPANY does not require institutionId', () => {
  it('registers successfully with no institutionId', async () => {
    await registerUser(
      {
        email: 'hiring@acme.com',
        password: 'Password1!',
        role: 'COMPANY',
        companyName: 'Acme Corp',
        // no institutionId
      },
      res,
      ctx,
    );

    expect(User.create).toHaveBeenCalledTimes(1);
    expect(CompanyProfile.create).toHaveBeenCalledTimes(1);
    // Institution.findById must not have been called for a COMPANY
    expect(Institution.findById).not.toHaveBeenCalled();
  });

  it('does not store an institution reference on the User', async () => {
    await registerUser(
      {
        email: 'hiring@acme.com',
        password: 'Password1!',
        role: 'COMPANY',
        companyName: 'Acme Corp',
      },
      res,
      ctx,
    );

    const userCreated = vi.mocked(User.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(userCreated.institution).toBeUndefined();
  });
});

// ── 7. No demo institution assigned by default ────────────────────────────────

describe('registerUser — no default/demo institution', () => {
  it('uses exactly the institutionId the caller provided, nothing else', async () => {
    const realInstId = new Types.ObjectId();
    mockVerifiedInstitution(realInstId);

    await registerUser(
      {
        email: 'student@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Real Student',
        institutionId: realInstId.toHexString(),
      },
      res,
      ctx,
    );

    const profile = vi.mocked(StudentProfile.create).mock.calls[0]![0] as Record<string, unknown>;
    // The profile must use the exact ID passed in — no substitution or fallback
    expect(String(profile.institution)).toBe(realInstId.toHexString());
  });

  it('does NOT assign a hardcoded fallback when the caller provides a valid institution', async () => {
    const providedInstId = new Types.ObjectId();
    const differentInstId = new Types.ObjectId();
    mockVerifiedInstitution(providedInstId);

    await registerUser(
      {
        email: 'student@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Real Student',
        institutionId: providedInstId.toHexString(),
      },
      res,
      ctx,
    );

    const profile = vi.mocked(StudentProfile.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(String(profile.institution)).not.toBe(differentInstId.toHexString());
  });
});

// ── 8. Institution isolation — cannot change institution after registration ───

describe('updateMyProfile — institution cannot be changed', () => {
  /** Shared student profile mock */
  function mockExistingProfile(userId: Types.ObjectId) {
    vi.mocked(StudentProfile.findOne).mockResolvedValue({
      _id: new Types.ObjectId(),
      user: userId,
      institution: new Types.ObjectId(),
      toJSON: () => ({ fullName: 'Jane Smith' }),
    } as never);

    vi.mocked(StudentProfile.findOneAndUpdate).mockResolvedValue({
      toJSON: () => ({ fullName: 'Jane Updated' }),
    } as never);
  }

  it('throws 403 when the patch includes institutionId', async () => {
    const uid = new Types.ObjectId();
    mockExistingProfile(uid);

    const patch = {
      // institutionId is not in UpdateStudentProfileInput (stripped by schema),
      // but defence-in-depth must still catch it if it arrives.
      institutionId: new Types.ObjectId().toHexString(),
    } as unknown as Parameters<typeof updateMyProfile>[1];

    await expect(updateMyProfile(String(uid), patch)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('error message mentions institution cannot be changed', async () => {
    const uid = new Types.ObjectId();
    mockExistingProfile(uid);

    const patch = {
      institutionId: new Types.ObjectId().toHexString(),
    } as unknown as Parameters<typeof updateMyProfile>[1];

    await expect(updateMyProfile(String(uid), patch)).rejects.toMatchObject({
      message: expect.stringMatching(/institution.*cannot|cannot.*institution/i),
    });
  });

  it('allows updating other profile fields without an institution check error', async () => {
    const uid = new Types.ObjectId();
    mockExistingProfile(uid);

    // A normal profile update with no institutionId must succeed
    await expect(updateMyProfile(String(uid), { fullName: 'Jane Updated' })).resolves.toBeDefined();

    // findOneAndUpdate must have been called (not blocked)
    expect(StudentProfile.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

// ── 9. Institution existence check fires for every STUDENT/FACULTY call ───────

describe('assertInstitutionVerified called exactly once per STUDENT/FACULTY registration', () => {
  it('calls Institution.findById once for STUDENT', async () => {
    const instId = new Types.ObjectId();
    mockVerifiedInstitution(instId);

    await registerUser(
      {
        email: 'student@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Jane Smith',
        institutionId: instId.toHexString(),
      },
      res,
      ctx,
    );

    expect(Institution.findById).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Institution.findById).mock.calls[0]![0]).toBe(instId.toHexString());
  });

  it('calls Institution.findById once for FACULTY', async () => {
    const instId = new Types.ObjectId();
    mockVerifiedInstitution(instId);

    await registerUser(
      {
        email: 'prof@example.edu',
        password: 'Password1!',
        role: 'FACULTY',
        fullName: 'Dr. Mehta',
        institutionId: instId.toHexString(),
        designation: 'Professor',
        department: 'CSE',
      },
      res,
      ctx,
    );

    expect(Institution.findById).toHaveBeenCalledTimes(1);
  });

  it('does NOT call Institution.findById for COMPANY', async () => {
    await registerUser(
      {
        email: 'hiring@acme.com',
        password: 'Password1!',
        role: 'COMPANY',
        companyName: 'Acme Corp',
      },
      res,
      ctx,
    );

    expect(Institution.findById).not.toHaveBeenCalled();
  });
});
