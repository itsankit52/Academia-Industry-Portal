/**
 * Unit tests for auth.google.service.ts
 *
 * google-auth-library's OAuth2Client is mocked so these tests run offline
 * and do not require real Google credentials.
 */

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock google-auth-library ────────────────────────────────────────────────

const mockGetPayload = vi.fn();
const mockVerifyIdToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

// ── Mock Mongoose models ─────────────────────────────────────────────────────

vi.mock('../../../models', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
    updateOne: vi.fn(),
  },
  StudentProfile: { create: vi.fn() },
  CompanyProfile: { create: vi.fn() },
  FacultyProfile: { create: vi.fn() },
  Institution: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
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

vi.mock('../../institutions/institutions.service', () => ({
  generateUniqueInstitutionCode: vi.fn(() => Promise.resolve('AB12345')),
}));

// ── Mock env ─────────────────────────────────────────────────────────────────

vi.mock('../../../config/env', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    JWT_ACCESS_SECRET: 'test-secret-access-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    JWT_REFRESH_SECRET: 'test-secret-refresh-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    COOKIE_DOMAIN: '',
    COOKIE_SECURE: false,
    COOKIE_SAMESITE: 'lax',
    NODE_ENV: 'test',
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { User, CompanyProfile, StudentProfile, Institution, AuditLog } from '../../../models';
import { handleGoogleAuth, verifyGoogleIdToken } from '../auth.google.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };
const res = {} as never;

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'google-sub-123',
    email: 'user@example.com',
    email_verified: true,
    name: 'Test User',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
    ...overrides,
  };
}

function mockVerifySuccess(payloadOverrides = {}) {
  mockGetPayload.mockReturnValue(validPayload(payloadOverrides));
  mockVerifyIdToken.mockResolvedValue({ getPayload: mockGetPayload });
}

function userDoc(id: Types.ObjectId, role: string, extra: Record<string, unknown> = {}) {
  return {
    _id: id,
    email: 'user@example.com',
    role,
    isActive: true,
    refreshTokenVersion: 0,
    googleId: 'google-sub-123',
    authProvider: 'google',
    lastLoginAt: undefined as Date | undefined,
    save: vi.fn(() => Promise.resolve()),
    set: vi.fn(),
    get: vi.fn(() => undefined),
    toJSON: () => ({ id: String(id), email: 'user@example.com', role, ...extra }),
    ...extra,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AuditLog.create).mockResolvedValue({} as never);
  vi.mocked(Institution.findById).mockReturnValue({
    select: () => ({
      lean: () =>
        Promise.resolve({
          _id: new Types.ObjectId(),
          code: 'TESTCODE',
          verificationStatus: 'VERIFIED',
        }),
    }),
  } as never);
  vi.mocked(Institution.findOne).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(null) }),
  } as never);
});

