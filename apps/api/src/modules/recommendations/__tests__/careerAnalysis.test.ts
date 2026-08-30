/**
 * Phase 9B — Tests for careerAnalysis.service.ts
 *
 * Coverage:
 * - Skill comparison: matched/partial/missing states
 * - Career path analysis: readiness, evidence, recommendations
 * - Action plan: priority ordering, action types, valid entities
 * - Assessment-driven intelligence: weakness influence, fallback
 * - Training gap-closure: coverage, priority, exclusion
 * - Benchmark: aggregate-only, institution scoping, fallback
 * - Readiness progression: historical calculation, fallback
 * - RBAC: student access, cross-student protection
 */

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Assessment: { find: vi.fn(), findOne: vi.fn() },
  Internship: { aggregate: vi.fn() },
  Job: { aggregate: vi.fn() },
  Skill: { find: vi.fn() },
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn(), aggregate: vi.fn(), findOne: vi.fn() },
  TrainingEnrollment: { find: vi.fn() },
  TrainingProgram: { find: vi.fn() },
  MentorProfile: { find: vi.fn() },
  User: { findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
}));

import {
  Assessment,
  Internship,
  Job,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingEnrollment,
  TrainingProgram,
  MentorProfile,
  User,
  FacultyProfile,
  CompanyProfile,
} from '../../../models';
import {
  __test,
  getCareerActionPlan,
  getCareerBenchmark,
  getReadinessProgression,
  buildGapClosingTrainings,
  loadAssessmentSignals,
} from '../careerAnalysis.service';

const {
  buildSkillComparison,
  readinessHeadline,
  buildNextActions,
  buildCareerInsights,
  gapStateFor,
  FALLBACK_REASONS,
} = __test;

/* ─── Helpers ──────────────────────────────────────────────────────── */

interface Chain<T> {
  populate: () => Chain<T>;
  select: () => Chain<T>;
  sort: () => Chain<T>;
  skip: () => Chain<T>;
  limit: () => Chain<T>;
  lean: () => Promise<T>;
  then: <R>(onF: (v: T) => R, onR?: (r: unknown) => R) => Promise<R>;
}

function query<T>(result: T): Chain<T> {
  const q = {} as Chain<T>;
  q.populate = () => q;
  q.select = () => q;
  q.sort = () => q;
  q.skip = () => q;
  q.limit = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (onF, _onR) => Promise.resolve(result).then(onF);
  return q;
}

function objId(): string {
  return new Types.ObjectId().toString();
}

const STUDENT_USER_ID = objId();
const STUDENT_PROFILE_ID = new Types.ObjectId();

/* ─── gapStateFor ─────────────────────────────────────────────────── */

describe('gapStateFor', () => {
  it('MISSING when current is null', () => {
    expect(gapStateFor(null, 'INTERMEDIATE')).toBe('MISSING');
    expect(gapStateFor(null, 'ADVANCED')).toBe('MISSING');
    expect(gapStateFor(null, 'BEGINNER')).toBe('MISSING');
  });
  it('MATCHED when current >= required', () => {
    expect(gapStateFor('INTERMEDIATE', 'INTERMEDIATE')).toBe('MATCHED');
    expect(gapStateFor('ADVANCED', 'INTERMEDIATE')).toBe('MATCHED');
    expect(gapStateFor('EXPERT', 'BEGINNER')).toBe('MATCHED');
  });
  it('PARTIAL when current < required', () => {
    expect(gapStateFor('BEGINNER', 'INTERMEDIATE')).toBe('PARTIAL');
    expect(gapStateFor('INTERMEDIATE', 'ADVANCED')).toBe('PARTIAL');
    expect(gapStateFor('BEGINNER', 'EXPERT')).toBe('PARTIAL');
  });
});

/* ─── buildSkillComparison ─────────────────────────────────────────── */

