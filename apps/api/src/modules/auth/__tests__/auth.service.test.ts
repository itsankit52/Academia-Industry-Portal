import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  User: { findOne: vi.fn(), findById: vi.fn(), create: vi.fn(), deleteOne: vi.fn() },
  StudentProfile: { create: vi.fn(), findOne: vi.fn() },
  CompanyProfile: { create: vi.fn(), findOne: vi.fn() },
  FacultyProfile: { create: vi.fn(), findOne: vi.fn() },
  Institution: { findById: vi.fn() },
  AuditLog: { create: vi.fn() },
}));

// Cookies and tokens are exercised elsewhere; stubbing them keeps this test on the
// question it is asking, which is what ends up in the database.
vi.mock('../../../utils/cookies', () => ({
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
}));
vi.mock('../../../utils/jwt', () => ({
  signAccessToken: vi.fn(() => 'access.token'),
  signRefreshToken: vi.fn(() => 'refresh.token'),
  verifyRefreshToken: vi.fn(),
}));

import { AuditLog, CompanyProfile, Institution, StudentProfile, User } from '../../../models';
import { getCurrentUser, loginUser, registerUser } from '../auth.service';

const res = {} as never;
const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

/** Stands in for the Mongoose document `User.create` resolves to. */
function userDoc(id: Types.ObjectId, role: string) {
  return {
    _id: id,
    email: 'hiring@acme.com',
    role,
    refreshTokenVersion: 0,
    toJSON: () => ({ id: String(id), email: 'hiring@acme.com', role }),
  };
}

let newUserId: Types.ObjectId;

beforeEach(() => {
  vi.clearAllMocks();
  newUserId = new Types.ObjectId();
  // Nobody registered with this email yet, so the conflict guard lets us past.
  vi.mocked(User.findOne).mockResolvedValue(null as never);
  vi.mocked(User.create).mockImplementation(((doc: { role: string }) =>
    Promise.resolve(userDoc(newUserId, doc.role))) as never);
  vi.mocked(User.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);
  vi.mocked(CompanyProfile.create).mockImplementation((() =>
    Promise.resolve({ _id: new Types.ObjectId() })) as never);
  vi.mocked(StudentProfile.create).mockImplementation((() =>
    Promise.resolve({ _id: new Types.ObjectId() })) as never);
  vi.mocked(AuditLog.create).mockResolvedValue({} as never);
  vi.mocked(Institution.findById).mockReturnValue({
    select: () => Promise.resolve({ _id: new Types.ObjectId() }),
  } as never);
});

const companyInput = {
  email: 'hiring@acme.com',
  password: 'Password1!',
  role: 'COMPANY' as const,
  companyName: 'Acme Corp',
};

describe('registerUser — COMPANY', () => {
  it('creates the User and the CompanyProfile, linked by user id', async () => {
    await registerUser(companyInput, res, ctx);

    expect(User.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(User.create).mock.calls[0]![0]).toMatchObject({
      email: 'hiring@acme.com',
      role: 'COMPANY',
      isActive: true,
    });

    expect(CompanyProfile.create).toHaveBeenCalledTimes(1);
    const profile = vi.mocked(CompanyProfile.create).mock.calls[0]![0] as {
      user: Types.ObjectId;
      companyName: string;
    };
    // The relationship every company route depends on: CompanyProfile.user must
    // point at the User that was just created.
    expect(String(profile.user)).toBe(String(newUserId));
    expect(profile.companyName).toBe('Acme Corp');
  });

  it('still stores a bcrypt hash rather than the password', async () => {
    await registerUser(companyInput, res, ctx);
    const { passwordHash } = vi.mocked(User.create).mock.calls[0]![0] as { passwordHash: string };
    expect(passwordHash).not.toBe('Password1!');
    expect(passwordHash.startsWith('$2')).toBe(true);
  });

  it('does not leave a User behind when the CompanyProfile cannot be created', async () => {
    const boom = new Error('CompanyProfile validation failed');
    vi.mocked(CompanyProfile.create).mockRejectedValue(boom as never);

    await expect(registerUser(companyInput, res, ctx)).rejects.toThrow(boom);

    // Without the rollback this account would authenticate normally and then be
    // refused by every company route, with no way to re-register.
    expect(User.deleteOne).toHaveBeenCalledTimes(1);
    expect(String((vi.mocked(User.deleteOne).mock.calls[0]![0] as { _id: unknown })._id)).toBe(
      String(newUserId),
    );
  });

  it('reports the original failure even if the rollback also fails', async () => {
    const boom = new Error('CompanyProfile validation failed');
    vi.mocked(CompanyProfile.create).mockRejectedValue(boom as never);
    vi.mocked(User.deleteOne).mockRejectedValue(new Error('connection lost') as never);

    // The caller must not be told the signup succeeded, and must not be shown the
    // cleanup error in place of the real cause.
    await expect(registerUser(companyInput, res, ctx)).rejects.toThrow(
      'CompanyProfile validation failed',
    );
  });

  it('rejects a duplicate email before creating anything', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await expect(registerUser(companyInput, res, ctx)).rejects.toMatchObject({ statusCode: 409 });
    expect(User.create).not.toHaveBeenCalled();
    expect(CompanyProfile.create).not.toHaveBeenCalled();
  });
});