describe('verifyGoogleIdToken', () => {
  it('returns claims for a valid token', async () => {
    mockVerifySuccess();
    const claims = await verifyGoogleIdToken('valid-token');
    expect(claims.sub).toBe('google-sub-123');
    expect(claims.email).toBe('user@example.com');
    expect(claims.email_verified).toBe(true);
  });

  it('throws 401 for an expired token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token used too late, 1234 > 1234: expired'));
    await expect(verifyGoogleIdToken('expired-token')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 401 for a wrong-audience token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Wrong audience: expected test-client-id'));
    await expect(verifyGoogleIdToken('wrong-aud')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 400 when email_verified is false', async () => {
    mockVerifySuccess({ email_verified: false });
    await expect(verifyGoogleIdToken('unverified-email')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 401 for a completely invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token signature'));
    await expect(verifyGoogleIdToken('garbage')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('handleGoogleAuth — existing Google account', () => {
  it('returns authenticated and sets cookies for an existing Google user', async () => {
    mockVerifySuccess();
    const userId = new Types.ObjectId();
    const doc = userDoc(userId, 'COMPANY');
    vi.mocked(User.findOne).mockReturnValue({
      select: () => Promise.resolve(doc),
    } as never);

    const result = await handleGoogleAuth({ idToken: 'valid-token' }, res, ctx);
    expect(result.status).toBe('authenticated');
    expect(doc.save).toHaveBeenCalled();
    expect(doc.lastLoginAt).toBeInstanceOf(Date);
  });

  it('throws 401 when the existing Google account is deactivated', async () => {
    mockVerifySuccess();
    const doc = { ...userDoc(new Types.ObjectId(), 'COMPANY'), isActive: false };
    vi.mocked(User.findOne).mockReturnValue({
      select: () => Promise.resolve(doc),
    } as never);

    await expect(handleGoogleAuth({ idToken: 'valid-token' }, res, ctx)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe('handleGoogleAuth — email conflict', () => {
  it('returns emailConflict when the email belongs to a local-only account', async () => {
    mockVerifySuccess();
    // No Google account found
    vi.mocked(User.findOne)
      .mockReturnValueOnce({ select: () => Promise.resolve(null) } as never) // by googleId
      .mockResolvedValueOnce({ _id: new Types.ObjectId(), isActive: true } as never); // by email

    const result = await handleGoogleAuth({ idToken: 'valid-token' }, res, ctx);
    expect(result.status).toBe('email_conflict');
    expect((result as { email: string }).email).toBe('user@example.com');
  });
});

describe('handleGoogleAuth — new user, needs role', () => {
  it('returns needs_role when no account exists and no role is provided', async () => {
    mockVerifySuccess();
    vi.mocked(User.findOne)
      .mockReturnValueOnce({ select: () => Promise.resolve(null) } as never) // no Google account
      .mockResolvedValueOnce(null as never); // no email account

    const result = await handleGoogleAuth({ idToken: 'valid-token' }, res, ctx);
    expect(result.status).toBe('needs_role');
    const r = result as { googleId: string; email: string };
    expect(r.googleId).toBe('google-sub-123');
    expect(r.email).toBe('user@example.com');
  });
});

describe('handleGoogleAuth — new COMPANY user with role', () => {
  it('creates a User and CompanyProfile, returns authenticated', async () => {
    mockVerifySuccess();
    vi.mocked(User.findOne)
      .mockReturnValueOnce({ select: () => Promise.resolve(null) } as never)
      .mockResolvedValueOnce(null as never);

    const newId = new Types.ObjectId();
    const created = userDoc(newId, 'COMPANY');
    vi.mocked(User.create).mockResolvedValue(created as never);
    vi.mocked(CompanyProfile.create).mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const result = await handleGoogleAuth(
      { idToken: 'valid-token', role: 'COMPANY', companyName: 'Acme Corp' },
      res,
      ctx,
    );
    expect(result.status).toBe('authenticated');
    expect(vi.mocked(User.create).mock.calls[0]![0]).toMatchObject({
      email: 'user@example.com',
      authProvider: 'google',
      role: 'COMPANY',
    });
    expect(CompanyProfile.create).toHaveBeenCalledTimes(1);
  });

  it('rolls back the User when CompanyProfile creation fails', async () => {
    mockVerifySuccess();
    vi.mocked(User.findOne)
      .mockReturnValueOnce({ select: () => Promise.resolve(null) } as never)
      .mockResolvedValueOnce(null as never);

    const newId = new Types.ObjectId();
    vi.mocked(User.create).mockResolvedValue(userDoc(newId, 'COMPANY') as never);
    vi.mocked(CompanyProfile.create).mockRejectedValue(new Error('DB error') as never);
    vi.mocked(User.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);

    await expect(
      handleGoogleAuth({ idToken: 'valid-token', role: 'COMPANY' }, res, ctx),
    ).rejects.toThrow('DB error');

    expect(User.deleteOne).toHaveBeenCalledWith({ _id: newId });
  });
});

describe('handleGoogleAuth — new STUDENT user with role', () => {
  it('creates a User and StudentProfile for a STUDENT with verified institution', async () => {
    mockVerifySuccess();
    vi.mocked(User.findOne)
      .mockReturnValueOnce({ select: () => Promise.resolve(null) } as never)
      .mockResolvedValueOnce(null as never);

    const instId = new Types.ObjectId();
    const newId = new Types.ObjectId();
    vi.mocked(User.create).mockResolvedValue(userDoc(newId, 'STUDENT') as never);
    vi.mocked(StudentProfile.create).mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const result = await handleGoogleAuth(
      {
        idToken: 'valid-token',
        role: 'STUDENT',
        fullName: 'Jane Smith',
        institutionId: instId.toHexString(),
        institutionCode: 'TESTCODE',
      },
      res,
      ctx,
    );
    expect(result.status).toBe('authenticated');
    expect(StudentProfile.create).toHaveBeenCalledTimes(1);
  });

  it('throws 400 when institutionId is missing for STUDENT', async () => {
    mockVerifySuccess();
    vi.mocked(User.findOne)
      .mockReturnValueOnce({ select: () => Promise.resolve(null) } as never)
      .mockResolvedValueOnce(null as never);

    await expect(
      handleGoogleAuth({ idToken: 'valid-token', role: 'STUDENT', fullName: 'Jane' }, res, ctx),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