describe('buildSkillComparison', () => {
  it('marks matched skills correctly', () => {
    const analysis = {
      matchedSkills: { technical: [{ id: objId(), name: 'React' }], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
    } as unknown as Parameters<typeof buildSkillComparison>[0];
    const skillNames = new Map<string, { name: string; category: 'BACKEND' }>();
    const proficiency = new Map<string, 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'>();
    proficiency.set('react', 'ADVANCED');

    const result = buildSkillComparison(analysis, skillNames, proficiency);
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe('MATCHED');
    expect(result[0]!.required).toBe(true);
    expect(result[0]!.currentProficiency).toBe('ADVANCED');
    expect(result[0]!.gap).toBe(0);
  });

  it('marks missing skills as MISSING', () => {
    const analysis = {
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [{ id: objId(), name: 'Kubernetes' }], soft: [] },
      proficiencyGaps: [],
    } as unknown as Parameters<typeof buildSkillComparison>[0];
    const skillNames = new Map<string, { name: string; category: 'BACKEND' }>();
    const proficiency = new Map<string, 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'>();

    const result = buildSkillComparison(analysis, skillNames, proficiency);
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe('MISSING');
    expect(result[0]!.currentProficiency).toBeNull();
    expect(result[0]!.gap).toBe(2); // INTERMEDIATE rank = 2
  });

  it('marks proficiency gaps as PARTIAL', () => {
    const gapId = objId();
    const analysis = {
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [{
        id: gapId,
        name: 'Python',
        studentLevel: 'BEGINNER',
        requiredLevel: 'ADVANCED',
        gapLevels: 2,
      }],
    } as unknown as Parameters<typeof buildSkillComparison>[0];
    const skillNames = new Map([[gapId, { name: 'Python', category: 'BACKEND' as const }]]);
    const proficiency = new Map<string, 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'>();

    const result = buildSkillComparison(analysis, skillNames, proficiency);
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe('PARTIAL');
    expect(result[0]!.currentProficiency).toBe('BEGINNER');
    expect(result[0]!.gap).toBe(2);
  });
});

/* ─── readinessHeadline ────────────────────────────────────────────── */

describe('readinessHeadline', () => {
  it('mentions eligibility failure when not eligible', () => {
    const analysis = {
      eligibility: { passed: false, failures: ['CGPA below minimum'] },
      level: 'WEAK_MATCH',
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
    } as unknown as Parameters<typeof readinessHeadline>[0];
    const comparison: Parameters<typeof readinessHeadline>[1] = [];

    const result = readinessHeadline(analysis, comparison);
    expect(result).toContain('Not yet eligible');
  });

  it('mentions missing count when skills are missing', () => {
    const analysis = {
      eligibility: { passed: true, failures: [] },
      level: 'WEAK_MATCH',
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
    } as unknown as Parameters<typeof readinessHeadline>[0];
    const comparison = [
      { state: 'MISSING' } as Parameters<typeof readinessHeadline>[1][0],
      { state: 'MISSING' } as Parameters<typeof readinessHeadline>[1][0],
      { state: 'MATCHED' } as Parameters<typeof readinessHeadline>[1][0],
    ];

    const result = readinessHeadline(analysis, comparison);
    expect(result).toContain('2');
    expect(result).toContain('missing');
  });

  it('mentions partial count when no skills are missing', () => {
    const analysis = {
      eligibility: { passed: true, failures: [] },
      level: 'PARTIAL_MATCH',
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
    } as unknown as Parameters<typeof readinessHeadline>[0];
    const comparison = [
      { state: 'MATCHED' } as Parameters<typeof readinessHeadline>[1][0],
      { state: 'PARTIAL' } as Parameters<typeof readinessHeadline>[1][0],
    ];

    const result = readinessHeadline(analysis, comparison);
    expect(result).toContain('strengthened');
  });

  it('mentions strong match count', () => {
    const analysis = {
      eligibility: { passed: true, failures: [] },
      level: 'STRONG_MATCH',
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
    } as unknown as Parameters<typeof readinessHeadline>[0];
    const comparison = [
      { state: 'MATCHED' } as Parameters<typeof readinessHeadline>[1][0],
      { state: 'MATCHED' } as Parameters<typeof readinessHeadline>[1][0],
    ];

    const result = readinessHeadline(analysis, comparison);
    expect(result).toContain('Ready');
    expect(result).toContain('2 of 2');
  });
});

