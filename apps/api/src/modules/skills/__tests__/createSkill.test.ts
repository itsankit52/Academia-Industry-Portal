import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  skillFindOne: vi.fn(),
  skillCreate: vi.fn(),
}));

vi.mock('../../../models', () => ({
  Skill: {
    findOne: mocks.skillFindOne,
    create: mocks.skillCreate,
  },
}));

import { AppError } from '../../../utils/AppError';
import { createSkill } from '../skills.service';
import type { SkillCategory } from '@aip/config';

function skillDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    toJSON: () => ({
      id: '507f1f77bcf86cd799439022',
      name: 'react',
      category: 'FRONTEND' as SkillCategory,
      description: 'Component-based library.',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    }),
    ...overrides,
  };
}

describe('createSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the name in lowercase regardless of input casing', async () => {
    mocks.skillFindOne.mockResolvedValue(null);
    mocks.skillCreate.mockResolvedValue(skillDoc({ name: 'react' }));

    await createSkill({ name: 'React', category: 'FRONTEND' });
    expect(mocks.skillCreate).toHaveBeenCalledWith({
      name: 'react',
      category: 'FRONTEND',
    });
  });

  it('trims whitespace from the name', async () => {
    mocks.skillFindOne.mockResolvedValue(null);
    mocks.skillCreate.mockResolvedValue(skillDoc({ name: 'react' }));

    await createSkill({ name: '  React  ', category: 'FRONTEND' });
    expect(mocks.skillCreate).toHaveBeenCalledWith({
      name: 'react',
      category: 'FRONTEND',
    });
  });

  it('throws conflict when a case-insensitive duplicate exists', async () => {
    mocks.skillFindOne.mockResolvedValue(skillDoc({ name: 'react' }));

    await expect(createSkill({ name: 'REACT', category: 'FRONTEND' })).rejects.toMatchObject({
      statusCode: 409,
    });

    await expect(createSkill({ name: '  React  ', category: 'FRONTEND' })).rejects.toMatchObject({
      statusCode: 409,
    });

    // create must never have been called
    expect(mocks.skillCreate).not.toHaveBeenCalled();
  });

  it('returns the created skill JSON', async () => {
    mocks.skillFindOne.mockResolvedValue(null);
    mocks.skillCreate.mockResolvedValue(skillDoc({ name: 'next.js', category: 'FRONTEND' }));

    const result = await createSkill({ name: 'Next.js', category: 'FRONTEND' });
    expect(result.name).toBe('next.js');
    expect(result.category).toBe('FRONTEND');
    expect(result).not.toHaveProperty('_id');
    expect(result).toHaveProperty('id');
  });

  it('preserves description when provided', async () => {
    mocks.skillFindOne.mockResolvedValue(null);
    mocks.skillCreate.mockResolvedValue(
      skillDoc({ name: 'rust', description: 'Systems language.' }),
    );

    await createSkill({
      name: 'Rust',
      category: 'PROGRAMMING',
      description: 'Systems language.',
    });
    expect(mocks.skillCreate).toHaveBeenCalledWith({
      name: 'rust',
      category: 'PROGRAMMING',
      description: 'Systems language.',
    });
  });
});
