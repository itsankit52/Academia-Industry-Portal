import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.hoisted ensures the mock fns are available when the hoisted vi.mock runs.
const mocks = vi.hoisted(() => ({
  skillFindOne: vi.fn(),
  studentSkillFindOne: vi.fn(),
  studentSkillCreate: vi.fn(),
  studentProfileFindOne: vi.fn(),
}));

vi.mock('../../../models', () => ({
  Skill: { findOne: mocks.skillFindOne },
  StudentSkill: {
    findOne: mocks.studentSkillFindOne,
    create: mocks.studentSkillCreate,
  },
  StudentProfile: { findOne: mocks.studentProfileFindOne },
}));

import { AppError } from '../../../utils/AppError';
import { addMyStudentSkillByName } from '../skills.service';

const STUDENT_OBJECT_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439099';
const SKILL_OBJECT_ID = '507f1f77bcf86cd799439022';

function mockStudentProfile() {
  mocks.studentProfileFindOne.mockReturnValue({
    select: () => Promise.resolve({ _id: STUDENT_OBJECT_ID }),
  });
}

describe('addMyStudentSkillByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentProfile();
  });

  it('throws bad-request for empty name', async () => {
    await expect(addMyStudentSkillByName(USER_ID, '')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(addMyStudentSkillByName(USER_ID, '   ')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws not-found when the skill is not in the catalogue', async () => {
    mocks.skillFindOne.mockReturnValue({ select: () => Promise.resolve(null) });
    await expect(addMyStudentSkillByName(USER_ID, 'Klingon Battle Poetry')).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(addMyStudentSkillByName(USER_ID, 'Klingon Battle Poetry')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('looks up the skill case-insensitively (lowercases before query)', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(null));
    mocks.studentSkillCreate.mockImplementation((doc: Record<string, unknown>) => ({
      toJSON: () => ({ ...doc }),
      populate: async () => ({ toJSON: () => ({ ...doc }) }),
    }));

    await addMyStudentSkillByName(USER_ID, 'JavaScript');

    expect(mocks.skillFindOne).toHaveBeenCalledWith({ name: 'javascript' });
  });

  it('trims surrounding whitespace before lookup', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(null));
    mocks.studentSkillCreate.mockImplementation((doc: Record<string, unknown>) => ({
      toJSON: () => ({ ...doc }),
      populate: async () => ({ toJSON: () => ({ ...doc }) }),
    }));

    await addMyStudentSkillByName(USER_ID, '   TypeScript   ');

    expect(mocks.skillFindOne).toHaveBeenCalledWith({ name: 'typescript' });
  });

  it('creates a new StudentSkill when the catalogue has it and the student has not added it', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(null));
    mocks.studentSkillCreate.mockImplementation((doc: Record<string, unknown>) => ({
      _id: 'newStudentSkillId',
      toJSON: () => ({ _id: 'newStudentSkillId', ...doc }),
      populate: async () => ({
        toJSON: () => ({ _id: 'newStudentSkillId', ...doc, skill: { name: 'react' } }),
      }),
    }));

    const result = await addMyStudentSkillByName(USER_ID, 'react', 'INTERMEDIATE');

    expect(result.created).toBe(true);
    expect(result.studentSkill).toBeDefined();
    expect(mocks.studentSkillCreate).toHaveBeenCalledWith({
      student: STUDENT_OBJECT_ID,
      skill: SKILL_OBJECT_ID,
      proficiency: 'INTERMEDIATE',
    });
  });

  it('defaults proficiency to BEGINNER when none provided', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(null));
    mocks.studentSkillCreate.mockImplementation((doc: Record<string, unknown>) => ({
      toJSON: () => ({ ...doc }),
      populate: async () => ({ toJSON: () => ({ ...doc }) }),
    }));

    await addMyStudentSkillByName(USER_ID, 'react');

    expect(mocks.studentSkillCreate).toHaveBeenCalledWith({
      student: STUDENT_OBJECT_ID,
      skill: SKILL_OBJECT_ID,
      proficiency: 'BEGINNER',
    });
  });

  it('returns the existing StudentSkill (created=false) when the student already has the skill', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    const existingDoc = {
      _id: 'existingId',
      toJSON: () => ({ _id: 'existingId', proficiency: 'ADVANCED' }),
      populate: async () => ({ toJSON: () => ({ _id: 'existingId', proficiency: 'ADVANCED' }) }),
    };
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(existingDoc));

    const result = await addMyStudentSkillByName(USER_ID, 'react', 'EXPERT');

    expect(result.created).toBe(false);
    // Crucially, StudentSkill.create is NOT called when the skill already exists —
    // the resume bulk-add flow must never overwrite the student's stored proficiency.
    expect(mocks.studentSkillCreate).not.toHaveBeenCalled();
  });

  it('does NOT overwrite existing proficiency when the skill is already added', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    const existingDoc = {
      _id: 'existingId',
      toJSON: () => ({ _id: 'existingId', proficiency: 'ADVANCED' }),
      populate: async () => ({ toJSON: () => ({ _id: 'existingId', proficiency: 'ADVANCED' }) }),
    };
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(existingDoc));

    const result = await addMyStudentSkillByName(USER_ID, 'react', 'BEGINNER');

    expect(result.created).toBe(false);
    expect(mocks.studentSkillCreate).not.toHaveBeenCalled();
  });

  it('queries existing StudentSkill by both student and skill ids', async () => {
    mocks.skillFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: SKILL_OBJECT_ID }),
    });
    mocks.studentSkillFindOne.mockReturnValue(Promise.resolve(null));
    mocks.studentSkillCreate.mockImplementation((doc: Record<string, unknown>) => ({
      toJSON: () => ({ ...doc }),
      populate: async () => ({ toJSON: () => ({ ...doc }) }),
    }));

    await addMyStudentSkillByName(USER_ID, 'python');

    expect(mocks.studentSkillFindOne).toHaveBeenCalledWith({
      student: STUDENT_OBJECT_ID,
      skill: SKILL_OBJECT_ID,
    });
  });

  it('throws not-found when the user has no student profile', async () => {
    mocks.studentProfileFindOne.mockReturnValue({
      select: () => Promise.resolve(null),
    });
    await expect(addMyStudentSkillByName(USER_ID, 'react')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
