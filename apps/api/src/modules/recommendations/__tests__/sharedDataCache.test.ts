/**
 * Phase-2 performance work — 60 s shared cache for non-user-specific
 * recommendation inputs. Covers TTL expiry, in-flight sharing, failure
 * eviction, immutability, absence of student ids, cross-user sharing of
 * only shared data, and benchmark equivalence with the uncached path.
 */
import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => {
  const m = () => ({ find: vi.fn(), findOne: vi.fn(), aggregate: vi.fn() });
  return {
    StudentProfile: m(),
    StudentSkill: m(),
    Assessment: m(),
    TrainingEnrollment: m(),
    TrainingProgram: m(),
    Job: m(),
    Internship: m(),
    Application: m(),
    Skill: m(),
  };
});

import * as models from '../../../models';
import { TtlCache, clearAllTtlCaches, deepFreeze } from '../../../utils/ttlCache';
import { SHARED_DATA_TTL_MS, benchmarkPeerStats, publishedJobs } from '../sharedDataCache';
import { StudentDataLoader } from '../studentDataLoader';
import { getCareerBenchmark } from '../careerAnalysis.service';
import { recommendJobs } from '../recommendations.service';

type Fn = ReturnType<typeof vi.fn>;
const M = models as unknown as Record<
  'StudentProfile' | 'StudentSkill' | 'Job' | 'Application' | 'TrainingProgram',
  { find: Fn; findOne: Fn; aggregate: Fn }
>;