describe('registerUser — other roles keep the same guarantee', () => {
  it('rolls the User back when a StudentProfile cannot be created', async () => {
    vi.mocked(StudentProfile.create).mockRejectedValue(new Error('nope') as never);

    await expect(
      registerUser(
        {
          email: 'jane@example.com',
          password: 'Password1!',
          role: 'STUDENT',
          fullName: 'Jane Smith',
          institutionId: new Types.ObjectId().toHexString(),
        },
        res,
        ctx,
      ),
    ).rejects.toThrow('nope');

    expect(User.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('leaves a successful signup alone', async () => {
    await registerUser(
      {
        email: 'jane@example.com',
        password: 'Password1!',
        role: 'STUDENT',
        fullName: 'Jane Smith',
        institutionId: new Types.ObjectId().toHexString(),
      },
      res,
      ctx,
    );

    expect(StudentProfile.create).toHaveBeenCalledTimes(1);
    expect(User.deleteOne).not.toHaveBeenCalled();
  });
});

/**
 * The signup → login handoff, with bcrypt left real on purpose. The hash that
 * `registerUser` writes is fed straight back to `loginUser`, so this is the one
 * assertion that would catch a mismatch between how the password is stored and
 * how it is checked — the failure mode behind "signup worked but login says
 * invalid credentials".
 */
describe('loginUser — the credentials a COMPANY signed up with', () => {
  /** Mirrors `User.findOne(...).select('+passwordHash +refreshTokenVersion')`. */
  function loginRow(passwordHash: string, overrides: Record<string, unknown> = {}) {
    const doc = {
      _id: newUserId,
      email: 'hiring@acme.com',
      role: 'COMPANY',
      isActive: true,
      passwordHash,
      refreshTokenVersion: 0,
      lastLoginAt: undefined as Date | undefined,
      save: vi.fn(() => Promise.resolve()),
      toJSON: () => ({ id: String(newUserId), email: 'hiring@acme.com', role: 'COMPANY' }),
      ...overrides,
    };
    vi.mocked(User.findOne).mockReturnValue({ select: () => Promise.resolve(doc) } as never);
    return doc;
  }

  /** Registers the company and hands back the hash that was actually stored. */
  async function storedHash(): Promise<string> {
    await registerUser(companyInput, res, ctx);
    const { passwordHash } = vi.mocked(User.create).mock.calls[0]![0] as { passwordHash: string };
    vi.clearAllMocks();
    vi.mocked(AuditLog.create).mockResolvedValue({} as never);
    return passwordHash;
  }

  it('accepts the registered password and reports the COMPANY role', async () => {
    const doc = loginRow(await storedHash());

    const result = (await loginUser(
      { email: 'Hiring@Acme.com', password: 'Password1!' },
      res,
      ctx,
    )) as { role: string; email: string };

    expect(result.role).toBe('COMPANY');
    expect(result.email).toBe('hiring@acme.com');
    // The JWT is minted from this doc, so the role in the token is the role here.
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.lastLoginAt).toBeInstanceOf(Date);
  });

  it('looks the account up by its lowercased email', async () => {
    loginRow(await storedHash());
    await loginUser({ email: 'HIRING@ACME.COM', password: 'Password1!' }, res, ctx);
    expect(vi.mocked(User.findOne).mock.calls[0]![0]).toEqual({ email: 'hiring@acme.com' });
  });

  it('rejects the wrong password with 401 and does not touch the account', async () => {
    const doc = loginRow(await storedHash());
    await expect(
      loginUser({ email: 'hiring@acme.com', password: 'Password2!' }, res, ctx),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('rejects a deactivated company with the same message as a bad password', async () => {
    loginRow(await storedHash(), { isActive: false });
    await expect(
      loginUser({ email: 'hiring@acme.com', password: 'Password1!' }, res, ctx),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
  });

  it('rejects an unknown email without revealing that it is unknown', async () => {
    vi.mocked(User.findOne).mockReturnValue({ select: () => Promise.resolve(null) } as never);
    await expect(
      loginUser({ email: 'nobody@acme.com', password: 'Password1!' }, res, ctx),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
  });
});

/**
 * `/auth/me` is what the frontend rehydrates from on every page load, and the
 * company dashboard and opportunity forms key off `companyProfile`. If it comes
 * back absent the app looks signed in but cannot act as a company.
 */
describe('getCurrentUser — COMPANY payload', () => {
  function userRow(role: string) {
    return {
      _id: newUserId,
      email: 'hiring@acme.com',
      role,
      toJSON: () => ({ id: String(newUserId), email: 'hiring@acme.com', role }),
    };
  }

  it('returns the company profile alongside the user', async () => {
    vi.mocked(User.findById).mockResolvedValue(userRow('COMPANY') as never);
    const profileId = new Types.ObjectId();
    vi.mocked(CompanyProfile.findOne).mockResolvedValue({
      toJSON: () => ({ id: String(profileId), companyName: 'Acme Corp', user: String(newUserId) }),
    } as never);

    const result = (await getCurrentUser(String(newUserId))) as {
      user: { role: string };
      companyProfile: { companyName: string; user: string } | null;
    };

    // Resolved by User id, which is the same key every company route uses.
    expect(vi.mocked(CompanyProfile.findOne).mock.calls[0]![0]).toEqual({ user: newUserId });
    expect(result.user.role).toBe('COMPANY');
    expect(result.companyProfile?.companyName).toBe('Acme Corp');
    expect(result.companyProfile?.user).toBe(String(newUserId));
  });

  it('reports a missing profile as null rather than throwing', async () => {
    vi.mocked(User.findById).mockResolvedValue(userRow('COMPANY') as never);
    vi.mocked(CompanyProfile.findOne).mockResolvedValue(null as never);

    // An account in this state can sign in and then 404 on every company route.
    // /auth/me still has to answer, so the client can render something sane, but
    // the service logs it at error level for whoever has to repair the account.
    const result = (await getCurrentUser(String(newUserId))) as { companyProfile: unknown };
    expect(result.companyProfile).toBeNull();
  });

  it('does not look for a company profile for a STUDENT', async () => {
    vi.mocked(User.findById).mockResolvedValue(userRow('STUDENT') as never);
    vi.mocked(StudentProfile.findOne).mockResolvedValue({
      toJSON: () => ({ fullName: 'Jane Smith' }),
    } as never);

    const result = (await getCurrentUser(String(newUserId))) as {
      studentProfile: { fullName: string };
    };
    expect(result.studentProfile.fullName).toBe('Jane Smith');
    expect(CompanyProfile.findOne).not.toHaveBeenCalled();
  });

  it('404s when the token names a user who no longer exists', async () => {
    vi.mocked(User.findById).mockResolvedValue(null as never);
    await expect(getCurrentUser(String(newUserId))).rejects.toMatchObject({ statusCode: 404 });
  });
});
