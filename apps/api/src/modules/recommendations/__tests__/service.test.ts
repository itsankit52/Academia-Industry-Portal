import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn() },
  Application: { find: vi.fn() },
  Job: { find: vi.fn() },
  Internship: { find: vi.fn() },
  Skill: { find: vi.fn() },
  TrainingProgram: { find: vi.fn() },
}));

import { Application, Job, StudentProfile, StudentSkill } from '../../../models';
import { recommendJobs } from '../recommendations.service';

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
  q.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
  return q;
}

function objId(): string {
  return new Types.ObjectId().toString();
}

interface JobRow {
  _id: string;
  title: string;
  status: 'PUBLISHED';
  requiredSkills: Array<{ _id: string }>;
  preferredSkills: Array<{ _id: string }>;
  minCgpa?: number;
  eligibleBranches?: string[];
  eligibleGradYears?: number[];
}

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    _id: objId(),
    title: 'Job',
    status: 'PUBLISHED',
    requiredSkills: [],
    preferredSkills: [],
    ...overrides,
  };
}

const USER_ID = objId();
const STUDENT_PID = new Types.ObjectId();

const DEFAULT_PROFILE = {
  _id: STUDENT_PID,
  cgpa: 8.5,
  branch: 'Computer Science',
  graduationYear: 2025,
};

function mockProfile(overrides: Partial<typeof DEFAULT_PROFILE> = {}): void {
  vi.mocked(StudentProfile.findOne).mockReturnValue(
    query({ ...DEFAULT_PROFILE, ...overrides }) as never,
  );
}

function mockStudentSkills(
  skillIds: string[],
  proficiencies?: Array<{ skillId: string; proficiency: string }>,
): void {
  const profMap = new Map((proficiencies ?? []).map((p) => [p.skillId, p.proficiency]));
  vi.mocked(StudentSkill.find).mockReturnValue(
    query(
      skillIds.map((s) => ({
        skill: s,
        proficiency: profMap.get(s) ?? 'INTERMEDIATE',
      })),
    ) as never,
  );
}

function mockApplications(oppIds: string[]): void {
  vi.mocked(Application.find).mockReturnValue(
    query(oppIds.map((id) => ({ opportunity: id }))) as never,
  );
}

function mockJobs(jobs: JobRow[]): void {
  vi.mocked(Job.find).mockReturnValue(query(jobs) as never);
}