function chain<T>(result: T) {
  const q: Record<string, unknown> = {};
  for (const k of ['populate', 'select', 'sort', 'skip', 'limit']) q[k] = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (f: (v: T) => unknown, r?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(f, r);
  return q;
}
const oid = () => new Types.ObjectId();

beforeEach(() => {
  vi.clearAllMocks();
  clearAllTtlCaches();
});
afterEach(() => vi.useRealTimers());

describe('TtlCache', () => {
  it('serves a hit within the TTL and reloads once the TTL has passed', async () => {
    vi.useFakeTimers();
    const cache = new TtlCache<number>(60_000);
    let n = 0;
    const load = vi.fn(async () => ++n);
    expect(await cache.get('k', load)).toBe(1);
    vi.advanceTimersByTime(59_999);
    expect(await cache.get('k', load)).toBe(1);
    vi.advanceTimersByTime(1);
    expect(await cache.get('k', load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('concurrent misses share one in-flight load', async () => {
    const cache = new TtlCache<string>(1000);
    const load = vi.fn(async () => 'v');
    const [a, b, c] = await Promise.all([
      cache.get('k', load),
      cache.get('k', load),
      cache.get('k', load),
    ]);
    expect([a, b, c]).toEqual(['v', 'v', 'v']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('evicts a failed load so the next call retries', async () => {
    const cache = new TtlCache<string>(60_000);
    await expect(cache.get('k', async () => Promise.reject(new Error('db down')))).rejects.toThrow(
      'db down',
    );
    await Promise.resolve(); // let the eviction handler run
    expect(await cache.get('k', async () => 'ok')).toBe('ok');
  });

  it('deep-freezes cached plain objects and arrays', async () => {
    const cache = new TtlCache<{ list: Array<{ x: number }> }>(1000);
    const v = await cache.get('k', async () => ({ list: [{ x: 1 }] }));
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.list)).toBe(true);
    expect(Object.isFrozen(v.list[0])).toBe(true);
    expect(() => {
      (v.list[0] as { x: number }).x = 2;
    }).toThrow(TypeError);
    expect(() => v.list.push({ x: 3 })).toThrow(TypeError);
  });

  it('does not freeze class instances such as ObjectId and Date', () => {
    const id = oid();
    const when = new Date();
    deepFreeze({ id, when });
    expect(Object.isFrozen(id)).toBe(false);
    expect(Object.isFrozen(when)).toBe(false);
    expect(id.toHexString()).toHaveLength(24);
  });

  it('clearAllTtlCaches empties every cache', async () => {
    const cache = new TtlCache<number>(60_000);
    await cache.get('k', async () => 1);
    expect(cache.size).toBe(1);
    clearAllTtlCaches();
    expect(cache.size).toBe(0);
  });
});

describe('sharedDataCache', () => {
  it('uses a 60 second TTL', () => {
    expect(SHARED_DATA_TTL_MS).toBe(60_000);
  });

  it('postings are loaded once for different students and never by user', async () => {
    M.Job.find.mockImplementation(() => chain([{ _id: oid(), title: 'J', requiredSkills: [] }]));
    const a = await new StudentDataLoader(oid().toString()).publishedJobs();
    const b = await new StudentDataLoader(oid().toString()).publishedJobs();
    expect(a).toBe(b);
    expect(M.Job.find).toHaveBeenCalledTimes(1);
    expect(M.Job.find.mock.calls[0]![0]).toEqual({ status: 'PUBLISHED' });
  });

  it('serves stale postings for at most 60 s', async () => {
    vi.useFakeTimers();
    M.Job.find.mockImplementationOnce(() => chain([{ title: 'old' }]));
    M.Job.find.mockImplementation(() => chain([{ title: 'new' }]));
    expect((await publishedJobs())[0]!.title).toBe('old');
    vi.advanceTimersByTime(SHARED_DATA_TTL_MS - 1);
    expect((await publishedJobs())[0]!.title).toBe('old');
    vi.advanceTimersByTime(1);
    expect((await publishedJobs())[0]!.title).toBe('new');
  });

  it('benchmark stats keep counts only — no student ids', async () => {
    const s1 = oid();
    const s2 = oid();
    const s3 = oid();
    M.StudentSkill.aggregate.mockResolvedValue([
      { _id: { category: 'BACKEND' }, avgRank: 2.5, count: 4, nStudents: [s1, s2] },
      { _id: { category: 'FRONTEND' }, avgRank: 3, count: 2, nStudents: [s2, s3] },
    ]);
    const stats = await benchmarkPeerStats();
    expect(stats).toEqual({
      categories: [
        { category: 'BACKEND', avgRank: 2.5, count: 4 },
        { category: 'FRONTEND', avgRank: 3, count: 2 },
      ],
      uniqueStudents: 3,
    });
    const json = JSON.stringify(stats);
    for (const id of [s1, s2, s3]) expect(json).not.toContain(String(id));
  });

  it('frozen cached postings work through recommendJobs (no mutation attempted)', async () => {
    const userId = oid().toString();
    M.StudentProfile.findOne.mockImplementation(() => chain({ _id: oid(), cgpa: 8 }));
    M.StudentSkill.find.mockImplementation(() => chain([]));
    M.Application.find.mockImplementation(() => chain([]));
    M.Job.find.mockImplementation(() =>
      chain([
        {
          _id: oid(),
          title: 'J',
          company: { _id: oid(), companyName: 'C' },
          requiredSkills: [],
          preferredSkills: [],
        },
      ]),
    );
    const first = await recommendJobs(
      userId,
      { page: 1, pageSize: 5 },
      new StudentDataLoader(userId),
    );
    const second = await recommendJobs(
      userId,
      { page: 1, pageSize: 5 },
      new StudentDataLoader(userId),
    );
    expect(second).toEqual(first);
    expect(Object.isFrozen(first.items[0]!.job)).toBe(false); // response objects are fresh copies
    expect(M.Job.find).toHaveBeenCalledTimes(1);
  });
});

describe('getCareerBenchmark — cached path matches the uncached path', () => {
  const self = oid();
  const others = Array.from({ length: 6 }, oid);

  function setup(
    ownRows: Array<{ skill: unknown; proficiency: string }>,
    selfInAggregate: boolean,
  ) {
    const userId = oid().toString();
    M.StudentProfile.findOne.mockImplementation(() => chain({ _id: self }));
    M.StudentSkill.find.mockImplementation(() => chain(ownRows));
    M.StudentSkill.aggregate.mockResolvedValue([
      {
        _id: { category: 'BACKEND' },
        avgRank: 2,
        count: 8,
        nStudents: selfInAggregate ? [self, ...others] : others,
      },
    ]);
    return userId;
  }

  async function both(userId: string) {
    clearAllTtlCaches();
    const uncached = await getCareerBenchmark(userId);
    clearAllTtlCaches();
    const cached = await getCareerBenchmark(userId, new StudentDataLoader(userId));
    return { uncached, cached };
  }

  it('student with joined skills is excluded from the sample in both paths', async () => {
    const userId = setup(
      [{ skill: { _id: oid(), category: 'BACKEND' }, proficiency: 'ADVANCED' }],
      true,
    );
    const { uncached, cached } = await both(userId);
    expect(uncached.sampleSize).toBe(6);
    expect(cached).toEqual(uncached);
  });

  it('student without skills: nobody to exclude in either path', async () => {
    const userId = setup([], false);
    const { uncached, cached } = await both(userId);
    expect(uncached.sampleSize).toBe(6);
    expect(cached).toEqual(uncached);
  });

  it('student whose only skill was deleted (populate → null) is not counted in either path', async () => {
    const userId = setup([{ skill: null, proficiency: 'BEGINNER' }], false);
    const { uncached, cached } = await both(userId);
    expect(cached.sampleSize).toBe(uncached.sampleSize);
    expect(cached).toEqual(uncached);
  });
});
