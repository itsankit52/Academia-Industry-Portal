import { describe, expect, it } from 'vitest';
import {
  computeFullMatch,
  checkEligibility,
  scoreSoftSkills,
  scoreCareerInterests,
  type FullMatchInput,
} from '../fullMatch';

function tSkill(id: string, name: string) {
  return { id, name };
}

function soft(name: string) {
  return { name };
}

function gapNames<T extends { name: string }>(list: T[]): string[] {
  return list.map((s) => s.name).sort();
}

// ---------------------------------------------------------------------------
// checkEligibility
// ---------------------------------------------------------------------------

describe('checkEligibility', () => {
  it('passes when every criterion is met', () => {
    const r = checkEligibility({
      studentCgpa: 8.5,
      requiredCgpa: 8.0,
      eligibleBranches: ['Computer Science', 'IT'],
      studentBranch: 'Computer Science',
      eligibleGradYears: [2024, 2025],
      studentGraduationYear: 2025,
      eligibleDegrees: ['B.Tech', 'B.E.'],
      studentDegree: 'B.Tech',
    });
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it('fails CGPA when student is below threshold', () => {
    const r = checkEligibility({
      studentCgpa: 7.0,
      requiredCgpa: 8.0,
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toContain('CGPA 7 is below the required 8');
  });

  it('fails branch when student branch is not in eligible list', () => {
    const r = checkEligibility({
      eligibleBranches: ['Computer Science', 'IT'],
      studentBranch: 'Electrical Engineering',
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toContain(
      'Branch "Electrical Engineering" is not among the eligible branches',
    );
  });

  it('fails graduation year when student year is not in eligible list', () => {
    const r = checkEligibility({
      eligibleGradYears: [2024, 2025],
      studentGraduationYear: 2026,
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toContain('Graduation year 2026 is not in the eligible years list');
  });

  it('fails degree when student degree is not in eligible list', () => {
    const r = checkEligibility({
      eligibleDegrees: ['B.Tech', 'M.Tech'],
      studentDegree: 'B.Sc',
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toContain('Degree "B.Sc" is not among the eligible degrees');
  });

  it('accumulates multiple failures', () => {
    const r = checkEligibility({
      studentCgpa: 6.0,
      requiredCgpa: 8.0,
      eligibleBranches: ['Computer Science'],
      studentBranch: 'Civil',
      eligibleGradYears: [2024],
      studentGraduationYear: 2023,
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toHaveLength(3);
  });

  it('ignores null/undefined student fields', () => {
    const r = checkEligibility({
      studentCgpa: null,
      requiredCgpa: 8.0,
    });
    // null cgpa does not fail — it just means the data is not available
    expect(r.passed).toBe(true);
  });

  it('ignores empty eligibleBranches array', () => {
    const r = checkEligibility({
      eligibleBranches: [],
      studentBranch: 'Any Branch',
    });
    expect(r.passed).toBe(true);
  });

  it('ignores empty eligibleGradYears array', () => {
    const r = checkEligibility({
      eligibleGradYears: [],
      studentGraduationYear: 2025,
    });
    expect(r.passed).toBe(true);
  });

  it('ignores empty eligibleDegrees array', () => {
    const r = checkEligibility({
      eligibleDegrees: [],
      studentDegree: 'Any Degree',
    });
    expect(r.passed).toBe(true);
  });

  it('treats missing opportunity fields as open (no failure)', () => {
    const r = checkEligibility({
      studentCgpa: 6.0,
      requiredCgpa: undefined,
      eligibleBranches: undefined,
      studentBranch: 'Civil',
      eligibleGradYears: undefined,
      studentGraduationYear: 2025,
    });
    expect(r.passed).toBe(true);
  });

  it('ignores undefined requiredCgpa even when studentCgpa is lower', () => {
    const r = checkEligibility({
      studentCgpa: 6.0,
      requiredCgpa: undefined,
    });
    expect(r.passed).toBe(true);
  });

  it('case-insensitive branch matching', () => {
    const r = checkEligibility({
      eligibleBranches: ['COMPUTER SCIENCE', 'it'],
      studentBranch: 'computer science',
    });
    expect(r.passed).toBe(true);
  });

  it('case-insensitive degree matching', () => {
    const r = checkEligibility({
      eligibleDegrees: ['B.TECH', 'b.e.'],
      studentDegree: 'b.tech',
    });
    expect(r.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scoreSoftSkills
// ---------------------------------------------------------------------------

describe('scoreSoftSkills', () => {
  it('returns 100 when opportunity lists no soft skills', () => {
    const r = scoreSoftSkills([soft('Communication')], []);
    expect(r.score).toBe(100);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it('returns 100 when all preferred soft skills are held', () => {
    const r = scoreSoftSkills(
      [soft('Communication'), soft('Teamwork'), soft('Leadership')],
      [soft('Communication'), soft('Teamwork')],
    );
    expect(r.score).toBe(100);
    expect(r.matched).toContain('Communication');
    expect(r.matched).toContain('Teamwork');
    expect(r.missing).toEqual([]);
  });

  it('returns 50 when half of preferred soft skills are held', () => {
    const r = scoreSoftSkills([soft('Communication')], [soft('Communication'), soft('Teamwork')]);
    expect(r.score).toBe(50);
    expect(r.matched).toEqual(['Communication']);
    expect(r.missing).toEqual(['Teamwork']);
  });

  it('returns 0 when none of the preferred soft skills are held', () => {
    const r = scoreSoftSkills(
      [soft('Python'), soft('SQL')],
      [soft('Communication'), soft('Leadership')],
    );
    expect(r.score).toBe(0);
    expect(r.matched).toEqual([]);
    expect(r.missing).toContain('Communication');
    expect(r.missing).toContain('Leadership');
  });

  it('ignores student soft skills not in the preferred list', () => {
    const r = scoreSoftSkills([soft('Communication'), soft('Python')], [soft('Communication')]);
    expect(r.score).toBe(100);
    expect(r.matched).toEqual(['Communication']);
    expect(r.missing).toEqual([]);
  });

  it('ignores null/undefined names', () => {
    const r = scoreSoftSkills(
      [soft('Communication'), { name: null as unknown as string }],
      [soft('Communication'), { name: undefined as unknown as string }],
    );
    expect(r.score).toBe(100);
  });

  it('ignores blank names', () => {
    const r = scoreSoftSkills([soft('Communication'), { name: '   ' }], [soft('Communication')]);
    expect(r.score).toBe(100);
  });

  it('deduplicates repeated entries by name', () => {
    const r = scoreSoftSkills(
      [soft('Communication'), soft('Communication')],
      [soft('Communication')],
    );
    expect(r.score).toBe(100);
    expect(r.matched).toEqual(['Communication']);
  });
});

// ---------------------------------------------------------------------------
// scoreCareerInterests
// ---------------------------------------------------------------------------

describe('scoreCareerInterests', () => {
  it('returns 100 when opportunity has no preferred roles or locations', () => {
    const r = scoreCareerInterests(['Frontend', 'Mumbai', 'Backend'], [], []);
    expect(r.score).toBe(100);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it('returns 100 when all opportunity interests overlap with student interests', () => {
    const r = scoreCareerInterests(
      ['Frontend Developer', 'Mumbai', 'Backend'],
      ['Frontend Developer'],
      ['Mumbai'],
    );
    expect(r.score).toBe(100);
    expect(r.matched).toContain('Frontend Developer');
    expect(r.matched).toContain('Mumbai');
  });

  it('returns 50 when half of opportunity interests are matched', () => {
    const r = scoreCareerInterests(
      ['Frontend Developer'],
      ['Frontend Developer', 'Backend Engineer'],
      [],
    );
    expect(r.score).toBe(50);
    expect(r.matched).toContain('Frontend Developer');
    expect(r.missing).toContain('backend engineer');
  });

  it('returns 0 when no opportunity interests are matched', () => {
    const r = scoreCareerInterests(['Frontend', 'Mumbai'], ['Backend Engineer'], ['Delhi']);
    expect(r.score).toBe(0);
    expect(r.matched).toEqual([]);
    expect(r.missing).toContain('backend engineer');
    expect(r.missing).toContain('delhi');
  });

  it('ignores null/undefined interests', () => {
    const r = scoreCareerInterests(
      [null as unknown as string, 'Frontend', undefined as unknown as string],
      ['Frontend'],
      [],
    );
    expect(r.score).toBe(100);
  });

  it('ignores blank interests', () => {
    const r = scoreCareerInterests(['Frontend', '  ', ''], ['Frontend'], []);
    expect(r.score).toBe(100);
  });

  it('case-insensitive matching', () => {
    const r = scoreCareerInterests(['Frontend Developer'], ['FRONTEND DEVELOPER'], []);
    expect(r.score).toBe(100);
  });

  it('ignores duplicate role and location entries with the same normalised value', () => {
    const r = scoreCareerInterests(['Frontend'], ['Frontend', 'FRONTEND'], []);
    // Only 1 unique interest in the pool
    expect(r.score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeFullMatch — integration scenarios
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<FullMatchInput> = {}): FullMatchInput {
  return {
    studentSkills: [],
    requiredSkills: [],
    preferredSkills: [],
    studentSoftSkills: [],
    preferredSoftSkills: [],
    eligibility: {},
    studentCareerInterests: [],
    opportunityPreferredRoles: [],
    opportunityPreferredLocations: [],
    ...overrides,
  };
}

describe('computeFullMatch — full match', () => {
  it('score 100 when all required skills, soft skills, eligibility and career interests match', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python'), tSkill('2', 'Django'), tSkill('3', 'Docker')],
      requiredSkills: [tSkill('1', 'Python'), tSkill('2', 'Django')],
      preferredSkills: [tSkill('3', 'Docker')],
      studentSoftSkills: [soft('Communication'), soft('Teamwork')],
      preferredSoftSkills: [soft('Communication')],
      eligibility: {
        studentCgpa: 8.5,
        requiredCgpa: 8.0,
        eligibleBranches: ['Computer Science'],
        studentBranch: 'Computer Science',
        eligibleGradYears: [2025],
        studentGraduationYear: 2025,
        eligibleDegrees: ['B.Tech'],
        studentDegree: 'B.Tech',
      },
      studentCareerInterests: ['Backend Developer', 'Mumbai'],
      opportunityPreferredRoles: ['Backend Developer'],
      opportunityPreferredLocations: ['Mumbai'],
    });

    const r = computeFullMatch(input);

    // Technical: required 2/2=100 (×70=70) + preferred 1/1=100 (×10=10) = 80
    // Soft: 1/1=100 (×10=10) = 10
    // Career: 2/2=100 (×10=10) = 10
    // Eligibility bonus: 10
    // Total: 70+10+10+10 = 100
    expect(r.score).toBe(100);
    expect(r.level).toBe('STRONG_MATCH');
    expect(r.matchPercentage).toBe(100);
    expect(r.eligibility.passed).toBe(true);
    expect(r.eligibility.failures).toEqual([]);
    expect(gapNames(r.matchedSkills.technical)).toContain('Python');
    expect(gapNames(r.missingSkills.technical)).toEqual([]);
  });

  it('eligibility failure caps score at 90 (eligibility bonus = 0)', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python'), tSkill('2', 'Django')],
      requiredSkills: [tSkill('1', 'Python'), tSkill('2', 'Django')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        studentCgpa: 6.0,
        requiredCgpa: 8.0,
        eligibleBranches: ['Computer Science'],
        studentBranch: 'Electrical',
        eligibleGradYears: [2025],
        studentGraduationYear: 2025,
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    // Technical: required 2/2=100 (×70=70) + preferred none (×0=0) = 70
    // Soft: 100 (×10=10) = 10
    // Career: 100 (×10=10) = 10
    // Eligibility bonus: 0 (failed)
    // Total: 70+10+10+0 = 90
    expect(r.score).toBe(90);
    expect(r.level).toBe('STRONG_MATCH');
    expect(r.eligibility.passed).toBe(false);
    expect(r.eligibility.failures.length).toBeGreaterThan(0);
    expect(r.recommendation).toContain('appear ineligible');
  });

  it('score 0 (LOW_MATCH) when nothing matches and eligibility also fails', () => {
    // No technical match (0), no soft match (0), no career match (0),
    // eligibility failed (0 bonus) → 0 + 0 + 0 + 0 = 0.
    const input = makeInput({
      studentSkills: [tSkill('99', 'COBOL')],
      requiredSkills: [tSkill('1', 'Python'), tSkill('2', 'Django')],
      preferredSkills: [tSkill('3', 'Docker')],
      studentSoftSkills: [soft('Cooking')],
      preferredSoftSkills: [soft('Communication')],
      eligibility: {
        studentCgpa: 6.0,
        requiredCgpa: 8.0,
        eligibleBranches: ['Computer Science'],
        studentBranch: 'Civil',
        eligibleGradYears: [2025],
        studentGraduationYear: 2025,
      },
      studentCareerInterests: ['Chef'],
      opportunityPreferredRoles: ['Backend Developer'],
      opportunityPreferredLocations: ['Mumbai'],
    });
    const r = computeFullMatch(input);
    expect(r.score).toBe(0);
    expect(r.level).toBe('LOW_MATCH');
    expect(r.eligibility.passed).toBe(false);
    expect(r.recommendation).toContain('appear ineligible');
  });
});

describe('computeFullMatch — partial match', () => {
  it('score reflects proportional technical skill coverage', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [
        tSkill('1', 'Python'),
        tSkill('2', 'Django'),
        tSkill('3', 'Docker'),
        tSkill('4', 'Kubernetes'),
      ],
      preferredSkills: [],
      studentSoftSkills: [soft('Communication')],
      preferredSoftSkills: [soft('Teamwork')],
      eligibility: {},
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    // Technical: required 1/4=25 (×70=17.5) → 18
    // Soft: 0/1=0 (×10=0) = 0
    // Career: 100 (×10=10) = 10
    // Eligibility bonus: 10
    // Total: 18+0+10+10 = 38 → LOW_MATCH (< 40 PARTIAL threshold)
    expect(r.score).toBe(38);
    expect(r.level).toBe('LOW_MATCH');
    expect(r.matchPercentage).toBe(25);
    expect(gapNames(r.matchedSkills.technical)).toContain('Python');
    expect(gapNames(r.missingSkills.technical)).toContain('Django');
    expect(gapNames(r.missingSkills.technical)).toContain('Docker');
    expect(gapNames(r.missingSkills.technical)).toContain('Kubernetes');
  });
});

describe('computeFullMatch — no match', () => {
  it('score is low (only eligibility bonus) when nothing else matches', () => {
    const input = makeInput({
      studentSkills: [tSkill('99', 'COBOL')],
      requiredSkills: [tSkill('1', 'Python'), tSkill('2', 'Django')],
      preferredSkills: [tSkill('3', 'Docker')],
      studentSoftSkills: [soft('Cooking')],
      preferredSoftSkills: [soft('Communication'), soft('Teamwork')],
      eligibility: {},
      studentCareerInterests: ['Chef'],
      opportunityPreferredRoles: ['Backend Developer'],
      opportunityPreferredLocations: ['Mumbai'],
    });

    const r = computeFullMatch(input);

    // Technical: required 0/2=0 (×70=0) + preferred 0/1=0 (×0=0) = 0
    // Soft: 0/2=0 (×10=0) = 0
    // Career: 0/2=0 (×10=0) = 0
    // Eligibility bonus: 10
    // Total: 0+0+0+10 = 10
    expect(r.score).toBe(10);
    expect(r.level).toBe('LOW_MATCH');
    expect(r.matchPercentage).toBe(0);
    expect(r.eligibility.passed).toBe(true);
    expect(gapNames(r.matchedSkills.technical)).toEqual([]);
    expect(gapNames(r.missingSkills.technical)).toContain('Python');
    expect(gapNames(r.missingSkills.technical)).toContain('Django');
  });
});

describe('computeFullMatch — missing skills', () => {
  it('reports correct missing required skills', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python'), tSkill('2', 'SQL')],
      requiredSkills: [
        tSkill('1', 'Python'),
        tSkill('3', 'React'),
        tSkill('4', 'TypeScript'),
        tSkill('5', 'AWS'),
      ],
      preferredSkills: [tSkill('6', 'Docker')],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {},
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(gapNames(r.matchedSkills.technical)).toContain('Python');
    expect(gapNames(r.matchedSkills.technical)).not.toContain('React');
    expect(gapNames(r.missingSkills.technical)).toContain('React');
    expect(gapNames(r.missingSkills.technical)).toContain('TypeScript');
    expect(gapNames(r.missingSkills.technical)).toContain('AWS');
    expect(gapNames(r.missingSkills.technical)).not.toContain('Python');
  });

  it('reports preferredMatched when preferred skill is held', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python'), tSkill('2', 'Docker')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [tSkill('2', 'Docker'), tSkill('3', 'Kubernetes')],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {},
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(gapNames(r.matchedSkills.technical)).toContain('Python');
    expect(gapNames(r.preferredMatched)).toContain('Docker');
    expect(gapNames(r.missingSkills.technical)).toEqual([]);
  });
});

describe('computeFullMatch — eligibility failure scenarios', () => {
  it('fails on CGPA even when all skills match', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        studentCgpa: 7.5,
        requiredCgpa: 8.0,
        eligibleBranches: [],
        studentBranch: null,
        eligibleGradYears: [],
        studentGraduationYear: null,
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(r.eligibility.passed).toBe(false);
    expect(r.eligibility.failures.some((f) => f.includes('CGPA'))).toBe(true);
    // Score is still calculated; eligibility failure only removes the 10-point bonus
  });

  it('fails on branch even when CGPA is fine', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        studentCgpa: 9.0,
        requiredCgpa: 7.0,
        eligibleBranches: ['Computer Science', 'IT'],
        studentBranch: 'Civil Engineering',
        eligibleGradYears: [2025],
        studentGraduationYear: 2025,
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(r.eligibility.passed).toBe(false);
    expect(r.eligibility.failures.some((f) => f.includes('Branch'))).toBe(true);
  });

  it('fails on graduation year', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        eligibleGradYears: [2024, 2025],
        studentGraduationYear: 2026,
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(r.eligibility.passed).toBe(false);
    expect(r.eligibility.failures.some((f) => f.includes('Graduation year'))).toBe(true);
  });

  it('fails on degree', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        eligibleDegrees: ['B.Tech', 'M.Tech'],
        studentDegree: 'B.Sc',
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(r.eligibility.passed).toBe(false);
    expect(r.eligibility.failures.some((f) => f.includes('Degree'))).toBe(true);
  });

  it('recommendation reflects eligibility failure', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        studentCgpa: 5.0,
        requiredCgpa: 8.0,
        eligibleBranches: ['Computer Science'],
        studentBranch: 'Computer Science',
        eligibleGradYears: [2025],
        studentGraduationYear: 2025,
        eligibleDegrees: ['B.Tech'],
        studentDegree: 'B.Tech',
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    expect(r.recommendation).toContain('appear ineligible');
  });
});

describe('computeFullMatch — null/undefined robustness', () => {
  it('handles all-null input without crashing', () => {
    const input = makeInput({
      studentSkills: [],
      requiredSkills: [],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        studentCgpa: null,
        requiredCgpa: null,
        studentBranch: null,
        eligibleBranches: null,
        studentGraduationYear: null,
        eligibleGradYears: null,
        studentDegree: null,
        eligibleDegrees: null,
      },
      studentCareerInterests: null,
      opportunityPreferredRoles: null,
      opportunityPreferredLocations: null,
    });

    const r = computeFullMatch(input);

    // Everything is open → 100 technical, 100 soft, 100 career, 10 eligibility = 100
    expect(r.score).toBe(100);
    expect(r.level).toBe('STRONG_MATCH');
    expect(r.eligibility.passed).toBe(true);
    expect(r.eligibility.failures).toEqual([]);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(Number.isFinite(r.matchPercentage)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('handles undefined requiredSkills and preferredSkills', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: undefined,
      preferredSkills: undefined,
    });

    const r = computeFullMatch(input);

    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBe(100);
    expect(r.matchedSkills.technical).toEqual([]);
    expect(r.missingSkills.technical).toEqual([]);
  });

  it('handles undefined eligibility object', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      eligibility: undefined,
    });

    const r = computeFullMatch(input);

    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.eligibility.passed).toBe(true);
  });

  it('never returns NaN for any numeric field', () => {
    const edgeCases: FullMatchInput[] = [
      makeInput({}),
      makeInput({ studentSkills: [], requiredSkills: [], preferredSkills: [] }),
      makeInput({
        studentSkills: [{ id: '', name: '' }],
        requiredSkills: [{ id: '', name: '' }],
      }),
    ];

    for (const input of edgeCases) {
      const r = computeFullMatch(input);
      expect(Number.isFinite(r.score), `score=${r.score}`).toBe(true);
      expect(Number.isFinite(r.matchPercentage), `matchPercentage=${r.matchPercentage}`).toBe(true);
      expect(Number.isFinite(r.breakdown.technical), `technical=${r.breakdown.technical}`).toBe(
        true,
      );
      expect(Number.isFinite(r.breakdown.soft), `soft=${r.breakdown.soft}`).toBe(true);
      expect(Number.isFinite(r.breakdown.career), `career=${r.breakdown.career}`).toBe(true);
      expect(
        Number.isFinite(r.breakdown.eligibility),
        `eligibility=${r.breakdown.eligibility}`,
      ).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.matchPercentage).toBeGreaterThanOrEqual(0);
      expect(r.matchPercentage).toBeLessThanOrEqual(100);
    }
  });

  it('skill names with whitespace differences are treated as the same skill', () => {
    const input = makeInput({
      studentSkills: [{ id: '1', name: '  Machine   Learning  ' }],
      requiredSkills: [{ id: '2', name: 'Machine Learning' }],
    });

    const r = computeFullMatch(input);

    expect(r.matchedSkills.technical).toHaveLength(1);
    expect(r.missingSkills.technical).toHaveLength(0);
  });

  it('duplicate skill names are collapsed', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python'), tSkill('2', 'Python'), tSkill('3', 'python')],
      requiredSkills: [tSkill('4', 'Python')],
    });

    const r = computeFullMatch(input);

    expect(r.matchedSkills.technical).toHaveLength(1);
    expect(r.missingSkills.technical).toHaveLength(0);
    expect(r.score).toBe(100);
  });
});

describe('computeFullMatch — preferred skills vs required overlap', () => {
  it('a skill listed as both required and preferred is not double-counted', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [tSkill('1', 'Python')],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {},
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });

    const r = computeFullMatch(input);

    // Python is required (counts once) and preferred (should not count again).
    // The 100% technical + 100% soft (none) + 100% career (none) + 10 eligibility = 100.
    expect(gapNames(r.matchedSkills.technical)).toContain('Python');
    expect(gapNames(r.preferredMatched)).toEqual([]);
    expect(r.score).toBe(100);
  });
});

describe('computeFullMatch — recommendation strings', () => {
  it('STRONG_MATCH + eligible → excellent fit', () => {
    const input = makeInput({
      studentSkills: [tSkill('1', 'Python')],
      requiredSkills: [tSkill('1', 'Python')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: {
        studentCgpa: 9.0,
        requiredCgpa: 7.0,
        eligibleBranches: [],
        studentBranch: null,
        eligibleGradYears: [],
        studentGraduationYear: null,
      },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });
    const r = computeFullMatch(input);
    expect(r.recommendation).toContain('Excellent fit');
  });

  it('LOW_MATCH + ineligible → low fit ineligible message', () => {
    const input = makeInput({
      studentSkills: [],
      requiredSkills: [tSkill('1', 'Python'), tSkill('2', 'Django'), tSkill('3', 'Docker')],
      preferredSkills: [],
      studentSoftSkills: [],
      preferredSoftSkills: [],
      eligibility: { studentCgpa: 5.0, requiredCgpa: 8.0 },
      studentCareerInterests: [],
      opportunityPreferredRoles: [],
      opportunityPreferredLocations: [],
    });
    const r = computeFullMatch(input);
    expect(r.recommendation).toContain('appear ineligible');
  });
});
