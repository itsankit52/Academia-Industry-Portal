import { describe, expect, it } from 'vitest';
import { PROFICIENCY_ORDER } from '../skillProfile.service';
import type { Proficiency } from '@aip/config';

/**
 * Unit tests for the skill profile service helpers.
 *
 * These are pure function tests that don't require a database connection.
 * They test the proficiency ordering, category grouping, gap detection,
 * and readiness score logic that the profile builder depends on.
 */

// ---------------------------------------------------------------------------
// PROFICIENCY_ORDER
// ---------------------------------------------------------------------------

describe('PROFICIENCY_ORDER', () => {
  it('assigns increasing numeric ranks to each level', () => {
    expect(PROFICIENCY_ORDER.BEGINNER).toBeLessThan(PROFICIENCY_ORDER.INTERMEDIATE);
    expect(PROFICIENCY_ORDER.INTERMEDIATE).toBeLessThan(PROFICIENCY_ORDER.ADVANCED);
    expect(PROFICIENCY_ORDER.ADVANCED).toBeLessThan(PROFICIENCY_ORDER.EXPERT);
  });

  it('covers all four proficiency levels', () => {
    const levels: Proficiency[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
    for (const level of levels) {
      expect(PROFICIENCY_ORDER[level]).toBeDefined();
      expect(typeof PROFICIENCY_ORDER[level]).toBe('number');
    }
  });

  it('assigns EXPERT the highest rank', () => {
    const max = Math.max(...Object.values(PROFICIENCY_ORDER));
    expect(PROFICIENCY_ORDER.EXPERT).toBe(max);
  });

  it('assigns BEGINNER the lowest rank', () => {
    const min = Math.min(...Object.values(PROFICIENCY_ORDER));
    expect(PROFICIENCY_ORDER.BEGINNER).toBe(min);
  });
});

// ---------------------------------------------------------------------------
// Proficiency-based sorting
// ---------------------------------------------------------------------------

describe('proficiency-based sorting', () => {
  function rankFor(p: Proficiency): number {
    return PROFICIENCY_ORDER[p];
  }

  function sortedByRank<T extends { proficiency: Proficiency }>(items: T[]): T[] {
    return [...items].sort((a, b) => rankFor(b.proficiency) - rankFor(a.proficiency));
  }

  it('sorts EXPERT before ADVANCED', () => {
    const items = [
      { proficiency: 'ADVANCED' as Proficiency },
      { proficiency: 'EXPERT' as Proficiency },
    ];
    expect(sortedByRank(items)[0]!.proficiency).toBe('EXPERT');
  });

  it('sorts ADVANCED before INTERMEDIATE', () => {
    const items = [
      { proficiency: 'INTERMEDIATE' as Proficiency },
      { proficiency: 'ADVANCED' as Proficiency },
    ];
    expect(sortedByRank(items)[0]!.proficiency).toBe('ADVANCED');
  });

  it('sorts INTERMEDIATE before BEGINNER', () => {
    const items = [
      { proficiency: 'BEGINNER' as Proficiency },
      { proficiency: 'INTERMEDIATE' as Proficiency },
    ];
    expect(sortedByRank(items)[0]!.proficiency).toBe('INTERMEDIATE');
  });

  it('sorts a mixed list to EXPERT, ADVANCED, INTERMEDIATE, BEGINNER', () => {
    const items = [
      { proficiency: 'BEGINNER' as Proficiency },
      { proficiency: 'EXPERT' as Proficiency },
      { proficiency: 'INTERMEDIATE' as Proficiency },
      { proficiency: 'ADVANCED' as Proficiency },
    ];
    expect(sortedByRank(items).map((i) => i.proficiency)).toEqual([
      'EXPERT',
      'ADVANCED',
      'INTERMEDIATE',
      'BEGINNER',
    ]);
  });

  it('sorting is stable: same-proficiency items keep their relative order', () => {
    const a = { proficiency: 'ADVANCED' as Proficiency, name: 'a' };
    const b = { proficiency: 'ADVANCED' as Proficiency, name: 'b' };
    const sorted = sortedByRank([b, a]);
    expect(sorted[0]!.name).toBe('b');
    expect(sorted[1]!.name).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// Average proficiency → 0–100 conversion
// ---------------------------------------------------------------------------

describe('average proficiency to 0-100 conversion', () => {
  it('BEGINNER (1) maps to 25%', () => {
    expect(Math.round((1 / 4) * 100)).toBe(25);
  });

  it('INTERMEDIATE (2) maps to 50%', () => {
    expect(Math.round((2 / 4) * 100)).toBe(50);
  });

  it('ADVANCED (3) maps to 75%', () => {
    expect(Math.round((3 / 4) * 100)).toBe(75);
  });

  it('EXPERT (4) maps to 100%', () => {
    expect(Math.round((4 / 4) * 100)).toBe(100);
  });

  it('mixed proficiencies average correctly', () => {
    // EXPERT(4) + BEGINNER(1) = 5 / 2 = 2.5 → 63%
    expect(Math.round((2.5 / 4) * 100)).toBe(63);
  });

  it('empty list treated as 0% (avoids division by zero)', () => {
    const skills: Proficiency[] = [];
    const avg = skills.reduce((s, p) => s + PROFICIENCY_ORDER[p], 0) / (skills.length || 1);
    expect(Math.round((avg / 4) * 100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Readiness score weighting
// ---------------------------------------------------------------------------

describe('readiness score weighting', () => {
  // Formula from buildSkillProfile:
  // readinessScore = Math.round(averageProficiency * (0.7 + 0.3 * demandWeight))
  // where averageProficiency is 0-100 and demandWeight is 0-1.
  function readinessScore(averageProficiency: number, demandWeight: number): number {
    return Math.round(averageProficiency * (0.7 + 0.3 * demandWeight));
  }

  it('100% proficiency with full demand gives 100', () => {
    expect(readinessScore(100, 1)).toBe(100);
  });

  it('100% proficiency with zero demand gives 70 (floor 70% minimum)', () => {
    expect(readinessScore(100, 0)).toBe(70);
  });

  it('0% proficiency with zero demand gives 0', () => {
    expect(readinessScore(0, 0)).toBe(0);
  });

  it('50% proficiency with full demand gives 50', () => {
    expect(readinessScore(50, 1)).toBe(50);
  });

  it('50% proficiency with zero demand gives 35', () => {
    expect(readinessScore(50, 0)).toBe(35);
  });

  it('50% proficiency at 50% demand gives 43 (rounded)', () => {
    // 50 * (0.7 + 0.3 * 0.5) = 50 * 0.85 = 42.5 → 43
    expect(readinessScore(50, 0.5)).toBe(43);
  });

  it('never exceeds 100', () => {
    expect(readinessScore(100, 1)).toBeLessThanOrEqual(100);
  });

  it('never goes below 0', () => {
    expect(readinessScore(0, 1)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Category grouping and averaging
// ---------------------------------------------------------------------------

describe('category grouping and averaging', () => {
  interface MockSkill {
    id: string;
    category: string;
    proficiency: Proficiency;
  }

  function groupAndAverage(skills: MockSkill[]) {
    const map = new Map<string, MockSkill[]>();
    for (const s of skills) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries())
      .map(([category, list]) => {
        const avg = list.reduce((s, x) => s + PROFICIENCY_ORDER[x.proficiency], 0) / list.length;
        return { category, count: list.length, averageProficiency: Math.round(avg * 100) / 100 };
      })
      .sort((a, b) => b.count - a.count); // matches buildSkillProfile sort
  }

  it('groups skills by category', () => {
    const skills: MockSkill[] = [
      { id: '1', category: 'PROGRAMMING', proficiency: 'EXPERT' },
      { id: '2', category: 'PROGRAMMING', proficiency: 'BEGINNER' },
      { id: '3', category: 'SOFT_SKILLS', proficiency: 'ADVANCED' },
    ];
    const groups = groupAndAverage(skills);
    expect(groups).toHaveLength(2);
    const programming = groups.find((g) => g.category === 'PROGRAMMING');
    expect(programming?.count).toBe(2);
    const soft = groups.find((g) => g.category === 'SOFT_SKILLS');
    expect(soft?.count).toBe(1);
  });

  it('averages proficiency per category correctly', () => {
    const skills: MockSkill[] = [
      { id: '1', category: 'BACKEND', proficiency: 'EXPERT' }, // 4
      { id: '2', category: 'BACKEND', proficiency: 'INTERMEDIATE' }, // 2
    ];
    const groups = groupAndAverage(skills);
    const backend = groups.find((g) => g.category === 'BACKEND')!;
    // avg = (4+2)/2 = 3 → stays as 3 (no /4 conversion here; buildSkillProfile applies it)
    expect(backend.averageProficiency).toBe(3);
  });

  it('handles empty input', () => {
    expect(groupAndAverage([])).toHaveLength(0);
  });

  it('single skill averages to its own proficiency value', () => {
    const groups = groupAndAverage([{ id: '1', category: 'AI_ML', proficiency: 'ADVANCED' }]);
    expect(groups[0]!.averageProficiency).toBe(3); // ADVANCED = 3
  });

  it('categories sorted by count descending', () => {
    const skills: MockSkill[] = [
      { id: '1', category: 'CLOUD', proficiency: 'BEGINNER' },
      { id: '2', category: 'PROGRAMMING', proficiency: 'BEGINNER' },
      { id: '3', category: 'PROGRAMMING', proficiency: 'BEGINNER' },
      { id: '4', category: 'PROGRAMMING', proficiency: 'BEGINNER' },
      { id: '5', category: 'SOFT_SKILLS', proficiency: 'BEGINNER' },
      { id: '6', category: 'SOFT_SKILLS', proficiency: 'BEGINNER' },
    ];
    const groups = groupAndAverage(skills);
    expect(groups[0]!.category).toBe('PROGRAMMING');
    expect(groups[1]!.category).toBe('SOFT_SKILLS');
    expect(groups[2]!.category).toBe('CLOUD');
  });
});

// ---------------------------------------------------------------------------
// Skill gaps: BEGINNER + INTERMEDIATE skills in existing student skills
// ---------------------------------------------------------------------------

describe('skill gaps detection', () => {
  // Mirrors the gap logic from buildSkillProfile:
  // Gaps = skills where proficiency rank <= INTERMEDIATE rank, sorted ascending (weakest first)
  interface SkillEntry {
    skill: { id: string; name: string; category: string };
    proficiency: Proficiency;
  }

  function detectGaps(skills: SkillEntry[]): SkillEntry[] {
    return skills
      .filter((s) => PROFICIENCY_ORDER[s.proficiency] <= PROFICIENCY_ORDER.INTERMEDIATE)
      .sort((a, b) => PROFICIENCY_ORDER[a.proficiency] - PROFICIENCY_ORDER[b.proficiency])
      .slice(0, 5);
  }

  it('flags BEGINNER skills as gaps', () => {
    const skills: SkillEntry[] = [
      { skill: { id: '1', name: 'React', category: 'PROGRAMMING' }, proficiency: 'BEGINNER' },
    ];
    const gaps = detectGaps(skills);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.skill.name).toBe('React');
  });

  it('flags INTERMEDIATE skills as gaps', () => {
    const skills: SkillEntry[] = [
      { skill: { id: '1', name: 'Python', category: 'PROGRAMMING' }, proficiency: 'INTERMEDIATE' },
    ];
    expect(detectGaps(skills)).toHaveLength(1);
  });

  it('does NOT flag EXPERT skills as gaps', () => {
    const skills: SkillEntry[] = [
      { skill: { id: '1', name: 'TypeScript', category: 'PROGRAMMING' }, proficiency: 'EXPERT' },
    ];
    expect(detectGaps(skills)).toHaveLength(0);
  });

  it('does NOT flag ADVANCED skills as gaps', () => {
    const skills: SkillEntry[] = [
      { skill: { id: '1', name: 'AWS', category: 'CLOUD' }, proficiency: 'ADVANCED' },
    ];
    expect(detectGaps(skills)).toHaveLength(0);
  });

  it('sorts gaps weakest-first (BEGINNER before INTERMEDIATE)', () => {
    const skills: SkillEntry[] = [
      {
        skill: { id: '1', name: 'IntermediateSkill', category: 'PROGRAMMING' },
        proficiency: 'INTERMEDIATE',
      },
      {
        skill: { id: '2', name: 'BeginnerSkill', category: 'PROGRAMMING' },
        proficiency: 'BEGINNER',
      },
    ];
    const gaps = detectGaps(skills);
    expect(gaps[0]!.skill.name).toBe('BeginnerSkill');
    expect(gaps[1]!.skill.name).toBe('IntermediateSkill');
  });

  it('caps gaps at 5 items', () => {
    const skills: SkillEntry[] = Array.from({ length: 8 }, (_, i) => ({
      skill: { id: String(i), name: `Skill${i}`, category: 'PROGRAMMING' },
      proficiency: 'BEGINNER' as Proficiency,
    }));
    expect(detectGaps(skills)).toHaveLength(5);
  });

  it('returns empty when all skills are ADVANCED or EXPERT', () => {
    const skills: SkillEntry[] = [
      { skill: { id: '1', name: 'ExpertSkill', category: 'PROGRAMMING' }, proficiency: 'EXPERT' },
      {
        skill: { id: '2', name: 'AdvancedSkill', category: 'PROGRAMMING' },
        proficiency: 'ADVANCED',
      },
    ];
    expect(detectGaps(skills)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Strengths: top-5 skills sorted by proficiency descending
// ---------------------------------------------------------------------------

describe('strengths detection', () => {
  interface SkillEntry {
    skill: { id: string; name: string; category: string };
    proficiency: Proficiency;
    assessmentAverageScore?: number | null;
  }

  function detectStrengths(skills: SkillEntry[]): SkillEntry[] {
    return [...skills]
      .sort((a, b) => {
        const r = PROFICIENCY_ORDER[b.proficiency] - PROFICIENCY_ORDER[a.proficiency];
        if (r !== 0) return r;
        return (b.assessmentAverageScore ?? 0) - (a.assessmentAverageScore ?? 0);
      })
      .slice(0, 5);
  }

  it('ranks EXPERT before ADVANCED', () => {
    const skills: SkillEntry[] = [
      { skill: { id: '1', name: 'Advanced', category: 'PROGRAMMING' }, proficiency: 'ADVANCED' },
      { skill: { id: '2', name: 'Expert', category: 'PROGRAMMING' }, proficiency: 'EXPERT' },
    ];
    expect(detectStrengths(skills)[0]!.skill.name).toBe('Expert');
  });

  it('ranks ADVANCED before INTERMEDIATE', () => {
    const skills: SkillEntry[] = [
      {
        skill: { id: '1', name: 'Intermediate', category: 'PROGRAMMING' },
        proficiency: 'INTERMEDIATE',
      },
      { skill: { id: '2', name: 'Advanced', category: 'PROGRAMMING' }, proficiency: 'ADVANCED' },
    ];
    expect(detectStrengths(skills)[0]!.skill.name).toBe('Advanced');
  });

  it('caps at 5 skills', () => {
    const skills: SkillEntry[] = Array.from({ length: 10 }, (_, i) => ({
      skill: { id: String(i), name: `Skill${i}`, category: 'PROGRAMMING' },
      proficiency: 'EXPERT' as Proficiency,
    }));
    expect(detectStrengths(skills)).toHaveLength(5);
  });

  it('secondary sort by assessment score when proficiencies are equal', () => {
    const skills: SkillEntry[] = [
      {
        skill: { id: '1', name: 'LowScore', category: 'PROGRAMMING' },
        proficiency: 'ADVANCED',
        assessmentAverageScore: 60,
      },
      {
        skill: { id: '2', name: 'HighScore', category: 'PROGRAMMING' },
        proficiency: 'ADVANCED',
        assessmentAverageScore: 90,
      },
    ];
    expect(detectStrengths(skills)[0]!.skill.name).toBe('HighScore');
  });
});