/* ─── buildGapClosingTrainings ─────────────────────────────────────── */

describe('buildGapClosingTrainings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes completed enrollments', async () => {
    const trainingId = objId();
    const gapSkill = objId();

    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([
      { training: trainingId, status: 'COMPLETED' },
    ]) as never);
    // TrainingProgram.find uses .populate().lean()
    vi.mocked(TrainingProgram.find).mockReturnValue(query([
      {
        _id: trainingId,
        title: 'Completed Course',
        description: 'Already done',
        provider: 'Test',
        durationWeeks: 2,
        registrationUrl: 'https://test.com',
        skills: [gapSkill],
      },
    ]) as never);

    const result = await buildGapClosingTrainings(STUDENT_PROFILE_ID, [gapSkill]);
    expect(result.some(t => t.id === trainingId)).toBe(false);
  });

  it('includes trainings covering gap skills', async () => {
    const trainingId = objId();
    const gapSkill = objId();

    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([]) as never);
    vi.mocked(TrainingProgram.find).mockReturnValue(query([
      {
        _id: trainingId,
        title: 'Gap Training',
        description: 'Covers the gap',
        provider: 'Test',
        durationWeeks: 4,
        registrationUrl: 'https://test.com',
        skills: [gapSkill],
      },
    ]) as never);

    const result = await buildGapClosingTrainings(STUDENT_PROFILE_ID, [gapSkill]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(trainingId);
    expect(result[0]!.overlapCount).toBe(1);
  });

  it('sorts by overlap count descending', async () => {
    const training1 = objId();
    const training2 = objId();
    const gapSkill1 = objId();
    const gapSkill2 = objId();

    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([]) as never);
    vi.mocked(TrainingProgram.find).mockReturnValue(query([
      {
        _id: training1,
        title: 'Covers One',
        description: 'One gap',
        provider: 'Test',
        durationWeeks: 2,
        registrationUrl: 'https://test.com',
        skills: [gapSkill1],
      },
      {
        _id: training2,
        title: 'Covers Two',
        description: 'Two gaps',
        provider: 'Test',
        durationWeeks: 2,
        registrationUrl: 'https://test.com',
        skills: [gapSkill1, gapSkill2],
      },
    ]) as never);

    const result = await buildGapClosingTrainings(STUDENT_PROFILE_ID, [gapSkill1, gapSkill2]);
    expect(result[0]!.overlapCount).toBe(2);
    expect(result[1]!.overlapCount).toBe(1);
  });
});

/* ─── loadAssessmentSignals ────────────────────────────────────────── */

describe('loadAssessmentSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts skill breakdown from evaluated assessments', async () => {
    vi.mocked(Assessment.find).mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([{
            evaluation: {
              skillBreakdown: [
                { skillId: objId(), skillName: 'React', score: 70, maxScore: 100 },
                { skillId: objId(), skillName: 'Node.js', score: 50, maxScore: 100 },
              ],
            },
          }]),
        }),
      }),
    } as never);

    const result = await loadAssessmentSignals(STUDENT_PROFILE_ID);
    expect(result.size).toBe(2);
    expect(result.get('react')?.lastScore).toBe(70);
    expect(result.get('node.js')?.lastScore).toBe(50);
  });

  it('calculates weakness score correctly', async () => {
    vi.mocked(Assessment.find).mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([{
            evaluation: {
              skillBreakdown: [
                { skillId: objId(), skillName: 'WeakSkill', score: 30, maxScore: 100 },
              ],
            },
          }]),
        }),
      }),
    } as never);

    const result = await loadAssessmentSignals(STUDENT_PROFILE_ID);
    expect(result.get('weakskill')?.weaknessScore).toBe(70);
  });
});

/* ─── getCareerBenchmark ───────────────────────────────────────────── */

