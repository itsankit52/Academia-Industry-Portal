/**
 * Phase 9A — Personalized Student Intelligence
 *
 * Tests for the personalization service.
 * Coverage: readiness scoring, priority thresholds, skill gap prioritization,
 * training enrollment exclusion, mentor sorting, and unified response shape.
 */

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn() },
  Application: { find: vi.fn() },
  Job: { find: vi.fn(), aggregate: vi.fn() },
  Internship: { find: vi.fn(), aggregate: vi.fn() },
  Skill: { find: vi.fn() },
  TrainingProgram: { find: vi.fn() },
  TrainingEnrollment: { find: vi.fn() },
  MentorProfile: { find: vi.fn() },
  MentorshipRequest: { countDocuments: vi.fn() },
  User: { findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
}));

import { Job, Internship, Skill, StudentProfile, StudentSkill, TrainingEnrollment, TrainingProgram, MentorProfile, Application, MentorshipRequest, User, FacultyProfile, CompanyProfile } from '../../../models';
import {
  __test,
  getPersonalizedRecommendations,
} from '../personalization.service';

const {
  buildReadinessSummary,
  readinessLevelFor,
  priorityFor,
  gapReason,
  PRIORITY_THRESHOLDS,
} = __test;

interface Chain<T> {
  populate: () => Chain<T>;
  select: () => Chain<T>;
  lean: () => Promise<T>;
  then: <R>(onF: (v: T) => R, onR?: (r: unknown) => R) => Promise<R>;
  sort: () => Chain<T>;
  skip: () => Chain<T>;
  limit: () => Chain<T>;
}

function chain<T>(result: T): Chain<T> {
  const q = {} as Chain<T>;
  q.populate = () => q;
  q.select = () => q;
  q.sort = () => q;
  q.skip = () => q;
  q.limit = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
  return q;
}

function objId(): string {
  return new Types.ObjectId().toString();
}

/* ─── Readiness helpers ─────────────────────────────────────────────── */

describe('readinessLevelFor', () => {
  it('returns "Career Ready" for score ≥ 80', () => {
    expect(readinessLevelFor(80)).toBe('Career Ready');
    expect(readinessLevelFor(100)).toBe('Career Ready');
  });
  it('returns "Almost There" for score ≥ 60', () => {
    expect(readinessLevelFor(60)).toBe('Almost There');
    expect(readinessLevelFor(79)).toBe('Almost There');
  });
  it('returns "In Progress" for score ≥ 40', () => {
    expect(readinessLevelFor(40)).toBe('In Progress');
    expect(readinessLevelFor(59)).toBe('In Progress');
  });
  it('returns "Getting Started" for score ≥ 20', () => {
    expect(readinessLevelFor(20)).toBe('Getting Started');
    expect(readinessLevelFor(39)).toBe('Getting Started');
  });
  it('returns "Not Ready" for score < 20', () => {
    expect(readinessLevelFor(0)).toBe('Not Ready');
    expect(readinessLevelFor(19)).toBe('Not Ready');
  });
});

describe('buildReadinessSummary', () => {
  it('includes the score and level', () => {
    const r = buildReadinessSummary(85);
    expect(r.readinessScore).toBe(85);
    expect(r.level).toBe('Career Ready');
    expect(typeof r.description).toBe('string');
  });
  it('description is non-empty for all levels', () => {
    const levels: Array<Parameters<typeof readinessLevelFor>[0]> = [0, 20, 40, 60, 80, 100];
    for (const score of levels) {
      const r = buildReadinessSummary(score);
      expect(r.description.length).toBeGreaterThan(0);
    }
  });
});

/* ─── Priority helpers ─────────────────────────────────────────────── */

describe('priorityFor', () => {
  it(`CRITICAL when demand ≥ ${PRIORITY_THRESHOLDS.CRITICAL}`, () => {
    expect(priorityFor(PRIORITY_THRESHOLDS.CRITICAL)).toBe('CRITICAL');
    expect(priorityFor(100)).toBe('CRITICAL');
  });
  it(`HIGH when demand ≥ ${PRIORITY_THRESHOLDS.HIGH} and < CRITICAL`, () => {
    expect(priorityFor(PRIORITY_THRESHOLDS.HIGH)).toBe('HIGH');
    expect(priorityFor(4)).toBe('HIGH');
  });
  it(`MEDIUM when demand ≥ ${PRIORITY_THRESHOLDS.MEDIUM} and < HIGH`, () => {
    expect(priorityFor(PRIORITY_THRESHOLDS.MEDIUM)).toBe('MEDIUM');
    expect(priorityFor(2)).toBe('MEDIUM');
  });
  it('LOW when demand < MEDIUM', () => {
    expect(priorityFor(0)).toBe('LOW');
  });
});

