/**
 * Phase-2 performance work — request-scoped StudentDataLoader.
 *
 * Covers: per-call query budget of getPersonalizedRecommendations, cross-user
 * isolation (two students never share loaded data), memoisation, the
 * profile-ownership guard, and the in-memory equivalents of the replaced queries.
 */
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => {
  const m = () => ({
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
  });
  return {
    StudentProfile: m(),
    StudentSkill: m(),
    Application: m(),
    Job: m(),
    Internship: m(),
    Skill: m(),
    TrainingProgram: m(),
    TrainingEnrollment: m(),
    MentorProfile: m(),
    MentorshipRequest: m(),
    User: m(),
    FacultyProfile: m(),
    CompanyProfile: m(),
    Assessment: m(),
    Resume: m(),
    CollaborationEvent: m(),
  };
});

import * as models from '../../../models';
import { StudentDataLoader } from '../studentDataLoader';
import { getPersonalizedRecommendations } from '../personalization.service';
import { buildGapClosingTrainings, loadAssessmentSignals } from '../careerAnalysis.service';

type Fn = ReturnType<typeof vi.fn>;
interface MockModel {
  find: Fn;
  findOne: Fn;
  findById: Fn;
  aggregate: Fn;
  countDocuments: Fn;
}
type ModelName =
  | 'StudentProfile'
  | 'StudentSkill'
  | 'Application'
  | 'Job'
  | 'Internship'
  | 'Skill'
  | 'TrainingProgram'
  | 'TrainingEnrollment'
  | 'MentorProfile'
  | 'MentorshipRequest'
  | 'User'
  | 'FacultyProfile'
  | 'CompanyProfile'
  | 'Assessment'
  | 'Resume'
  | 'CollaborationEvent';
const M = models as unknown as Record<ModelName, MockModel>;