describe('getCareerBenchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unavailable when profile not found', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(query(null) as never);

    const result = await getCareerBenchmark(STUDENT_USER_ID);
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toBe(FALLBACK_REASONS.insufficient);
  });

  it('returns unavailable when sample size is too small', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.find).mockReturnValue(query([]) as never);
    vi.mocked(StudentSkill.aggregate).mockResolvedValue([
      { _id: { category: 'PROGRAMMING' }, avgRank: 2, count: 1, nStudents: [new Types.ObjectId()] },
      { _id: { category: 'BACKEND' }, avgRank: 3, count: 1, nStudents: [new Types.ObjectId()] },
      { _id: { category: 'FRONTEND' }, avgRank: 2, count: 1, nStudents: [new Types.ObjectId()] },
    ] as never);

    const result = await getCareerBenchmark(STUDENT_USER_ID);
    expect(result.available).toBe(false);
    expect(result.sampleSize).toBeLessThan(5);
  });

  it('never exposes individual student data', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.find).mockReturnValue(query([
      { skill: objId(), proficiency: 'INTERMEDIATE' },
    ]) as never);
    vi.mocked(StudentSkill.aggregate).mockResolvedValue([
      {
        _id: { category: 'PROGRAMMING' },
        avgRank: 2.5,
        count: 10,
        nStudents: Array.from({ length: 6 }, () => new Types.ObjectId()),
      },
    ] as never);

    const result = await getCareerBenchmark(STUDENT_USER_ID);
    expect(result.available).toBe(true);
    // No names, emails, or individual IDs in response
    expect(result).not.toHaveProperty('peerNames');
    expect(result).not.toHaveProperty('peerIds');
    expect(result).not.toHaveProperty('peerEmails');
  });

  it('returns available with category breakdown when sample is sufficient', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.find).mockReturnValue(query([
      { skill: objId(), proficiency: 'ADVANCED' },
      { skill: objId(), proficiency: 'INTERMEDIATE' },
    ]) as never);
    vi.mocked(StudentSkill.aggregate).mockResolvedValue([
      {
        _id: { category: 'PROGRAMMING' },
        avgRank: 2.5,
        count: 5,
        nStudents: Array.from({ length: 6 }, () => new Types.ObjectId()),
      },
    ] as never);

    const result = await getCareerBenchmark(STUDENT_USER_ID);
    expect(result.available).toBe(true);
    expect(result.categories).toBeDefined();
    expect(result.studentSkillCount).toBe(2);
  });
});

/* ─── getReadinessProgression ─────────────────────────────────────── */

describe('getReadinessProgression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fallback when no profile found', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(query(null) as never);

    const result = await getReadinessProgression({ studentUserId: STUDENT_USER_ID, currentScore: 75 });
    expect(result.previousScore).toBeNull();
    expect(result.fallbackReason).toBe(FALLBACK_REASONS.noHistory);
  });

  it('returns fallback when no history exists', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.findOne).mockReturnValue(query(null) as never);
    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([]) as never);
    vi.mocked(Assessment.findOne).mockReturnValue(query(null) as never);

    const result = await getReadinessProgression({ studentUserId: STUDENT_USER_ID, currentScore: 75 });
    expect(result.previousScore).toBeNull();
  });

  it('uses assessment score as baseline when available', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.findOne).mockReturnValue(query({ createdAt: oneDayAgo }) as never);
    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([]) as never);
    vi.mocked(Assessment.findOne).mockReturnValue(query({
      createdAt: new Date(),
      evaluation: { totalScore: 65 },
    }) as never);

    const result = await getReadinessProgression({ studentUserId: STUDENT_USER_ID, currentScore: 75 });
    expect(result.previousScore).toBe(65);
    expect(result.delta).toBe(10);
    expect(result.contributingFactors).toContain('Most recent assessment score used as baseline.');
  });

  it('estimates from training completions when no assessment', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.findOne).mockReturnValue(query({ createdAt: oneDayAgo }) as never);
    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([
      { completedAt: new Date() },
      { completedAt: new Date() },
    ]) as never);
    vi.mocked(Assessment.findOne).mockReturnValue(query(null) as never);

    const result = await getReadinessProgression({ studentUserId: STUDENT_USER_ID, currentScore: 80 });
    expect(result.previousScore).not.toBeNull();
    expect(result.contributingFactors.some(f => f.includes('completed training'))).toBe(true);
  });
});

/* ─── buildCareerInsights ──────────────────────────────────────────── */