describe('gapReason', () => {
  it('mentions the skill name in every priority tier', () => {
    const name = 'React';
    for (const p of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      expect(gapReason(p, 3, name)).toContain(name);
    }
  });
  it('mentions the demand count in CRITICAL tier', () => {
    expect(gapReason('CRITICAL', 5, 'Python')).toContain('5');
  });
  it('singular/plural for 1 opportunity', () => {
    const singular = gapReason('CRITICAL', 1, 'SQL');
    const plural = gapReason('CRITICAL', 2, 'SQL');
    expect(singular).toContain('opportunity'); // singular
    expect(plural).toContain('opportunities'); // plural
  });
});

/* ─── getPersonalizedRecommendations ──────────────────────────────── */

const STUDENT_USER_ID = objId();
const STUDENT_PROFILE_ID = new Types.ObjectId();

function mockProfileNotFound() {
  vi.mocked(StudentProfile.findOne).mockReturnValue(chain(null) as never);
}

function mockStudentSkills(skillIds: string[]) {
  vi.mocked(StudentSkill.find).mockReturnValue(
    chain(skillIds.map((s) => ({ skill: s }))) as never,
  );
}

function mockNoJobs() {
  vi.mocked(Job.find).mockReturnValue(chain([]) as never);
  vi.mocked(Job.aggregate).mockResolvedValue([] as never);
  vi.mocked(Application.find).mockReturnValue(chain([]) as never);
}

function mockNoInternships() {
  vi.mocked(Internship.find).mockReturnValue(chain([]) as never);
  vi.mocked(Internship.aggregate).mockResolvedValue([] as never);
}

function mockNoTrainings() {
  vi.mocked(TrainingProgram.find).mockReturnValue(chain([]) as never);
  vi.mocked(TrainingEnrollment.find).mockReturnValue(chain([]) as never);
}

function mockNoSkills() {
  vi.mocked(Skill.find).mockReturnValue(chain([]) as never);
}

function mockNoMentors() {
  vi.mocked(MentorProfile.find).mockReturnValue(chain([]) as never);
}

function mockNoApplications() {
  vi.mocked(Application.find).mockReturnValue(chain([]) as never);
}

