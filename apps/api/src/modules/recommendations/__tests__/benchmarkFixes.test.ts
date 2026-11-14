/**
 * Regression tests for two getCareerBenchmark bugs (fixed in phase-2 perf work):
 *   1. categories[] followed MongoDB's unspecified $group order (nondeterministic).
 *   2. the student's own per-category score read `row.skillDoc.category`, which
 *      never exists on find().populate('skill') rows → studentScore always 0,
 *      verdict always TYPICAL.
 * Both the uncached (standalone) and the loader/cached path are exercised.
 */
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => {
  const m = () => ({ find: vi.fn(), findOne: vi.fn(), aggregate: vi.fn() });
  return { StudentProfile: m(), StudentSkill: m() };
});

import * as models from '../../../models';
import { clearAllTtlCaches } from '../../../utils/ttlCache';
import { StudentDataLoader } from '../studentDataLoader';
import { __test, getCareerBenchmark } from '../careerAnalysis.service';

type Fn = ReturnType<typeof vi.fn>;
const M = models as unknown as Record<
  'StudentProfile' | 'StudentSkill',
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

const SELF = oid();
const PEERS = Array.from({ length: __test.MIN_BENCHMARK_SAMPLE + 2 }, oid);

function peerRow(category: string, avgRank: number) {
  return { _id: { category }, avgRank, count: 4, nStudents: [SELF, ...PEERS] };
}

function setup(
  peerRows: ReturnType<typeof peerRow>[],
  ownRows: Array<{ skill: { _id: Types.ObjectId; category: string } | null; proficiency: string }>,
) {
  M.StudentProfile.findOne.mockImplementation(() => chain({ _id: SELF }));
  M.StudentSkill.find.mockImplementation(() => chain(ownRows));
  M.StudentSkill.aggregate.mockResolvedValue(peerRows);
  return oid().toString();
}

const paths = {
  uncached: (u: string) => getCareerBenchmark(u),
  'cached (loader)': (u: string) => getCareerBenchmark(u, new StudentDataLoader(u)),
};

beforeEach(() => {
  vi.clearAllMocks();
  clearAllTtlCaches();
});

describe.each(Object.entries(paths))('getCareerBenchmark — %s path', (_name, run) => {
  it('returns categories sorted by category regardless of $group order', async () => {
    const rows = [peerRow('FRONTEND', 2), peerRow('BACKEND', 3), peerRow('CLOUD', 1)];
    const u1 = setup(rows, []);
    const a = await run(u1);
    clearAllTtlCaches();
    const u2 = setup([...rows].reverse(), []);
    const b = await run(u2);

    expect(a.categories?.map((c) => c.category)).toEqual(['BACKEND', 'CLOUD', 'FRONTEND']);
    expect(b).toEqual(a);
  });

  it("scores the student's own categories from row.skill.category", async () => {
    const userId = setup(
      [peerRow('BACKEND', 2), peerRow('FRONTEND', 3), peerRow('CLOUD', 2)],
      [
        { skill: { _id: oid(), category: 'BACKEND' }, proficiency: 'EXPERT' }, // 100 vs peer 50
        { skill: { _id: oid(), category: 'FRONTEND' }, proficiency: 'BEGINNER' }, // 25 vs peer 75
      ],
    );
    const res = await run(userId);
    const byCat = Object.fromEntries((res.categories ?? []).map((c) => [c.category, c]));

    expect(byCat.BACKEND).toEqual({
      category: 'BACKEND',
      studentScore: 100,
      peerScore: 50,
      verdict: 'STRONGER',
    });
    expect(byCat.FRONTEND).toEqual({
      category: 'FRONTEND',
      studentScore: 25,
      peerScore: 75,
      verdict: 'WEAKER',
    });
    // no own skill in CLOUD → 0 / TYPICAL (unchanged behaviour)
    expect(byCat.CLOUD).toEqual({
      category: 'CLOUD',
      studentScore: 0,
      peerScore: 50,
      verdict: 'TYPICAL',
    });
  });

  it('ignores own rows whose skill no longer exists (populate → null)', async () => {
    const userId = setup(
      [peerRow('BACKEND', 2)],
      [
        { skill: null, proficiency: 'EXPERT' },
        { skill: { _id: oid(), category: 'BACKEND' }, proficiency: 'INTERMEDIATE' },
      ],
    );
    const res = await run(userId);
    expect(res.categories).toEqual([
      { category: 'BACKEND', studentScore: 50, peerScore: 50, verdict: 'TYPICAL' },
    ]);
  });
});
