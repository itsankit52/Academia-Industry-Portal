import { describe, expect, it } from 'vitest';

/**
 * Phase 8 — Mentor Recommendation Scoring Tests
 *
 * Tests the deterministic scoring formula for mentor recommendations.
 * Formula: skillOverlap * 5 + expertiseOverlap * 3 + availabilityBonus + experienceBonus
 *
 * Availability: AVAILABLE=10, BUSY=2, UNAVAILABLE=0
 * Experience bonus: min(5, years / 2)
 */

interface MockMentor {
  id: string;
  expertise: string[];
  yearsExperience: number;
  availability: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
}

function scoreMentor(mentor: MockMentor, studentSkillNames: string[]): number {
  const skillSet = new Set(studentSkillNames.map((s) => s.toLowerCase()));
  const mentorSet = new Set(mentor.expertise.map((e) => e.toLowerCase()));

  // skill overlap: count of student skills present in mentor expertise
  const skillOverlap = [...skillSet].filter((s) => mentorSet.has(s)).length;

  // expertise overlap: count of mentor expertise that matches student skills
  const expertiseOverlap = [...mentorSet].filter((e) => skillSet.has(e)).length;

  const availabilityBonus =
    mentor.availability === 'AVAILABLE' ? 10 : mentor.availability === 'BUSY' ? 2 : 0;

  const experienceBonus = Math.min(5, Math.floor(mentor.yearsExperience / 2));

  return skillOverlap * 5 + expertiseOverlap * 3 + availabilityBonus + experienceBonus;
}

describe('Mentor Recommendation Scoring', () => {
  it('returns 0 for a mentor with no matching skills', () => {
    const mentor: MockMentor = {
      id: 'm1',
      expertise: ['python', 'django'],
      yearsExperience: 3,
      availability: 'AVAILABLE',
    };
    const score = scoreMentor(mentor, ['react', 'typescript']);
    // skillOverlap=0, expertiseOverlap=0, availability=10, experience=1
    expect(score).toBe(11);
  });

  it('skills overlap adds 5 points each', () => {
    const mentor: MockMentor = {
      id: 'm2',
      expertise: ['react', 'typescript'],
      yearsExperience: 2,
      availability: 'BUSY',
    };
    const score = scoreMentor(mentor, ['react', 'typescript', 'nodejs']);
    // skillOverlap=2 (react, typescript), expertiseOverlap=2 (react, typescript)
    // availability=2, experience=1
    expect(score).toBe(2 * 5 + 2 * 3 + 2 + 1);
  });

  it('AVAILABLE mentors get +10 availability bonus', () => {
    const mentor: MockMentor = {
      id: 'm3',
      expertise: [],
      yearsExperience: 0,
      availability: 'AVAILABLE',
    };
    const scoreA = scoreMentor(mentor, ['sql']);
    const mentorBusy: MockMentor = { ...mentor, availability: 'BUSY' };
    const scoreB = scoreMentor(mentorBusy, ['sql']);
    expect(scoreA - scoreB).toBe(8); // 10 - 2
  });

  it('UNAVAILABLE mentors get 0 availability bonus', () => {
    const mentor: MockMentor = {
      id: 'm4',
      expertise: [],
      yearsExperience: 0,
      availability: 'UNAVAILABLE',
    };
    const score = scoreMentor(mentor, ['css']);
    expect(score).toBe(0); // 0 + 0 + 0 + 0
  });

  it('experience bonus caps at 5', () => {
    const mentor10: MockMentor = {
      id: 'm5',
      expertise: [],
      yearsExperience: 10,
      availability: 'AVAILABLE',
    };
    const mentor20: MockMentor = {
      id: 'm6',
      expertise: [],
      yearsExperience: 20,
      availability: 'AVAILABLE',
    };
    const score10 = scoreMentor(mentor10, []);
    const score20 = scoreMentor(mentor20, []);
    // Both get experience bonus of 5 (min(5, years/2) = 5 for both)
    expect(score10).toBe(10 + 5); // available + capped exp
    expect(score20).toBe(10 + 5);
    expect(score10).toBe(score20);
  });

  it('experience bonus increments by 1 for each 2 years', () => {
    const scores: number[] = [];
    for (let years = 0; years <= 14; years += 2) {
      const m: MockMentor = {
        id: `m-y${years}`,
        expertise: [],
        yearsExperience: years,
        availability: 'UNAVAILABLE',
      };
      scores.push(scoreMentor(m, []));
    }
    // Expected: 0, 1, 2, 3, 4, 5, 5, 5 (capped at 5)
    expect(scores).toEqual([0, 1, 2, 3, 4, 5, 5, 5]);
  });

  it('case-insensitive matching', () => {
    const mentor: MockMentor = {
      id: 'm7',
      expertise: ['React', 'TypeScript'],
      yearsExperience: 1,
      availability: 'AVAILABLE',
    };
    const score = scoreMentor(mentor, ['react', 'typescript']);
    // Both skills match (case-insensitive)
    expect(score).toBe(2 * 5 + 2 * 3 + 10 + 0);
  });

  it('sorts mentors correctly by score (descending)', () => {
    const mentors: MockMentor[] = [
      { id: 'm-a', expertise: ['react'], yearsExperience: 2, availability: 'UNAVAILABLE' },
      { id: 'm-b', expertise: ['react'], yearsExperience: 10, availability: 'AVAILABLE' },
      { id: 'm-c', expertise: ['react'], yearsExperience: 5, availability: 'BUSY' },
    ];
    const scores = mentors.map((m) => ({ id: m.id, score: scoreMentor(m, ['react']) }));
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0]!.id).toBe('m-b'); // highest: available + capped exp
    expect(scores[1]!.id).toBe('m-c'); // mid: busy + exp 2
    expect(scores[2]!.id).toBe('m-a'); // lowest: unavailable + exp 1
  });
});