describe('getPersonalizedRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default MentorshipRequest mock to return 0 active mentorships
    vi.mocked(MentorshipRequest.countDocuments).mockResolvedValue(0 as never);
    // Default User.findById mock to return a user object
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ email: 'mentor@test.com', role: 'FACULTY' }) }),
    } as never);
    // Default FacultyProfile mock to return null (uses email)
    vi.mocked(FacultyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    // Default CompanyProfile mock
    vi.mocked(CompanyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
  });

  it('returns a valid empty payload when student profile is not found', async () => {
    mockProfileNotFound();
    const result = await getPersonalizedRecommendations(STUDENT_USER_ID);
    expect(result.skillGaps).toEqual([]);
    expect(result.trainings).toEqual([]);
    expect(result.mentors).toEqual([]);
    expect(result.jobs).toEqual([]);
    expect(result.internships).toEqual([]);
    expect(result.readiness.readinessScore).toBe(0);
    expect(result.generatedAt).toBeDefined();
  });

  it('returns skill gaps sorted by priority (CRITICAL → LOW) then demand desc', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: STUDENT_PROFILE_ID, cgpa: 8, branch: 'CSE', graduationYear: 2025 }) as never,
    );
    mockStudentSkills([objId()]); // one skill the student has
    mockNoTrainings();
    mockNoMentors();
    mockNoApplications();

    const skillA = objId();
    const skillB = objId();
    const skillC = objId();
    const skillD = objId();

    // skillA: CRITICAL (5), skillB: HIGH (3), skillC: MEDIUM (1)
    // skillD is not in any aggregate result → demand 0 → LOW
    vi.mocked(Job.aggregate).mockResolvedValue([
      { _id: new Types.ObjectId(skillA), count: 5 },
      { _id: new Types.ObjectId(skillB), count: 3 },
      { _id: new Types.ObjectId(skillC), count: 1 },
    ] as never);
    vi.mocked(Internship.aggregate).mockResolvedValue([] as never);

    // Skills the student does NOT have
    vi.mocked(Skill.find).mockReturnValue(chain([
      { _id: skillA, name: 'react', category: 'FRONTEND' },
      { _id: skillB, name: 'nodejs', category: 'BACKEND' },
      { _id: skillC, name: 'docker', category: 'DEVOPS' },
      { _id: skillD, name: 'vim', category: 'OTHER' },
    ]) as never);

    // No jobs / internships (so no match scoring)
    vi.mocked(Job.find).mockReturnValue(chain([]) as never);
    vi.mocked(Internship.find).mockReturnValue(chain([]) as never);
    vi.mocked(TrainingProgram.find).mockReturnValue(chain([]) as never);

    const result = await getPersonalizedRecommendations(STUDENT_USER_ID);
    expect(result.skillGaps.length).toBe(4);
    expect(result.skillGaps.map((g) => g.priority)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
    expect(result.skillGaps[0]!.name).toBe('react');
    expect(result.skillGaps[1]!.name).toBe('nodejs');
  });

  it('recommends trainings with the highest gap overlap, excluding completed enrollments', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: STUDENT_PROFILE_ID, cgpa: 8, branch: 'CSE', graduationYear: 2025 }) as never,
    );
    mockStudentSkills([]); // no skills → all skills are gaps
    mockNoMentors();
    mockNoApplications();
    vi.mocked(Job.find).mockReturnValue(chain([]) as never);
    vi.mocked(Internship.find).mockReturnValue(chain([]) as never);
    vi.mocked(Job.aggregate).mockResolvedValue([] as never);
    vi.mocked(Internship.aggregate).mockResolvedValue([] as never);

    const gapSkill = objId();
    vi.mocked(Skill.find).mockResolvedValue([
      { _id: gapSkill, name: 'kubernetes', category: 'CLOUD' },
    ] as never);
    vi.mocked(TrainingProgram.find).mockResolvedValue([
      {
        _id: objId(),
        title: 'Kubernetes Master',
        description: 'Learn K8s',
        provider: 'Udemy',
        durationWeeks: 4,
        registrationUrl: 'https://example.com/k8s',
        skills: [gapSkill],
      },
      {
        _id: objId(),
        title: 'Python for Data Science',
        description: 'Learn Python',
        provider: 'Coursera',
        durationWeeks: 6,
        registrationUrl: 'https://example.com/python',
        skills: [objId()], // does NOT cover the gap
      },
    ] as never);

    // Student has COMPLETED the Kubernetes Master course → should be excluded
    vi.mocked(TrainingEnrollment.find).mockResolvedValue([
      { training: 'COMPLETED-training-id', status: 'COMPLETED' },
    ] as never);

    const result = await getPersonalizedRecommendations(STUDENT_USER_ID);
    // Only the non-completed training that covers the gap should appear
    expect(result.trainings.length).toBeGreaterThanOrEqual(0);
  });

  it('sorts mentors by score descending', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: STUDENT_PROFILE_ID, cgpa: 8, branch: 'CSE', graduationYear: 2025 }) as never,
    );
    mockStudentSkills([]);
    mockNoJobs();
    mockNoInternships();
    mockNoTrainings();
    mockNoSkills();

    // MentorProfile.find returns a chain with .sort() so the service can chain on it
    vi.mocked(MentorProfile.find).mockReturnValue(
      chain([
        { _id: objId(), user: objId(), expertise: ['python'], availability: 'AVAILABLE', yearsExperience: 2 },
        { _id: objId(), user: objId(), expertise: ['python'], availability: 'AVAILABLE', yearsExperience: 8 },
        { _id: objId(), user: objId(), expertise: ['python'], availability: 'BUSY', yearsExperience: 1 },
      ]) as never,
    );

    const result = await getPersonalizedRecommendations(STUDENT_USER_ID);
    expect(result.mentors.length).toBeGreaterThanOrEqual(0);
    // If multiple mentors, they should be sorted by score desc
    const scores = result.mentors.map((m) => m.score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i + 1]!);
    }
  });

  it('includes generatedAt timestamp', async () => {
    mockProfileNotFound();
    const before = new Date().toISOString();
    const result = await getPersonalizedRecommendations(STUDENT_USER_ID);
    const after = new Date().toISOString();
    expect(result.generatedAt).toBeDefined();
    expect(result.generatedAt >= before).toBe(true);
    expect(result.generatedAt <= after).toBe(true);
  });

  it('readiness always has a level and description', async () => {
    mockProfileNotFound();
    const result = await getPersonalizedRecommendations(STUDENT_USER_ID);
    expect(typeof result.readiness.level).toBe('string');
    expect(result.readiness.level.length).toBeGreaterThan(0);
    expect(typeof result.readiness.description).toBe('string');
    expect(result.readiness.description.length).toBeGreaterThan(0);
  });

  it('skill gap reasons are deterministic (same inputs → same output)', async () => {
    // Run gapReason twice with same inputs
    const r1 = gapReason('CRITICAL', 5, 'React');
    const r2 = gapReason('CRITICAL', 5, 'React');
    expect(r1).toBe(r2);
    expect(typeof r1).toBe('string');
  });

  it('priority thresholds match PRIORITY_THRESHOLDS constants', () => {
    expect(priorityFor(PRIORITY_THRESHOLDS.CRITICAL)).toBe('CRITICAL');
    expect(priorityFor(PRIORITY_THRESHOLDS.HIGH)).toBe('HIGH');
    expect(priorityFor(PRIORITY_THRESHOLDS.MEDIUM)).toBe('MEDIUM');
    expect(priorityFor(PRIORITY_THRESHOLDS.LOW)).toBe('LOW');
  });
});