describe('recommendJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile();
    mockStudentSkills([]);
    mockApplications([]);
    mockJobs([]);
  });

  it('filters CLOSED / DRAFT / ARCHIVED jobs via status=PUBLISHED', async () => {
    await recommendJobs(USER_ID, {});
    expect(Job.find).toHaveBeenCalledWith({ status: 'PUBLISHED' });
  });

  it('sorts recommendations descending by matchScore', async () => {
    const skillA = objId();
    const skillB = objId();
    const skillC = objId();
    mockStudentSkills([skillA, skillB, skillC]);
    const lowJob = makeJob({
      title: 'Low',
      requiredSkills: [{ _id: objId() }, { _id: objId() }],
      preferredSkills: [],
    });
    const midJob = makeJob({
      title: 'Mid',
      requiredSkills: [{ _id: skillA }, { _id: objId() }],
      preferredSkills: [],
    });
    const highJob = makeJob({
      title: 'High',
      requiredSkills: [{ _id: skillA }, { _id: skillB }],
      preferredSkills: [{ _id: skillC }],
    });
    mockJobs([lowJob, midJob, highJob]);

    const result = await recommendJobs(USER_ID, {});
    const titles = result.items.map((r) => r.job.title);
    expect(titles).toEqual(['High', 'Mid', 'Low']);
    expect(result.items[0]!.matchResult.score).toBeGreaterThan(result.items[1]!.matchResult.score);
    expect(result.items[1]!.matchResult.score).toBeGreaterThan(result.items[2]!.matchResult.score);
  });

  it('marks eligible=false when student CGPA is below minCgpa', async () => {
    mockProfile({ cgpa: 6.0 });
    mockJobs([makeJob({ minCgpa: 8.0 })]);
    const result = await recommendJobs(USER_ID, {});
    expect(result.items[0]!.eligible).toBe(false);
  });

  it('marks eligible=false when student branch is not in eligibleBranches', async () => {
    mockProfile({ branch: 'Mechanical Engineering' });
    mockJobs([makeJob({ eligibleBranches: ['Computer Science', 'Data Science'] })]);
    const result = await recommendJobs(USER_ID, {});
    expect(result.items[0]!.eligible).toBe(false);
  });

  it('marks eligible=false when student gradYear is not in eligibleGradYears', async () => {
    mockProfile({ graduationYear: 2027 });
    mockJobs([makeJob({ eligibleGradYears: [2025, 2026] })]);
    const result = await recommendJobs(USER_ID, {});
    expect(result.items[0]!.eligible).toBe(false);
  });

  it('marks eligible=true when all eligibility checks pass', async () => {
    mockJobs([
      makeJob({
        minCgpa: 7.0,
        eligibleBranches: ['Computer Science'],
        eligibleGradYears: [2025],
      }),
    ]);
    const result = await recommendJobs(USER_ID, {});
    expect(result.items[0]!.eligible).toBe(true);
  });

  it('respects pagination boundaries', async () => {
    const jobs = [makeJob(), makeJob(), makeJob(), makeJob(), makeJob()];
    mockJobs(jobs);
    const page1 = await recommendJobs(USER_ID, { page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(2);
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);

    const page3 = await recommendJobs(USER_ID, { page: 3, pageSize: 2 });
    expect(page3.items).toHaveLength(1);
    expect(page3.page).toBe(3);
  });

  it('excludes jobs the student has already applied to', async () => {
    const appliedId = objId();
    const openId = objId();
    mockApplications([appliedId]);
    mockJobs([
      makeJob({ _id: appliedId, title: 'Applied' }),
      makeJob({ _id: openId, title: 'Open' }),
    ]);
    const result = await recommendJobs(USER_ID, {});
    const titles = result.items.map((r) => r.job.title);
    expect(titles).toEqual(['Open']);
    expect(result.total).toBe(1);
  });

  // These queries read with `.lean()`, which skips the schema's `toJSON`
  // transform. Every client key and detail link is built from `id`, so a row
  // that still carried `_id` sent the student to `/student/jobs/undefined`.
  describe('serialization of the lean rows', () => {
    it('exposes the posting as `id`, never as `_id`', async () => {
      const jobId = objId();
      mockJobs([makeJob({ _id: jobId })]);
      const result = await recommendJobs(USER_ID, {});
      const job = result.items[0]!.job as unknown as Record<string, unknown>;
      expect(job.id).toBe(jobId);
      expect(job._id).toBeUndefined();
    });

    it('drops the __v version key', async () => {
      mockJobs([{ ...makeJob(), __v: 4 } as unknown as JobRow]);
      const result = await recommendJobs(USER_ID, {});
      const job = result.items[0]!.job as unknown as Record<string, unknown>;
      expect(job.__v).toBeUndefined();
    });

    it('normalizes the populated company to the { id, name } shape the cards read', async () => {
      const companyId = objId();
      mockJobs([
        {
          ...makeJob(),
          company: { _id: companyId, companyName: 'Initech', logoUrl: '/logo.png' },
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      const job = result.items[0]!.job as unknown as Record<string, unknown>;
      const company = job.company as Record<string, unknown>;
      expect(company.id).toBe(companyId);
      expect(company.name).toBe('Initech');
      expect(company.logoUrl).toBe('/logo.png');
    });
  });

  // `matchResult` can only report skill ids, because that is what the algorithm
  // compares. Rendering those directly would print a raw ObjectId in a chip.
  describe('named skill resolution', () => {
    it('returns matched and missing skills as { id, name } pairs', async () => {
      const held = objId();
      const absent = objId();
      mockStudentSkills([held]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [
            { _id: held, name: 'typescript' },
            { _id: absent, name: 'kubernetes' },
          ],
        } as unknown as JobRow,
      ]);

      const result = await recommendJobs(USER_ID, {});
      const item = result.items[0]!;
      expect(item.matchedSkills).toEqual([{ id: held, name: 'typescript' }]);
      expect(item.missingSkills).toEqual([{ id: absent, name: 'kubernetes' }]);
    });

    // Preferred skills are optional, so `computeMatch` deliberately reports only
    // `required − held` as missing. A preferred skill the student lacks must not
    // be presented as a gap they have to close.
    it('does not report an unmatched preferred skill as missing', async () => {
      const preferred = objId();
      mockStudentSkills([]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [],
          preferredSkills: [{ _id: preferred, name: 'graphql' }],
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      expect(result.items[0]!.missingSkills).toEqual([]);
      expect(result.items[0]!.matchedSkills).toEqual([]);
    });

    it('resolves the name of a skill listed as both required and preferred exactly once', async () => {
      const both = objId();
      mockStudentSkills([both]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [{ _id: both, name: 'python' }],
          preferredSkills: [{ _id: both, name: 'python' }],
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      expect(result.items[0]!.matchedSkills).toEqual([{ id: both, name: 'python' }]);
      expect(result.items[0]!.missingSkills).toEqual([]);
    });

    // A skill deleted from the catalogue after a posting referenced it has no
    // name left, and showing its id would be worse than omitting it.
    it('omits a skill that has no resolvable name rather than showing its id', async () => {
      const orphan = objId();
      mockStudentSkills([]);
      mockJobs([{ ...makeJob(), requiredSkills: [{ _id: orphan }] } as unknown as JobRow]);
      const result = await recommendJobs(USER_ID, {});
      expect(result.items[0]!.missingSkills).toEqual([]);
      // The score is still computed from the id, so the gap is not hidden.
      expect(result.items[0]!.matchResult.missingSkills).toContain(orphan);
    });

    it('never invents a skill the posting did not list', async () => {
      const held = objId();
      mockStudentSkills([held, objId(), objId()]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [{ _id: held, name: 'typescript' }],
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      const item = result.items[0]!;
      const names = [...item.matchedSkills, ...item.missingSkills].map((s) => s.name);
      expect(names).toEqual(['typescript']);
    });
  });

  // Phase 4: per-skill proficiency gaps. The recommendation card uses these
  // to show "Level up" warnings without an additional round trip.
  describe('proficiencyGaps', () => {
    it('reports a missing gap when the student has not added the required skill', async () => {
      const missing = objId();
      mockStudentSkills([]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [{ _id: missing, name: 'kubernetes' }],
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      const item = result.items[0]!;
      expect(item.proficiencyGaps).toHaveLength(1);
      expect(item.proficiencyGaps[0]).toMatchObject({
        id: missing,
        name: 'kubernetes',
        studentLevel: null,
        missing: true,
      });
    });

    it('reports a level-up gap when student proficiency is below the inferred required level', async () => {
      const skillId = objId();
      mockStudentSkills([skillId], [{ skillId, proficiency: 'BEGINNER' }]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [{ _id: skillId, name: 'Python' }],
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      const item = result.items[0]!;
      expect(item.proficiencyGaps).toHaveLength(1);
      expect(item.proficiencyGaps[0]).toMatchObject({
        id: skillId,
        name: 'Python',
        studentLevel: 'BEGINNER',
        missing: false,
        gapLevels: 2, // BEGINNER (1) → ADVANCED (3)
      });
    });

    it('reports no gap when the student is at EXPERT level', async () => {
      const skillId = objId();
      mockStudentSkills([skillId], [{ skillId, proficiency: 'EXPERT' }]);
      mockJobs([
        {
          ...makeJob(),
          requiredSkills: [{ _id: skillId, name: 'Rust' }],
        } as unknown as JobRow,
      ]);
      const result = await recommendJobs(USER_ID, {});
      expect(result.items[0]!.proficiencyGaps).toEqual([]);
    });

    it('returns an empty gaps list when the opportunity has no required skills', async () => {
      mockStudentSkills([objId()], []);
      mockJobs([makeJob({ requiredSkills: [] })]);
      const result = await recommendJobs(USER_ID, {});
      expect(result.items[0]!.proficiencyGaps).toEqual([]);
    });
  });
});
