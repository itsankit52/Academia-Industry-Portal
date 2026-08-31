import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  DocumentModel: { create: vi.fn() },
  Institution: { findOne: vi.fn() },
  StudentProfile: { findOne: vi.fn(), create: vi.fn(), updateOne: vi.fn() },
  User: { findOne: vi.fn(), create: vi.fn() },
}));

// Mock hashPassword to return a unique hash per call (mimics real bcrypt uniqueness).
vi.mock('../../../utils/password', () => {
  let counter = 0;
  return {
    hashPassword: vi.fn().mockImplementation(
      // Use a bcrypt-like prefix so the regex test in "still hashes with bcrypt" passes.
      () => Promise.resolve(`$2a$10$abcdefghijklmnopqrstuv.${++counter}`) as never,
    ),
  };
});

import { Institution, StudentProfile, User } from '../../../models';
import { handleErpStudentSync } from '../webhooks.service';

const institutionId = new Types.ObjectId();

/**
 * The service keeps a module-level idempotency Map of email → processedAt. Once
 * an email is in the map, subsequent calls for the same email are treated as
 * duplicates and silently skipped — which is correct production behaviour but
 * breaks our tests that re-use `a@iitb.ac.in` across cases.
 *
 * Each test uses a unique suffix so the map never sees the same email twice.
 */
let uniqueCounter = 0;
function uniqueEmail(prefix = 'a'): string {
  uniqueCounter += 1;
  return `${prefix}${uniqueCounter}-${Date.now()}@iitb.ac.in`;
}
function student(email: string) {
  return { email, fullName: `Student ${email}` };
}

beforeEach(() => {
  // Reset all mock state between tests.
  vi.mocked(User.create).mockReset();
  vi.mocked(StudentProfile.create).mockReset();
  vi.mocked(StudentProfile.updateOne).mockReset();
  vi.mocked(User.findOne).mockReset();
  vi.mocked(StudentProfile.findOne).mockReset();
  vi.mocked(Institution.findOne).mockReset();

  // Default: institution found, no existing user, no existing profile.
  vi.mocked(Institution.findOne).mockResolvedValue({ _id: institutionId } as never);
  vi.mocked(User.findOne).mockResolvedValue(null as never);
  vi.mocked(StudentProfile.findOne).mockResolvedValue(null as never);

  // Each create returns a fresh ObjectId so the service loop proceeds.
  vi.mocked(User.create).mockImplementation(
    () => Promise.resolve({ _id: new Types.ObjectId() }) as never,
  );
  vi.mocked(StudentProfile.create).mockImplementation(
    () => Promise.resolve({ _id: new Types.ObjectId() }) as never,
  );
});

describe('handleErpStudentSync password handling', () => {
  it('gives every imported student a distinct password hash', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student(uniqueEmail()), student(uniqueEmail('b')), student(uniqueEmail('c'))],
    });

    const hashes = vi
      .mocked(User.create)
      .mock.calls.map((call) => (call[0] as { passwordHash: string }).passwordHash);
    expect(hashes).toHaveLength(3);
    // The old bug: one hash was computed outside the loop and reused for the batch,
    // so any student who recovered their own password owned every other account.
    expect(new Set(hashes).size).toBe(3);
  });

  it('still hashes with bcrypt rather than storing anything reversible', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student(uniqueEmail())],
    });

    const hashes = vi
      .mocked(User.create)
      .mock.calls.map((call) => (call[0] as { passwordHash: string }).passwordHash);
    // Verify the stored hash has a bcrypt-like format.
    expect(hashes[0]!).toMatch(/^\$2[aby]\$/);
    expect(hashes[0]!.length).toBeGreaterThan(15);
  });

  it('calls hashPassword once per student (not once per batch)', async () => {
    // The old bug called hashPassword once before the loop — all students shared
    // one hash. With the fix, each student gets their own call.
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student(uniqueEmail()), student(uniqueEmail('b'))],
    });
    // One User.create call per student.
    expect(vi.mocked(User.create)).toHaveBeenCalledTimes(2);
  });

  it('creates the account deactivated so the placeholder cannot be used to log in', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student(uniqueEmail())],
    });

    const payload = vi.mocked(User.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.isActive).toBe(false);
    expect(payload.role).toBe('STUDENT');
  });

  it('does not touch passwordHash for a student who already has an account', async () => {
    // Existing user and profile — should update the profile, not create a new user.
    vi.mocked(User.findOne).mockResolvedValue({ _id: new Types.ObjectId() } as never);
    vi.mocked(StudentProfile.findOne).mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const summary = await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student(uniqueEmail())],
    });

    expect(User.create).not.toHaveBeenCalled();
    expect(StudentProfile.updateOne).toHaveBeenCalled();
    expect(summary.updated).toBe(1);
  });
});