/** Thenable query chain resolving to `result`. */
function chain<T>(result: T) {
  const q: Record<string, unknown> = {};
  for (const k of ['populate', 'select', 'sort', 'skip', 'limit']) q[k] = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (f: (v: T) => unknown, r?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(f, r);
  return q;
}

const oid = () => new Types.ObjectId();

interface Student {
  userId: string;
  profileId: Types.ObjectId;
  skillId: Types.ObjectId;
}
function student(): Student {
  return { userId: oid().toString(), profileId: oid(), skillId: oid() };
}

/** Wires every model so each student's queries return that student's rows. */
function wire(students: Student[]) {
  const byUser = new Map(students.map((s) => [s.userId, s]));
  const byProfile = new Map(students.map((s) => [String(s.profileId), s]));
  for (const model of Object.values(M)) {
    for (const fn of Object.values(model)) {
      fn.mockReset();
      fn.mockImplementation(() => chain([]));
    }
    model.aggregate.mockResolvedValue([]);
    model.countDocuments.mockResolvedValue(0);
    model.findOne.mockImplementation(() => chain(null));
  }
  M.StudentProfile.findOne.mockImplementation((filter: { user: Types.ObjectId }) => {
    const s = byUser.get(String(filter.user));
    return chain(
      s ? { _id: s.profileId, user: filter.user, careerInterests: '', preferredRoles: [] } : null,
    );
  });
  M.StudentSkill.find.mockImplementation((filter: { student: Types.ObjectId }) => {
    const s = byProfile.get(String(filter.student));
    return chain(
      s
        ? [
            {
              _id: oid(),
              student: s.profileId,
              skill: s.skillId,
              proficiency: 'ADVANCED',
              createdAt: new Date(0),
            },
          ]
        : [],
    );
  });
  M.User.findById.mockImplementation(() => chain(null));
}

beforeEach(() => vi.clearAllMocks());

describe('getPersonalizedRecommendations — query budget', () => {
  it('loads the student profile once and each per-student collection at most once', async () => {
    const s = student();
    wire([s]);
    // Give the student a skill gap covered by an ACTIVE training so every
    // loader-backed path (gaps, trainings, next action) is exercised.
    const gapSkill = oid();
    M.Job.aggregate.mockResolvedValue([{ _id: gapSkill, count: 5 }]);
    M.Skill.find.mockImplementation(() =>
      chain([{ _id: gapSkill, name: 'react', category: 'FRONTEND' }]),
    );
    const training = { _id: oid(), title: 'React 101', status: 'ACTIVE', skills: [gapSkill] };
    M.TrainingProgram.find.mockImplementation(() => chain([training]));

    const result = await getPersonalizedRecommendations(s.userId);
    expect(result.skillGaps.map((g) => g.name)).toEqual(['react']);
    expect(result.trainings.map((t) => t.title)).toEqual(['React 101']);

    expect(M.StudentProfile.findOne).toHaveBeenCalledTimes(1);
    // raw rows + the populated variant used by skill profile / benchmark
    expect(M.StudentSkill.find).toHaveBeenCalledTimes(2);
    expect(M.StudentSkill.findOne).not.toHaveBeenCalled(); // oldest skill derived in memory
    expect(M.TrainingEnrollment.find).toHaveBeenCalledTimes(1);
    expect(M.Assessment.find).toHaveBeenCalledTimes(1);
    expect(M.Assessment.findOne).not.toHaveBeenCalled(); // latest assessment derived in memory
    // raw ACTIVE list + populated ACTIVE list
    expect(M.TrainingProgram.find).toHaveBeenCalledTimes(2);
  });

  it('a second call creates a fresh loader (nothing is memoised across requests)', async () => {
    const s = student();
    wire([s]);
    await getPersonalizedRecommendations(s.userId);
    await getPersonalizedRecommendations(s.userId);
    expect(M.StudentProfile.findOne).toHaveBeenCalledTimes(2);
  });
});

describe('getPersonalizedRecommendations — cross-user isolation', () => {
  it('each call only queries its own student and returns its own skills', async () => {
    const a = student();
    const b = student();
    wire([a, b]);

    const ra = await getPersonalizedRecommendations(a.userId);
    const rb = await getPersonalizedRecommendations(b.userId);

    const profileUsers = M.StudentProfile.findOne.mock.calls.map((c) => String(c[0].user));
    expect(profileUsers).toEqual([a.userId, b.userId]);

    const skillStudents = M.StudentSkill.find.mock.calls.map((c) => String(c[0].student));
    const firstHalf = skillStudents.slice(0, skillStudents.length / 2);
    const secondHalf = skillStudents.slice(skillStudents.length / 2);
    expect(new Set(firstHalf)).toEqual(new Set([String(a.profileId)]));
    expect(new Set(secondHalf)).toEqual(new Set([String(b.profileId)]));

    expect(JSON.stringify(ra)).not.toContain(String(b.skillId));
    expect(JSON.stringify(rb)).not.toContain(String(a.skillId));
  });

  it('concurrent calls for different students do not share data', async () => {
    const a = student();
    const b = student();
    wire([a, b]);
    const [ra, rb] = await Promise.all([
      getPersonalizedRecommendations(a.userId),
      getPersonalizedRecommendations(b.userId),
    ]);
    expect(JSON.stringify(ra)).not.toContain(String(b.skillId));
    expect(JSON.stringify(rb)).not.toContain(String(a.skillId));
  });
});

describe('StudentDataLoader', () => {
  it('rejects an invalid user id', () => {
    expect(() => new StudentDataLoader('not-an-id')).toThrow();
  });

  it('memoises each read for the lifetime of the loader', async () => {
    const s = student();
    wire([s]);
    const l = new StudentDataLoader(s.userId);
    await Promise.all([l.profile(), l.profile(), l.studentSkills(), l.studentSkills()]);
    await l.completedEnrollments();
    await l.completedEnrollments();
    expect(M.StudentProfile.findOne).toHaveBeenCalledTimes(1);
    expect(M.StudentSkill.find).toHaveBeenCalledTimes(1);
    expect(M.TrainingEnrollment.find).toHaveBeenCalledTimes(1);
  });

  it('queries only by its own user id and profile id', async () => {
    const s = student();
    wire([s]);
    const l = new StudentDataLoader(s.userId);
    await Promise.all([l.studentSkills(), l.evaluatedAssessments(), l.completedEnrollments()]);
    expect(String(M.StudentProfile.findOne.mock.calls[0]![0].user)).toBe(s.userId);
    expect(String(M.StudentSkill.find.mock.calls[0]![0].student)).toBe(String(s.profileId));
    expect(String(M.Assessment.find.mock.calls[0]![0].student)).toBe(String(s.profileId));
    expect(M.Assessment.find.mock.calls[0]![0].status).toBe('EVALUATED');
    expect(String(M.TrainingEnrollment.find.mock.calls[0]![0].student)).toBe(String(s.profileId));
    expect(M.TrainingEnrollment.find.mock.calls[0]![0].status).toBe('COMPLETED');
  });

  it('returns empty per-student data (no query) when the profile does not exist', async () => {
    wire([]);
    const l = new StudentDataLoader(oid().toString());
    expect(await l.profile()).toBeNull();
    expect(await l.studentSkills()).toEqual([]);
    expect(M.StudentSkill.find).not.toHaveBeenCalled();
  });

  it('assertProfile throws for another student’s profile id', async () => {
    const s = student();
    wire([s]);
    const l = new StudentDataLoader(s.userId);
    await expect(l.assertProfile(s.profileId)).resolves.toBeUndefined();
    await expect(l.assertProfile(oid())).rejects.toThrow(/does not belong/);
  });

  it('sub-services refuse a loader that belongs to a different student', async () => {
    const a = student();
    const b = student();
    wire([a, b]);
    const loaderA = new StudentDataLoader(a.userId);
    await expect(
      buildGapClosingTrainings(b.profileId, [oid().toString()], loaderA),
    ).rejects.toThrow(/does not belong/);
    await expect(loadAssessmentSignals(b.profileId, loaderA)).rejects.toThrow(/does not belong/);
  });

  describe('oldestStudentSkill (replaces findOne().sort({createdAt: 1}))', () => {
    function withRows(rows: Array<{ createdAt?: Date }>) {
      const s = student();
      wire([s]);
      M.StudentSkill.find.mockImplementation(() => chain(rows));
      return new StudentDataLoader(s.userId);
    }
    it('null when the student has no skills', async () => {
      expect(await withRows([]).oldestStudentSkill()).toBeNull();
    });
    it('earliest createdAt wins', async () => {
      const l = withRows([
        { createdAt: new Date(3000) },
        { createdAt: new Date(1000) },
        { createdAt: new Date(2000) },
      ]);
      expect((await l.oldestStudentSkill())?.createdAt?.getTime()).toBe(1000);
    });
    it('a row without createdAt sorts first, as in MongoDB', async () => {
      const l = withRows([{ createdAt: new Date(1000) }, {}]);
      expect(await l.oldestStudentSkill()).toEqual({ createdAt: undefined });
    });
  });
});