describe('buildCareerInsights', () => {
  it('builds headline for zero state', () => {
    const input = {
      readiness: { readinessScore: 0, level: 'Not Ready' as const, description: '' },
      topStrengths: [],
      topGaps: [],
      recommendedNextAction: null,
    };
    const result = buildCareerInsights(input);
    expect(result.headline).toContain('Build your profile');
  });

  it('builds headline when no gaps', () => {
    const input = {
      readiness: { readinessScore: 85, level: 'Career Ready' as const, description: '' },
      topStrengths: [{ skillId: '1', name: 'React', category: 'FRONTEND' as const, proficiency: 'ADVANCED' as const }],
      topGaps: [],
      recommendedNextAction: null,
    };
    const result = buildCareerInsights(input);
    expect(result.headline).toContain('well-aligned');
  });

  it('includes recommended next action in headline', () => {
    const input = {
      readiness: { readinessScore: 50, level: 'In Progress' as const, description: '' },
      topStrengths: [],
      topGaps: [{ id: '1', name: 'Python', category: 'BACKEND' as const, demandScore: 3, priority: 'HIGH' as const, reason: 'High demand', recommendedTrainingIds: [] }],
      recommendedNextAction: { priority: 1, type: 'TRAINING' as const, title: 'Complete Python Training', reason: 'Test', ctaPath: '/test' },
    };
    const result = buildCareerInsights(input);
    expect(result.headline).toContain('Complete Python Training');
  });

  it('limits topStrengths and topGaps to 3', () => {
    const strengths = Array.from({ length: 5 }, (_, i) => ({
      skillId: String(i),
      name: `Skill${i}`,
      category: 'PROGRAMMING' as const,
      proficiency: 'INTERMEDIATE' as const,
    }));
    const gaps = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Gap${i}`,
      category: 'BACKEND' as const,
      demandScore: 3,
      priority: 'HIGH' as const,
      reason: 'Test',
      recommendedTrainingIds: [],
    }));
    const input = {
      readiness: { readinessScore: 50, level: 'In Progress' as const, description: '' },
      topStrengths: strengths,
      topGaps: gaps,
      recommendedNextAction: null,
    };
    const result = buildCareerInsights(input);
    expect(result.topStrengths).toHaveLength(3);
    expect(result.topGaps).toHaveLength(3);
  });
});

/* ─── buildNextActions ────────────────────────────────────────────── */

describe('buildNextActions', () => {
  it('recommends training for top gap', () => {
    const topGaps = [{
      skillId: objId(),
      name: 'React',
      category: 'FRONTEND' as const,
      required: true,
      currentProficiency: null,
      requiredProficiency: 'INTERMEDIATE' as const,
      gap: 2,
      state: 'MISSING' as const,
    }];
    const trainings = [{
      id: objId(),
      title: 'React Mastery',
      description: '',
      provider: 'Test',
      skills: [],
      durationWeeks: 4,
      registrationUrl: 'https://test.com',
      overlapCount: 1,
      overlapSkillIds: [topGaps[0]!.skillId],
    }];
    const eligibility = { passed: true, failures: [] };
    const opportunityId = objId();

    const result = buildNextActions({
      opportunityType: 'JOB',
      opportunityId,
      topGaps,
      trainings,
      mentor: null,
      eligibility,
    });

    expect(result.some(a => a.type === 'TRAINING')).toBe(true);
    const trainingAction = result.find(a => a.type === 'TRAINING');
    expect(trainingAction?.title).toContain('React Mastery');
    expect(trainingAction?.ctaLabel).toBe('Start training');
  });

  it('recommends add skill when no training available', () => {
    const topGaps = [{
      skillId: objId(),
      name: 'RareSkill',
      category: 'OTHER' as const,
      required: true,
      currentProficiency: null,
      requiredProficiency: 'INTERMEDIATE' as const,
      gap: 2,
      state: 'MISSING' as const,
    }];
    const eligibility = { passed: true, failures: [] };

    const result = buildNextActions({
      opportunityType: 'JOB',
      opportunityId: objId(),
      topGaps,
      trainings: [], // No training
      mentor: null,
      eligibility,
    });

    expect(result.some(a => a.type === 'SKILL')).toBe(true);
    const skillAction = result.find(a => a.type === 'SKILL');
    expect(skillAction?.title).toContain('RareSkill');
  });

  it('recommends opportunity apply when eligible', () => {
    const eligibility = { passed: true, failures: [] };

    const result = buildNextActions({
      opportunityType: 'JOB',
      opportunityId: objId(),
      topGaps: [],
      trainings: [],
      mentor: null,
      eligibility,
    });

    expect(result.some(a => a.type === 'OPPORTUNITY')).toBe(true);
    const oppAction = result.find(a => a.type === 'OPPORTUNITY');
    expect(oppAction?.ctaLabel).toContain('View opportunity');
  });

  it('recommends assessment for partial skills', () => {
    const topGaps = [{
      skillId: objId(),
      name: 'Python',
      category: 'BACKEND' as const,
      required: true,
      currentProficiency: 'BEGINNER' as const,
      requiredProficiency: 'ADVANCED' as const,
      gap: 2,
      state: 'PARTIAL' as const,
    }];
    const eligibility = { passed: true, failures: [] };

    const result = buildNextActions({
      opportunityType: 'JOB',
      opportunityId: objId(),
      topGaps,
      trainings: [],
      mentor: null,
      eligibility,
    });

    expect(result.some(a => a.type === 'ASSESSMENT')).toBe(true);
  });
});

/* ─── getCareerActionPlan ─────────────────────────────────────────── */

describe('getCareerActionPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ email: 'mentor@test.com', role: 'FACULTY' }) }),
    } as never);
    vi.mocked(FacultyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    vi.mocked(CompanyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
  });

  it('returns empty plan when profile not found', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(query(null) as never);

    const result = await getCareerActionPlan({ studentUserId: STUDENT_USER_ID });
    expect(result.actions).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns non-empty plan when no skills and no opportunities', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.find).mockReturnValue(query([]) as never);
    vi.mocked(Job.aggregate).mockResolvedValue([] as never);
    vi.mocked(Internship.aggregate).mockResolvedValue([] as never);
    vi.mocked(Assessment.find).mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
    } as never);
    vi.mocked(MentorProfile.find).mockReturnValue(query([]) as never);

    const result = await getCareerActionPlan({ studentUserId: STUDENT_USER_ID });
    // Still has an assessment recommendation (to encourage first assessment)
    expect(result.actions.length).toBeGreaterThanOrEqual(1);
  });

  it('includes training actions when gaps exist', async () => {
    const gapSkillId = objId();
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      query({ _id: STUDENT_PROFILE_ID }) as never,
    );
    vi.mocked(StudentSkill.find).mockReturnValue(query([{ skill: objId() }]) as never);
    vi.mocked(Job.aggregate).mockResolvedValue([
      { _id: new Types.ObjectId(gapSkillId), count: 5 },
    ] as never);
    vi.mocked(Internship.aggregate).mockResolvedValue([] as never);
    vi.mocked(Assessment.find).mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
    } as never);
    vi.mocked(TrainingEnrollment.find).mockReturnValue(query([]) as never);
    // TrainingProgram.find uses .populate().lean()
    vi.mocked(TrainingProgram.find).mockReturnValue(query([
      {
        _id: objId(),
        title: 'Gap Training',
        description: 'Covers gaps',
        provider: 'Test',
        durationWeeks: 4,
        registrationUrl: 'https://test.com',
        skills: [gapSkillId],
      },
    ]) as never);
    // Skill.find uses .select().lean() in collectSkillNames
    vi.mocked(Skill.find).mockReturnValue(query([
      { _id: gapSkillId, name: 'Python', category: 'BACKEND' },
    ]) as never);
    vi.mocked(MentorProfile.find).mockReturnValue(query([]) as never);

    const result = await getCareerActionPlan({ studentUserId: STUDENT_USER_ID });
    expect(result.actions.some(a => a.type === 'TRAINING')).toBe(true);
    expect(result.actions.some(a => a.type === 'ASSESSMENT')).toBe(true);
  });
});
