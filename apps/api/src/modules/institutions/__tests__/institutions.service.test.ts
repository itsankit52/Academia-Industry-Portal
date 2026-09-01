/**
 * Phase 20 — Institution Onboarding Tests
 *
 * Verifies:
 *   1. Unique institution code generation
 *   2. Institution code verification (positive/negative cases)
 *   3. assertInstitutionAndCode (server-side code+id relationship)
 *   4. Code case-insensitivity
 *   5. Code uniqueness
 *   6. List verified public institutions
 */

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the Institution model ───────────────────────────────────────────────
vi.mock('../../../models', () => ({
  Institution: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn() },
}));

import { Institution } from '../../../models';
import {
  generateUniqueInstitutionCode,
  verifyInstitutionCode,
  assertInstitutionAndCode,
  listVerifiedPublic,
} from '../institutions.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateUniqueInstitutionCode', () => {
  it('returns a code matching the pattern [A-Z]{2}[0-9]{5}', async () => {
    vi.mocked(Institution.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);

    const code = await generateUniqueInstitutionCode();
    expect(code).toMatch(/^[A-Z]{2}\d{5}$/);
  });

  it('does not return a code that already exists', async () => {
    // Simulate that the first 3 attempts find a match, 4th attempt succeeds
    let callCount = 0;
    vi.mocked(Institution.findOne).mockImplementation(((query: { code: string }) => {
      callCount++;
      if (callCount <= 3) {
        return {
          select: () => ({ lean: () => Promise.resolve({ _id: new Types.ObjectId() }) }),
        } as never;
      }
      return {
        select: () => ({ lean: () => Promise.resolve(null) }),
      } as never;
    }) as never);

    const code = await generateUniqueInstitutionCode();
    expect(code).toMatch(/^[A-Z]{2}\d{5}$/);
    // findOne was called 4 times (3 collisions + 1 success)
    expect(Institution.findOne).toHaveBeenCalledTimes(4);
  });

  it('throws after max attempts if a unique code cannot be generated', async () => {
    // Always return a collision
    vi.mocked(Institution.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: new Types.ObjectId() }) }),
    } as never);

    await expect(generateUniqueInstitutionCode()).rejects.toThrow(/unique institution code/);
  });
});

describe('verifyInstitutionCode', () => {
  it('returns valid: true with institution details for a known code', async () => {
    const id = new Types.ObjectId();
    vi.mocked(Institution.findOne).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: id, name: 'Test College' }),
      }),
    } as never);

    const result = await verifyInstitutionCode('ab12345');
    expect(result.valid).toBe(true);
    expect(result.institution?.id).toBe(String(id));
    expect(result.institution?.name).toBe('Test College');
    // The code passed to findOne should be normalized to uppercase
    expect(vi.mocked(Institution.findOne).mock.calls[0]![0]).toEqual({ code: 'AB12345' });
  });

  it('returns valid: false when institution does not exist', async () => {
    vi.mocked(Institution.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);

    const result = await verifyInstitutionCode('UNKNOWN');
    expect(result.valid).toBe(false);
    expect(result.institution).toBeUndefined();
  });

  it('returns valid: false for empty or invalid code', async () => {
    expect((await verifyInstitutionCode('')).valid).toBe(false);
    expect((await verifyInstitutionCode('ab')).valid).toBe(false); // too short
    expect((await verifyInstitutionCode('ab@12345')).valid).toBe(false); // bad chars
  });

  it('trims whitespace before lookup', async () => {
    const id = new Types.ObjectId();
    vi.mocked(Institution.findOne).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: id, name: 'Test College' }),
      }),
    } as never);

    const result = await verifyInstitutionCode('  AB12345  ');
    expect(result.valid).toBe(true);
    expect(vi.mocked(Institution.findOne).mock.calls[0]![0]).toEqual({ code: 'AB12345' });
  });
});

describe('assertInstitutionAndCode', () => {
  it('does not throw when institution and code match', async () => {
    const id = new Types.ObjectId();
    vi.mocked(Institution.findById).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: id, code: 'AB12345' }),
      }),
    } as never);

    await expect(assertInstitutionAndCode(id.toHexString(), 'ab12345')).resolves.toBeUndefined();
  });

  it('throws when institution not found', async () => {
    vi.mocked(Institution.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);

    await expect(
      assertInstitutionAndCode(new Types.ObjectId().toHexString(), 'AB12345'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/not found/i),
    });
  });

  it('throws when code does not match', async () => {
    const id = new Types.ObjectId();
    vi.mocked(Institution.findById).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: id, code: 'AB12345' }),
      }),
    } as never);

    await expect(assertInstitutionAndCode(id.toHexString(), 'WRONG99')).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/does not match/i),
    });
  });
});

describe('listVerifiedPublic', () => {
  it('returns only VERIFIED institutions sorted by name', async () => {
    vi.mocked(Institution.find).mockReturnValue({
      select: () => ({
        sort: () => ({
          lean: () =>
            Promise.resolve([
              { _id: new Types.ObjectId(), name: 'Alpha University', code: 'ALPHA01' },
              { _id: new Types.ObjectId(), name: 'Beta College', code: 'BETA0001' },
            ]),
        }),
      }),
    } as never);

    const result = await listVerifiedPublic();
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Alpha University');
    expect(result[1]?.code).toBe('BETA0001');
    // It must have filtered to verified only
    expect(Institution.find).toHaveBeenCalledWith({ verificationStatus: 'VERIFIED' });
  });
});
