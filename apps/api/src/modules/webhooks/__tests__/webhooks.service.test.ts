import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  DocumentModel: { create: vi.fn() },
  Institution: { findOne: vi.fn() },
  StudentProfile: { findOne: vi.fn(), create: vi.fn(), updateOne: vi.fn() },
  User: { findOne: vi.fn(), create: vi.fn() },
}));

import { Institution, StudentProfile, User } from '../../../models';
import { handleErpStudentSync } from '../webhooks.service';

const institutionId = new Types.ObjectId();

function student(email: string) {
  return { email, fullName: `Student ${email}` };
}

/** Collects the `passwordHash` handed to every `User.create` call. */
function createdHashes(): string[] {
  return vi
    .mocked(User.create)
    .mock.calls.map((call) => (call[0] as { passwordHash: string }).passwordHash);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Institution.findOne).mockResolvedValue({ _id: institutionId } as never);
  // No account and no profile exists yet, so every entry takes the create path.
  vi.mocked(User.findOne).mockResolvedValue(null as never);
  vi.mocked(StudentProfile.findOne).mockResolvedValue(null as never);
  vi.mocked(User.create).mockImplementation((() =>
    Promise.resolve({ _id: new Types.ObjectId() })) as never);
  vi.mocked(StudentProfile.create).mockImplementation((() =>
    Promise.resolve({ _id: new Types.ObjectId() })) as never);
});

describe('handleErpStudentSync password handling', () => {
  it('gives every imported student a distinct password hash', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student('a@iitb.ac.in'), student('b@iitb.ac.in'), student('c@iitb.ac.in')],
    });

    const hashes = createdHashes();
    expect(hashes).toHaveLength(3);
    // The bug: one hash was computed outside the loop and reused for the batch,
    // so any student who recovered their own password owned every other account.
    expect(new Set(hashes).size).toBe(3);
  });

  it('still hashes with bcrypt rather than storing anything reversible', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student('a@iitb.ac.in')],
    });

    const hash = createdHashes()[0]!;
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('does not derive the secret from the clock, which is guessable', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student('a@iitb.ac.in')],
    });

    const hash = createdHashes()[0]!;
    // The old placeholder was `!erp-${Date.now()}-${Math.random()...}`. Anyone who
    // knew roughly when the import ran could brute-force the timestamp half.
    const now = Date.now();
    for (let offset = -2000; offset <= 2000; offset += 500) {
      expect(await bcrypt.compare(`!erp-${now + offset}-`, hash)).toBe(false);
    }
  });

  it('creates the account deactivated so the placeholder cannot be used to log in', async () => {
    await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student('a@iitb.ac.in')],
    });

    const payload = vi.mocked(User.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.isActive).toBe(false);
    expect(payload.role).toBe('STUDENT');
  });

  it('does not touch passwordHash for a student who already has an account', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ _id: new Types.ObjectId() } as never);
    vi.mocked(StudentProfile.findOne).mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const summary = await handleErpStudentSync({
      institutionCode: 'IITB',
      students: [student('a@iitb.ac.in')],
    });

    expect(User.create).not.toHaveBeenCalled();
    expect(StudentProfile.updateOne).toHaveBeenCalled();
    expect(summary.updated).toBe(1);
  });
});
